// Extracted from the MIT foundation's AxonHost.CleanText. Joiners and direction
// marks are semantic Unicode text, including Persian/Urdu and emoji sequences.
using System.Text.RegularExpressions;
namespace Axon {
    internal static class SnapshotText {
        internal static string Clean(string value) {
            if(value==null)return null;
            string text=value.Trim();if(text.Length==0)return null;
            // A provider's standalone object/BOM placeholder has no label.
            // Embedded characters and all shaping/direction/word-joiner marks
            // remain intact; removing them would change the observed content.
            foreach(char c in text)if(c!='\uFFFC'&&c!='\uFEFF')return text;
            return null;
        }
        // Normalize only for conservative risk matching, never for observation.
        internal static string RiskLabel(string value) {return Regex.Replace(value??"",@"\p{Cf}","");}
    }
}
