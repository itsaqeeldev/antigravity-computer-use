// Test-only: emits the registered emergency-stop chord, never an approval.
using System;using System.Runtime.InteropServices;
class StopProbe {
 [DllImport("user32.dll")] static extern void keybd_event(byte vk,byte scan,uint flags,UIntPtr extra);
 static void Main(){foreach(byte v in new byte[]{0x11,0x12,0x7B})keybd_event(v,0,0,UIntPtr.Zero);foreach(byte v in new byte[]{0x7B,0x12,0x11})keybd_event(v,0,2,UIntPtr.Zero);}
}
