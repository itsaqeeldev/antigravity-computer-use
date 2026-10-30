using System;
using System.IO;
using System.Reflection;

// Exercise the real metadata writer without creating a guardian or sending input.
class NativeWatchdogMetadataTests {
    static int Main(string[] args) {
        try {
            var type=Assembly.LoadFrom(args[0]).GetType("Axon.CursorSafety",true);
            var write=type.GetMethod("WriteWatchdogRecord",BindingFlags.Static|BindingFlags.NonPublic);
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
            Console.WriteLine("PASS watchdog metadata create, replace and failed replacement; no input APIs used");return 0;
        }catch(Exception error){Console.Error.WriteLine(error);return 1;}
    }
}
