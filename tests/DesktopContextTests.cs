using System;
using Axon;
class DesktopContextTests {
 static int Main() {
  if(!DesktopContext.IsInteractive(true,"Default","default"))throw new Exception("Same visible desktop should be usable");
  if(DesktopContext.IsInteractive(false,"Default","Default"))throw new Exception("Hidden window station must refuse");
  if(DesktopContext.IsInteractive(true,"agent","Default"))throw new Exception("Different input desktop must refuse");
  if(DesktopContext.IsInteractive(true,"Default",null))throw new Exception("Unavailable input desktop must refuse");
  if(DesktopContext.IsInteractive(true,"",""))throw new Exception("Unknown names must refuse");
  var current=DesktopContext.Inspect();
  if(!current.ContainsKey("interactive")||!(current["interactive"] is bool))throw new Exception("Read-only probe needs an explicit result");
  Console.WriteLine("TOTAL 6 desktop-context checks; current interactive="+current["interactive"]);return 0;
 }
}
