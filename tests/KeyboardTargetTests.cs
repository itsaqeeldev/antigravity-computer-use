using System;using Axon;
internal static class KeyboardTargetTests {
    static void Check(bool expected,long target,long foreground,long targetRoot,long foregroundRoot) {
        if(KeyboardTargetPolicy.Same(target,foreground,targetRoot,foregroundRoot)!=expected)throw new Exception("Keyboard target scope violated");
    }
    static int Main(){try{
        Check(true,100,100,100,100);
        Check(true,100,201,100,100); // actual Notepad RichEdit child
        Check(true,201,202,100,100); // provider siblings inside one target
        Check(false,100,301,100,300); // another window, even in same process
        Check(false,100,400,100,400); // owned dialog has its own GA_ROOT
        Check(false,100,201,100,0); // failed ancestor query
        Check(false,0,201,0,100);Check(false,100,0,100,0);
        Console.WriteLine("PASS child focus scope, unrelated roots and unknown handles");return 0;
    }catch(Exception e){Console.Error.WriteLine(e);return 1;}}
}
