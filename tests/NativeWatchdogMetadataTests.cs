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
