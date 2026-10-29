using System;using System.Collections.Generic;using System.Reflection;
// Reflection calls the real compiled policy only. Never invoke the host entry
// point, create windows, register hooks, inspect target apps or dispatch input.
class NativeRiskPolicyTests {
 static int Main(string[] args){try{
  var assembly=Assembly.LoadFrom(args[0]);var method=assembly.GetType("Axon.ControlFence",true).GetMethod("Sensitive",BindingFlags.NonPublic|BindingFlags.Static);
  Check(method,"click","",true);Check(method,"drag","",true);Check(method,"click","   ",true);
  Check(method,"click","Open settings Button",false);Check(method,"move","",false);
  Check(method,"click","Delete file Button",true);Check(method,"click","de\u200Dlete file Button",true);Check(method,"click","\u200D",true);
  Console.WriteLine("PASS native ambiguous-target and risk-only Unicode classification; no input APIs used");return 0;
 }catch(Exception error){Console.Error.WriteLine(error);return 1;}}
 static void Check(MethodInfo method,string op,string label,bool expected){
  bool actual=(bool)method.Invoke(null,new object[]{op,new Dictionary<string,object>{{"__risk","routine"}},label});
  if(actual!=expected)throw new Exception("Native classifier mismatch: operation="+op+" expected_sensitive="+expected+" actual="+actual);
 }
}
