using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Threading;

// Exercise the real metadata writer without creating a guardian or sending input.
class NativeWatchdogMetadataTests {
    static int Main(string[] args) {
        if(args.Length==1&&args[0]=="--hold") { Thread.Sleep(30000);return 0; }
        try {
            var host=Assembly.LoadFrom(args[0]);var type=host.GetType("Axon.CursorSafety",true);
            var write=type.GetMethod("WriteWatchdogRecord",BindingFlags.Static|BindingFlags.NonPublic);
            var check=host.GetType("Axon.ControlFence",true).GetMethod("CheckWatchdogIdentity",BindingFlags.Static|BindingFlags.NonPublic);
            var deadline=host.GetType("Axon.NativeDeadline",true);
            var create=deadline.GetMethod("Create",BindingFlags.Static|BindingFlags.NonPublic);
            var valid=deadline.GetMethod("Valid",BindingFlags.Static|BindingFlags.NonPublic);
            ulong bounded=(ulong)create.Invoke(null,new object[]{100000000L,0L,1000UL,500});
            if(bounded!=1500UL||!(bool)valid.Invoke(null,new object[]{bounded,1499UL})||(bool)valid.Invoke(null,new object[]{bounded,1500UL}))throw new Exception("monotonic deadline boundary differs");
            if((ulong)create.Invoke(null,new object[]{100L,100L,10UL,500})!=0UL||(ulong)create.Invoke(null,new object[]{100000000L,0L,UInt64.MaxValue-1,500})!=0UL)throw new Exception("invalid deadline accepted");
            string file=Path.Combine(args[1],"guard.watchdog");
            write.Invoke(null,new object[]{file,101,123L});
            if(File.ReadAllText(file)!="101|123")throw new Exception("initial record mismatch");
            write.Invoke(null,new object[]{file,102,456L});
            if(File.ReadAllText(file)!="102|456")throw new Exception("replacement mismatch");
            using(var held=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                bool failed=false;try{write.Invoke(null,new object[]{file,103,789L});}catch(TargetInvocationException){failed=true;}
                if(!failed)throw new Exception("locked replacement unexpectedly succeeded");
            }
            if(File.ReadAllText(file)!="102|456")throw new Exception("failed replacement changed prior record");
            if(Directory.GetFiles(args[1],"*.tmp").Length!=0)throw new Exception("unpublished temporary record remains");
            string guard=Path.Combine(args[1],"identity");
            Action mustRefuse=delegate { bool failed=false;try{check.Invoke(null,new object[]{guard});}catch(TargetInvocationException){failed=true;}if(!failed)throw new Exception("invalid watchdog identity accepted"); };
            mustRefuse();File.WriteAllText(guard+".watchdog","invalid");mustRefuse();
            File.WriteAllText(guard+".watchdog",new string('9',129));mustRefuse();
            File.WriteAllBytes(guard+".watchdog",new byte[]{0xff});mustRefuse();
            var fence=host.GetType("Axon.ControlFence",true);fence.GetField("Token",BindingFlags.Static|BindingFlags.NonPublic).SetValue(null,"fixture");
            var nativeCheck=fence.GetMethod("Check",BindingFlags.Static|BindingFlags.NonPublic);
            Environment.SetEnvironmentVariable("AGCU_GUARD_FILE",guard);Environment.SetEnvironmentVariable("AGCU_STOP_LATCH","");
            Action fenceMustRefuse=delegate { bool failed=false;try{nativeCheck.Invoke(null,null);}catch(TargetInvocationException){failed=true;}if(!failed)throw new Exception("unbounded active state accepted"); };
            File.WriteAllText(guard,"active|fixture|"+DateTime.UtcNow.AddMinutes(5).Ticks+"|");fenceMustRefuse();
            File.WriteAllText(guard,"active|fixture|"+DateTime.UtcNow.AddMinutes(5).Ticks+"||0");fenceMustRefuse();
            var info=new ProcessStartInfo(Process.GetCurrentProcess().MainModule.FileName,"--hold");info.UseShellExecute=false;info.CreateNoWindow=true;
            using(Process child=Process.Start(info)) {
                try {
                    long born=child.StartTime.ToUniversalTime().Ticks;
                    File.WriteAllText(guard+".watchdog",child.Id+"|"+(born+1));mustRefuse();
                    File.WriteAllText(guard+".watchdog",child.Id+"|"+born);check.Invoke(null,new object[]{guard});
                    var timing=Stopwatch.StartNew();for(int i=0;i<100;i++)check.Invoke(null,new object[]{guard});timing.Stop();
                    Console.WriteLine("100 watchdog identity checks (ms): "+timing.Elapsed.TotalMilliseconds.ToString("F1"));
                    child.Kill();child.WaitForExit();mustRefuse();
                }finally{if(!child.HasExited){child.Kill();child.WaitForExit();}}
            }
            Console.WriteLine("PASS watchdog metadata create, replace and failed replacement; no input APIs used");return 0;
        }catch(Exception error){Console.Error.WriteLine(error);return 1;}
    }
}
