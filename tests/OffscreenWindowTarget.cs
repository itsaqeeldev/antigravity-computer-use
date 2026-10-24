// Owned manual integration target only. Never runs in unattended CI.
using System;using System.Drawing;using System.Windows.Forms;using System.Runtime.InteropServices;using System.Web.Script.Serialization;
class OffscreenWindowTarget {
 [DllImport("user32.dll")]static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [STAThread]static void Main(){
  try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}
  Application.EnableVisualStyles();Form form=new Form();form.AutoScaleMode=AutoScaleMode.None;form.StartPosition=FormStartPosition.Manual;form.Text="Owned offscreen window regression";form.MinimumSize=new Size(300,200);form.Size=new Size(473,1053);
  int top=0;foreach(Screen screen in Screen.AllScreens)top=Math.Min(top,screen.Bounds.Top);
  Button button=new Button();button.Text="Offscreen target";button.SetBounds(20,20,210,42);form.Controls.Add(button);
  Label count=new Label();count.Text="presses:0";count.SetBounds(20,85,220,40);form.Controls.Add(count);int presses=0;button.Click+=delegate{count.Text="presses:"+(++presses);};
  Label downs=new Label();downs.Text="downs:0";downs.SetBounds(20,130,220,40);form.Controls.Add(downs);int downCount=0;MouseEventHandler down=delegate{downs.Text="downs:"+(++downCount);};form.MouseDown+=down;button.MouseDown+=down;
  form.Shown+=delegate{SetWindowPos(form.Handle,IntPtr.Zero,525,top-787,473,1053,0x14);Console.WriteLine(new JavaScriptSerializer().Serialize(new{pid=System.Diagnostics.Process.GetCurrentProcess().Id,hwnd=form.Handle.ToInt64()}));Console.Out.Flush();};
  Application.Run(form);
 }
}
