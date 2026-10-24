// Physical-pixel window placement; no global display settings or desktop switch.
using System;
using System.Drawing;
namespace Axon {
    internal static class WindowGeometry {
        internal static Rectangle Fit(Rectangle window,Rectangle work) {
            if(window.Width<=0||window.Height<=0||work.Width<=0||work.Height<=0)throw new ArgumentOutOfRangeException("bounds");
            int width=Math.Min(window.Width,work.Width),height=Math.Min(window.Height,work.Height);
            long right=(long)work.X+work.Width-width,bottom=(long)work.Y+work.Height-height;
            long x=Math.Max(work.X,Math.Min((long)window.X,right)),y=Math.Max(work.Y,Math.Min((long)window.Y,bottom));
            return new Rectangle(checked((int)x),checked((int)y),width,height);
        }
        internal static bool Reachable(Point point,Rectangle[] displays) {
            foreach(Rectangle display in displays)if(display.Contains(point))return true;
            return false;
        }
    }
}
