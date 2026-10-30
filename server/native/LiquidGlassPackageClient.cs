using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;

namespace Axon {
    internal static class LiquidGlassPackageClient {
        static readonly object Gate = new object();
        static Process process; static Thread reader; static Bitmap latest; static string pending;
        internal static Bitmap Surface(string state, int width, int height) {
            var helper = Environment.GetEnvironmentVariable("AGCU_LIQUIDGLASS_HELPER");
            if(String.IsNullOrWhiteSpace(helper)||!File.Exists(helper))return null;
            lock(Gate){try{Ensure(helper);pending=width+"|"+height+"|"+(state??"active");Monitor.PulseAll(Gate);return latest==null?null:new Bitmap(latest);}catch{return null;}}
        }
        static void Ensure(string helper){if(process!=null&&!process.HasExited)return;process=new Process{StartInfo=new ProcessStartInfo{FileName=helper,Arguments="--stdio",UseShellExecute=false,RedirectStandardInput=true,RedirectStandardOutput=true,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(helper)}};process.Start();reader=new Thread(Read){IsBackground=true,Name="LiquidGlassPackageReader"};reader.Start();}
 static void Read(){while(true){string request;lock(Gate){while(pending==null&&process!=null&&!process.HasExited)Monitor.Wait(Gate);request=pending;pending=null;}if(String.IsNullOrEmpty(request))continue;try{process.StandardInput.WriteLine(request);process.StandardInput.Flush();var line=process.StandardOutput.ReadLine();if(String.IsNullOrEmpty(line)||line.StartsWith("error|",StringComparison.Ordinal))continue;using(var stream=new MemoryStream(Convert.FromBase64String(line)))using(var decoded=new Bitmap(stream))lock(Gate){if(latest!=null)latest.Dispose();latest=new Bitmap(decoded);}}catch{return;}}}
    }
}
