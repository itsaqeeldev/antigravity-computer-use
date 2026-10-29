// Native Windows reader for the same control contract consumed by Node and
// the Swift adapter. Native enforcement stays outside model-controlled args.
using System;
using System.IO;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Text.RegularExpressions;
using System.Drawing;

namespace Axon {
    internal static class ControlContract {
        static readonly Dictionary<string,object> Values=Load();
        static Dictionary<string,object> Load() {
            string file=Environment.GetEnvironmentVariable("AGCU_CONTRACT_FILE");
            // Older direct native component harnesses supply no deployment
            // contract. Their historical defaults remain testable. Production
            // Runtime always supplies the installed contract path.
            if(String.IsNullOrEmpty(file))return new Dictionary<string,object>();
            var data=new JavaScriptSerializer().DeserializeObject(File.ReadAllText(file)) as Dictionary<string,object>;
            if(data==null || !data.ContainsKey("version") || Convert.ToInt32(data["version"])!=1)throw new InvalidOperationException("Native control contract is missing or incompatible.");
            return data;
        }
        internal static int Number(string key,int fallback) {object value;return Values.TryGetValue(key,out value)?Convert.ToInt32(value):fallback;}
        internal static double UiNumber(string key,double fallback,double minimum,double maximum) {
            object ui,value;var fields=Values.TryGetValue("ui",out ui)?ui as Dictionary<string,object>:null;
            if(fields==null||!fields.TryGetValue(key,out value))return fallback;
            try {
                double result=Convert.ToDouble(value,System.Globalization.CultureInfo.InvariantCulture);
                return Double.IsNaN(result)||Double.IsInfinity(result)||result<minimum||result>maximum?fallback:result;
            } catch { return fallback; }
        }
        internal static bool Pattern(string key,string fallback,string text) {object value;return Regex.IsMatch(text??"",Values.TryGetValue(key,out value)?Convert.ToString(value):fallback,RegexOptions.IgnoreCase);}
        internal static bool SensitiveOperation(string op) {
            object value;
            if(Values.TryGetValue("sensitive_operations",out value))foreach(object name in (object[])value)if(Convert.ToString(name)==op)return true;
            return !Values.ContainsKey("sensitive_operations")&&new List<string>{"launch","clipboard","close_window","paste","paste_files","open","file_dialog"}.Contains(op);
        }
        internal static bool AmbiguousOperation(string op) {
            object value;
            if(Values.TryGetValue("ambiguous_target_operations",out value))foreach(object name in (object[])value)if(Convert.ToString(name)==op)return true;
            return !Values.ContainsKey("ambiguous_target_operations")&&(op=="click"||op=="drag");
        }
        internal static Color ColorValue(string key,Color fallback) {
            object ui,value;if(!Values.TryGetValue("ui",out ui))return fallback;
            var fields=ui as Dictionary<string,object>;if(fields==null||!fields.TryGetValue(key,out value))return fallback;
            var rgb=value as object[];if(rgb==null||rgb.Length!=3)throw new InvalidOperationException("Invalid native UI color contract.");
            return Color.FromArgb(Convert.ToInt32(rgb[0]),Convert.ToInt32(rgb[1]),Convert.ToInt32(rgb[2]));
        }
    }
}
