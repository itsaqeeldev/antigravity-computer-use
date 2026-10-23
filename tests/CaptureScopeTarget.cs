// Isolated, owned windows for capture privacy regression. Never injects input.
using System;using System.Drawing;using System.Windows.Forms;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class CaptureScopeTarget {
 [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")]static extern bool ShowWindow(IntPtr h,int how);
 [StructLayout(LayoutKind.Sequential)]struct Rect{internal int left,top,right,bottom;}
 [STAThread]static int Main(string[] args){
  if(args[0]=="inspect"){
   using(Bitmap b=new Bitmap(args[1])){int x=Int32.Parse(args[2]),y=Int32.Parse(args[3]),count=0;
    for(int yy=y;yy<y+16;yy++)for(int xx=x;xx<x+16;xx++){Color c=b.GetPixel(xx,yy);if(c.B>140&&c.R<60&&c.G<60)count++;}
    Console.WriteLine(new JavaScriptSerializer().Serialize(new {blue_pixels=count}));return 0;}
  }
  SetProcessDPIAware();Application.EnableVisualStyles();bool cover=args[0]=="cover";
  Form f=new Form();f.AutoScaleMode=AutoScaleMode.None;f.Text="Capture Scope "+args[0];f.StartPosition=FormStartPosition.Manual;
  f.Location=new Point(Int32.Parse(args[1]),Int32.Parse(args[2]));f.Size=cover?new Size(64,64):new Size(600,400);
  f.FormBorderStyle=FormBorderStyle.None;f.TopMost=true;f.BackColor=cover?Color.FromArgb(0,0,240):Color.FromArgb(180,70,20);
  if(!cover)f.Paint+=delegate(object sender,PaintEventArgs e){using(Brush brush=new SolidBrush(Color.FromArgb(210,95,30)))for(int y=20;y<360;y+=64)e.Graphics.FillRectangle(brush,20,y,480,24);};
  f.Shown+=delegate{ShowWindow(f.Handle,4);Rect r;GetWindowRect(f.Handle,out r);Console.WriteLine(new JavaScriptSerializer().Serialize(new {hwnd=f.Handle.ToInt64(),rect=new[]{r.left,r.top,r.right,r.bottom}}));Console.Out.Flush();};
  Application.Run(f);return 0;
 }
}
