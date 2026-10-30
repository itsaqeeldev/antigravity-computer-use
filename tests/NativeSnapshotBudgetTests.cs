using System;
using System.Reflection;
class NativeSnapshotBudgetTests {
 static int Main(string[] args) { try {
  var assembly=Assembly.LoadFrom(args[0]);
  var method=assembly.GetType("Axon.Program",true).GetMethod("SnapshotWalkBudget",BindingFlags.NonPublic|BindingFlags.Static);
  Check(method,8000,null,8000); Check(method,8000,250,250); Check(method,8000,1,100);
  Check(method,50,1000,50); Check(method,8000,9000,8000); Check(method,8000,"bad",8000);
  Console.WriteLine("PASS native snapshot budget policy; no input APIs used"); return 0;
 } catch(Exception error) { Console.Error.WriteLine(error); return 1; } }
 static void Check(MethodInfo method,int configured,object requested,int expected) {
  int actual=(int)method.Invoke(null,new object[]{configured,requested});
  if(actual!=expected)throw new Exception("Budget mismatch: expected="+expected+" actual="+actual);
 }
}
