using System;
using System.Collections.Generic;
internal static class GuardCleanupTests {
    static int Main() {
        var observed=new List<int>();
        GuardCleanup.Run(
            delegate { observed.Add(1);throw new Exception("first failed"); },
            delegate { observed.Add(2); },
            delegate { observed.Add(3);throw new Exception("third failed"); },
            delegate { observed.Add(4); });
        if(String.Join(",",observed)!="1,2,3,4")return 1;
        Console.WriteLine("all cleanup operations attempted in order");return 0;
    }
}
