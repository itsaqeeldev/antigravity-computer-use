// Read-only Windows desktop preflight. Never opens/switches another desktop,
// changes a token or escapes the host's process/security environment.
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
namespace Axon {
    internal static class DesktopContext {
        [DllImport("user32.dll")] static extern IntPtr GetProcessWindowStation();
        [DllImport("user32.dll")] static extern IntPtr GetThreadDesktop(uint thread);
        [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
        [DllImport("user32.dll",SetLastError=true)] static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
        [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr desktop);
        [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetUserObjectInformation(IntPtr handle,int index,IntPtr info,uint length,out uint needed);
        static string Name(IntPtr handle) {
            if(handle==IntPtr.Zero)return null;
            uint needed;GetUserObjectInformation(handle,2,IntPtr.Zero,0,out needed);
            if(needed==0||needed>32768)return null;
            IntPtr buffer=Marshal.AllocHGlobal((int)needed);
            try{return GetUserObjectInformation(handle,2,buffer,needed,out needed)?Marshal.PtrToStringUni(buffer):null;}
            finally{Marshal.FreeHGlobal(buffer);}
        }
        internal static bool IsInteractive(bool stationVisible,string attached,string input) {
            return stationVisible&&!String.IsNullOrEmpty(attached)&&!String.IsNullOrEmpty(input)&&String.Equals(attached,input,StringComparison.OrdinalIgnoreCase);
        }
        internal static Dictionary<string,object> Inspect() {
            IntPtr station=GetProcessWindowStation(),desktop=GetThreadDesktop(GetCurrentThreadId());
            bool visible=false;uint needed;IntPtr flags=Marshal.AllocHGlobal(12);
            try{if(GetUserObjectInformation(station,1,flags,12,out needed))visible=(Marshal.ReadInt32(flags,8)&1)!=0;}
            finally{Marshal.FreeHGlobal(flags);}
            string attached=Name(desktop),inputName=null;int inputError=0;
            IntPtr input=OpenInputDesktop(0,false,1); // DESKTOP_READOBJECTS; no switching rights
            if(input==IntPtr.Zero)inputError=Marshal.GetLastWin32Error();
            else try{inputName=Name(input);}finally{CloseDesktop(input);}
            return new Dictionary<string,object>{{"interactive",IsInteractive(visible,attached,inputName)},{"station_visible",visible},{"window_station",Name(station)},{"attached_desktop",attached},{"input_desktop",inputName},{"input_error",inputError}};
        }
    }
}
