// Temporary native system-arrow styling with an independent crash watchdog.
// SetSystemCursor consumes its cursor handle. SPI_SETCURSORS restores the
// configured Windows cursor scheme; no registry or user-profile writes occur.
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Axon {
    internal static class CursorSafety {
        [StructLayout(LayoutKind.Sequential)] struct IconInfo {
            [MarshalAs(UnmanagedType.Bool)] internal bool icon;
            internal uint x,y;internal IntPtr mask,color;
        }
        [DllImport("user32.dll",SetLastError=true)] static extern IntPtr CreateIconIndirect(ref IconInfo info);
        [DllImport("user32.dll",SetLastError=true)] static extern bool SetSystemCursor(IntPtr cursor,uint id);
        [DllImport("user32.dll")] static extern bool DestroyCursor(IntPtr cursor);
        [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
        [DllImport("user32.dll")] static extern IntPtr LoadCursor(IntPtr instance,IntPtr id);
        [DllImport("user32.dll")] static extern bool DrawIconEx(IntPtr dc,int x,int y,IntPtr icon,int w,int h,uint step,IntPtr brush,uint flags);
        [StructLayout(LayoutKind.Sequential)] struct CursorInfo {internal int size,flags;internal IntPtr cursor;internal Native.POINT point;}
        [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CursorInfo info);
        [DllImport("gdi32.dll")] static extern IntPtr CreateBitmap(int w,int h,uint planes,uint bits,IntPtr data);
        [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
        [DllImport("user32.dll")] static extern bool SystemParametersInfo(uint action,uint value,IntPtr data,uint flags);
        static Process watchdog;
        static bool applied;
        static readonly object gate=new object();
        internal static bool Applied { get { lock(gate)return applied; } }
        internal static int WatchdogPid {get {lock(gate)return watchdog!=null&&!watchdog.HasExited?watchdog.Id:0;}}
        static bool EnsureWatchdog() {
            if(watchdog!=null && !watchdog.HasExited)return true;
            ProcessStartInfo info=new ProcessStartInfo(Process.GetCurrentProcess().MainModule.FileName,
                "--cursor-watchdog "+Process.GetCurrentProcess().Id+" "+Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks);
            info.UseShellExecute=false;info.CreateNoWindow=true;info.RedirectStandardInput=true;info.RedirectStandardOutput=true;
            watchdog=Process.Start(info);
            Task<string> ready=Task.Factory.StartNew(delegate {return watchdog.StandardOutput.ReadLine();});
            if(!ready.Wait(5000) || ready.Result!="cursor-watchdog-ready") {
                try {watchdog.Kill();}catch {}watchdog=null;return false;
            }
            return true;
        }
        internal static bool Apply() {
            lock(gate) {
                if(applied && watchdog!=null && !watchdog.HasExited)return true;
                try {
                    if(!EnsureWatchdog())return false;
                    // The watchdog must be armed BEFORE changing shared cursors.
                    watchdog.StandardInput.WriteLine("arm");watchdog.StandardInput.Flush();
                    Task<string> acknowledgement=Task.Factory.StartNew(delegate {return watchdog.StandardOutput.ReadLine();});
                    if(!acknowledgement.Wait(2000)||acknowledgement.Result!="armed")throw new InvalidOperationException("Cursor watchdog did not arm");
                    if(!File.ReadAllText(ControlFence.FileName).StartsWith("active|")){Restore();return false;}
                    int size=Math.Max(32,GetSystemMetrics(13));
                    using(Bitmap bitmap=new Bitmap(size,size,PixelFormat.Format32bppArgb)) {
                        using(Graphics g=Graphics.FromImage(bitmap)) {
                            g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                            g.ScaleTransform(size/32f,size/32f);DesktopVisuals.Arrow(g);
                        }
                        IntPtr color=bitmap.GetHbitmap(Color.Transparent),mask=CreateBitmap(size,size,1,1,IntPtr.Zero),cursor=IntPtr.Zero;
                        try {
                            IconInfo icon=new IconInfo();icon.icon=false;icon.x=(uint)Math.Round(4*size/32f);icon.y=(uint)Math.Round(2*size/32f);icon.color=color;icon.mask=mask;
                            // A button or editable field often switches away
                            // from OCR_NORMAL. Style those ordinary roles too.
                            foreach(uint role in new uint[]{32512,32649,32513,32650}) {
                                if(!File.ReadAllText(ControlFence.FileName).StartsWith("active|"))throw new InvalidOperationException("Control ended during cursor setup");
                                cursor=CreateIconIndirect(ref icon);
                                if(cursor==IntPtr.Zero || !SetSystemCursor(cursor,role))throw new InvalidOperationException("Windows refused custom cursor role");
                                cursor=IntPtr.Zero;applied=true;
                            }
                        } finally {if(cursor!=IntPtr.Zero)DestroyCursor(cursor);DeleteObject(color);DeleteObject(mask);}
                    }
                    if(!File.ReadAllText(ControlFence.FileName).StartsWith("active|")){Restore();return false;}
                    return true;
                }catch {Restore();return false;}
            }
        }
        internal static void Restore() {
            lock(gate) {
                // Also handles failure after the cursor was created but before
                // the local success flag was recorded.
                if(applied || watchdog!=null)SystemParametersInfo(0x57,0,IntPtr.Zero,0);
                applied=false;
                try {if(watchdog!=null&&!watchdog.HasExited){watchdog.StandardInput.WriteLine("disarm");watchdog.StandardInput.Flush();}}catch {}
            }
        }
        internal static bool CheckWatchdog() {
            lock(gate) {if(applied && (watchdog==null||watchdog.HasExited)){Restore();return false;}return true;}
        }
        internal static void Close() {
            lock(gate) {
                Restore();
                try {if(watchdog!=null&&!watchdog.HasExited){watchdog.StandardInput.Close();if(!watchdog.WaitForExit(1500))watchdog.Kill();}}catch {}
                if(watchdog!=null)watchdog.Dispose();watchdog=null;
            }
        }
        static volatile bool armed,finished;
        static void CrashCleanup() {
            // This process outlives a hard-killed UI, and does not depend on the
            // Node event loop to revoke input or release keys/buttons.
            string file=ControlFence.FileName;
            try {File.WriteAllText(file,"stopped||0|");}catch {}
            try {
                foreach(string line in File.ReadAllLines(file+".workers")) {
                    string[] parts=line.Split(':');if(parts.Length!=2)continue;
                    using(Process p=Process.GetProcessById(Int32.Parse(parts[0])))
                        if(p.StartTime.ToUniversalTime().Ticks.ToString()==parts[1] &&
                           String.Equals(p.MainModule.FileName,Process.GetCurrentProcess().MainModule.FileName,StringComparison.OrdinalIgnoreCase))p.Kill();
                }
            }catch {}
            ControlFence.Recover();SystemParametersInfo(0x57,0,IntPtr.Zero,0);
        }
        internal static void Probe(string file,uint role=32512,bool shown=false) {
            int size=Math.Max(32,GetSystemMetrics(13));
            using(Bitmap image=new Bitmap(size,size)) {
                using(Graphics g=Graphics.FromImage(image)) {
                    g.Clear(Color.FromArgb(28,27,38));IntPtr dc=g.GetHdc();
                    IntPtr cursor=LoadCursor(IntPtr.Zero,new IntPtr(role));
                    if(shown) {CursorInfo info=new CursorInfo();info.size=Marshal.SizeOf(info);if(!GetCursorInfo(ref info))throw new Exception("Cannot inspect shown cursor");cursor=info.cursor;}
                    try {if(!DrawIconEx(dc,0,0,cursor,size,size,0,IntPtr.Zero,3))throw new Exception("Cannot inspect current cursor");}
                    finally{g.ReleaseHdc(dc);}
                }
                image.Save(file,ImageFormat.Png);
            }
        }
        internal static int Watch(int ownerPid,long started) {
            using(Process owner=Process.GetProcessById(ownerPid)) {
                if(owner.StartTime.ToUniversalTime().Ticks!=started)return 2;
                Thread input=new Thread(delegate() {
                    try {
                        string line;while((line=Console.ReadLine())!=null) {
                            if(line=="arm") {armed=true;Console.WriteLine("armed");Console.Out.Flush();}
                            if(line=="disarm") {if(armed)SystemParametersInfo(0x57,0,IntPtr.Zero,0);armed=false;}
                        }
                    }finally {finished=true;}
                });input.IsBackground=true;input.Start();
                Console.WriteLine("cursor-watchdog-ready");Console.Out.Flush();
                try {
                    while(!finished && !owner.WaitForExit(100)) {
                        if(armed) {
                            string file=ControlFence.FileName;
                            bool active=false;try {active=File.ReadAllText(file).StartsWith("active|");}catch {}
                            if(!active){SystemParametersInfo(0x57,0,IntPtr.Zero,0);armed=false;}
                        }
                    }
                }finally {if(armed)CrashCleanup();}
            }
            return 0;
        }
    }
}
