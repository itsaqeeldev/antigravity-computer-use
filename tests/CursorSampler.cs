// Read-only sampler; never injects input or changes foreground.
using System;using System.Threading;using System.Diagnostics;using System.Runtime.InteropServices;
class CursorSampler {
 [StructLayout(LayoutKind.Sequential)]struct Point{public int x,y;}
 [DllImport("user32.dll")]static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")]static extern short GetAsyncKeyState(int k);
 static void Main(string[] args){var timer=Stopwatch.StartNew();Console.WriteLine("ready");while(timer.ElapsedMilliseconds<Int32.Parse(args[0])){Point p;GetCursorPos(out p);Console.WriteLine(timer.ElapsedMilliseconds+","+p.x+","+p.y+","+((GetAsyncKeyState(1)&0x8000)!=0?1:0));Thread.Sleep(8);}}
}
