using System;using Axon;
internal static class SnapshotTextTests {
    static void Same(string expected,string actual){if(expected!=actual)throw new Exception("Snapshot text changed semantic Unicode");}
    static int Main(){try{
        Same("می\u200Cخواهم",SnapshotText.Clean("می\u200Cخواهم"));
        Same("👩🏽\u200D💻",SnapshotText.Clean("👩🏽\u200D💻"));
        Same("\u200Fاردو 123\u200E",SnapshotText.Clean("\u200Fاردو 123\u200E"));
        Same("\uFFFC\uFEFFVisible\u200B\u2060",SnapshotText.Clean("\uFFFC\uFEFFVisible\u200B\u2060"));
        Same(null,SnapshotText.Clean("\uFFFC\uFEFF"));
        Same("delete",SnapshotText.RiskLabel("de\u200Dlete"));
        Console.WriteLine("PASS semantic Unicode and risk-only normalization");return 0;
    }catch(Exception error){Console.Error.WriteLine(error);return 1;}}
}
