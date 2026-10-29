using System;using System.IO;using System.Reflection;using System.Security.AccessControl;
// Read the real native layout classifier by reflection. Do not run its entry
// point or any ACL mutation, lease, desktop or input method.
class NativeStorageLayoutTests {
 static int Main(string[] args){try{
  var type=Assembly.LoadFrom(args[0]).GetType("StorageGuard",true);
  var owns=type.GetMethod("OwnInstall",BindingFlags.Static|BindingFlags.NonPublic);string root=args[1];
  string before=new DirectoryInfo(root).GetAccessControl().GetSecurityDescriptorSddlForm(AccessControlSections.All);
  File.WriteAllText(Path.Combine(root,"installation.json"),"{}");Check(owns,root,true,"legacy installation");
  foreach(string name in new string[]{"update-settings.json","update-state.json","update-worker-result.json","update-switching.json","update.lock"}){
   File.WriteAllText(Path.Combine(root,name),"{}");Check(owns,root,true,name);
  }
  Directory.CreateDirectory(Path.Combine(root,"updates"));Check(owns,root,true,"private updater staging");
  string temporary=".update-state.json."+Guid.NewGuid().ToString("D")+".tmp";
  File.WriteAllText(Path.Combine(root,temporary),"{}");Check(owns,root,true,"interrupted atomic metadata");
  foreach(string name in new string[]{"keep.txt","update-state.json.bak","updates-personal",".unrelated.json."+Guid.NewGuid().ToString("D")+".tmp"}){
   string file=Path.Combine(root,name);File.WriteAllText(file,"preserve");Check(owns,root,false,name);
   if(File.ReadAllText(file)!="preserve")throw new Exception("Unrelated data was changed");File.Delete(file);
  }
  string after=new DirectoryInfo(root).GetAccessControl().GetSecurityDescriptorSddlForm(AccessControlSections.All);
  if(before!=after)throw new Exception("Classification changed storage permissions");
  Console.WriteLine("PASS native updater layout recognition; unrelated files refused; no ACL or input changes");return 0;
 }catch(Exception error){Console.Error.WriteLine(error);return 1;}}
 static void Check(MethodInfo method,string root,bool expected,string label){
  bool actual=(bool)method.Invoke(null,new object[]{root});if(actual!=expected)throw new Exception("Native installation layout mismatch for "+label+": expected="+expected+", actual="+actual);
 }
}
