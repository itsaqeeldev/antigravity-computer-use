using System;using System.IO;using System.Collections.Generic;using Axon;
namespace Axon {
 internal class AxonError:Exception {internal AxonError(string c,string m,object h):base(c){} }
 internal static class ControlFence {internal static string FileName;internal static void Check(){}}
 internal static class Native {
  internal struct KEYBDINPUT {internal ushort wVk,wScan;internal uint dwFlags;}
  internal struct MOUSEINPUT {internal uint dwFlags;}
  internal struct INPUTUNION {internal KEYBDINPUT ki;internal MOUSEINPUT mi;}
  internal struct INPUT {internal uint type;internal INPUTUNION u;}
  internal static int InputSize=1;internal static uint limit=999;internal static bool failOne;
  internal static List<INPUT> sent=new List<INPUT>();
  internal static INPUT KeyInput(ushort v,ushort s,uint f){INPUT i=new INPUT();i.type=1;i.u.ki.wVk=v;i.u.ki.wScan=s;i.u.ki.dwFlags=f;return i;}
  internal static INPUT MouseInput(uint f,uint d){INPUT i=new INPUT();i.u.mi.dwFlags=f;return i;}
  internal static uint SendInput(uint count,INPUT[] input,int size){if(failOne){failOne=false;throw new Exception("one rejected release");}uint n=Math.Min(limit,count);for(int i=0;i<n;i++)sent.Add(input[i]);return n;}
 }
}
internal static class InputLedgerTests {
 static int count;static void Check(bool v,string m){if(!v)throw new Exception(m);count++;Console.WriteLine("PASS "+m);}
 static int Main(string[] args){try {
  ControlFence.FileName=Path.Combine(args[0],"journal.state");File.Delete(ControlFence.FileName+".inputs");
  InputLedger.Recover();Check(Native.sent.Count==0,"idle recovery sends no unrelated key or mouse releases");
  InputLedger.Send(new[]{Native.KeyInput(0x11,0,0),Native.MouseInput(2,0)});Native.sent.Clear();InputLedger.Recover();
  Check(Native.sent.Count==2&&Native.sent[0].u.ki.wVk==0x11&&Native.sent[1].u.mi.dwFlags==4,"recovers only owned Ctrl and left button");
  Native.sent.Clear();InputLedger.Recover();Check(Native.sent.Count==0,"successful recovery is idempotent");
  InputLedger.Send(new[]{Native.KeyInput(65,0,0),Native.KeyInput(65,0,2)});Native.sent.Clear();InputLedger.Recover();Check(Native.sent.Count==0,"balanced keys leave no recovery work");
  Native.limit=1;try{InputLedger.Send(new[]{Native.KeyInput(0,0x062F,4),Native.KeyInput(0,0x062F,6)});}catch(AxonError){}Native.limit=999;Native.sent.Clear();InputLedger.Recover();
  Check(Native.sent.Count==1&&Native.sent[0].u.ki.wScan==0x062F&&Native.sent[0].u.ki.dwFlags==6,"partial Unicode injection retains exact scan-code release");
  InputLedger.Send(new[]{Native.KeyInput(0xA3,0,1),Native.MouseInput(8,0)});Native.sent.Clear();Native.failOne=true;InputLedger.Recover();
  Check(Native.sent.Count==1&&Native.sent[0].u.mi.dwFlags==16,"failed key release does not prevent mouse recovery");
  Check(InputLedger.HasHeld(),"failed release keeps control blocked until recovery succeeds");
  Native.sent.Clear();InputLedger.Recover();Check(Native.sent.Count==1&&Native.sent[0].u.ki.dwFlags==3,"failed extended-key release persists for independent retry");
  Check(!InputLedger.HasHeld(),"confirmed recovery clears the held-input block");
  Console.WriteLine("TOTAL "+count);return 0;
 }catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}
