// Original Antigravity visual design. Uses the upstream layered-window renderer;
// no vendor artwork, cursor files, fonts, or private implementation is included.
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.IO;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace Axon {
    internal static class DesktopVisuals {
        [DllImport("user32.dll")] static extern bool SystemParametersInfo(uint action,uint value,out bool result,uint flags);
        static bool motion=true;static DateTime motionChecked;
        internal static bool MotionEnabled { get { if((DateTime.UtcNow-motionChecked).TotalSeconds>2){bool enabled;motion=SystemParametersInfo(0x1042,0,out enabled,0)&&enabled;motionChecked=DateTime.UtcNow;}return motion; } }
        static readonly double origin=System.Diagnostics.Stopwatch.GetTimestamp()/(double)System.Diagnostics.Stopwatch.Frequency;
        internal static float BreathLevel {get {return MotionEnabled?.89f+.11f*(float)Math.Sin((System.Diagnostics.Stopwatch.GetTimestamp()/(double)System.Diagnostics.Stopwatch.Frequency-origin)*Math.PI*2/5.2):.94f;}}
        internal static readonly Color Violet = Color.FromArgb(155, 205, 235);
        internal static readonly Color Blue = Color.FromArgb(128, 171, 207);
        internal static readonly Color Mint = Color.FromArgb(186, 222, 232);
        internal static Color StateColor(string state) {
            return state=="paused" ? Color.FromArgb(248,199,119) : state=="stopped" ? Color.FromArgb(255,139,159) : Violet;
        }
        internal static void Edge(Graphics g, Rectangle screen, float scale) {
            // A continuous signed-distance field gives every pixel a soft
            // falloff, including corners. No nested strokes or visible seams.
            int w=screen.Width,h=screen.Height;float radius=24*scale,sigma=21*scale,depth=65*scale;
            using(Bitmap glow=new Bitmap(w,h,PixelFormat.Format32bppArgb)) {
                byte[] pixels=new byte[w*h*4];
                for(int y=0;y<h;y++)for(int x=0;x<w;x++) {
                    if(x>depth && x<w-depth && y>depth && y<h-depth)continue;
                    double qx=Math.Abs(x-w*.5)-(w*.5-radius),qy=Math.Abs(y-h*.5)-(h*.5-radius);
                    double signed=Math.Sqrt(Math.Pow(Math.Max(qx,0),2)+Math.Pow(Math.Max(qy,0),2))+Math.Min(Math.Max(qx,qy),0)-radius;
                    double d=-signed,spread=d<0?8*scale:sigma;
                    int alpha=(int)(112*Math.Exp(-Math.Pow((d-4*scale)/spread,2)/2));
                    float t=(float)(x/(double)w*.55+y/(double)h*.45);
                    Color start=t<.55f?Violet:Blue,end=t<.55f?Blue:Color.FromArgb(165,192,218);
                    float f=t<.55f?t/.55f:(t-.55f)/.45f;
                    int i=(y*w+x)*4;pixels[i]=(byte)(start.B+(end.B-start.B)*f);pixels[i+1]=(byte)(start.G+(end.G-start.G)*f);pixels[i+2]=(byte)(start.R+(end.R-start.R)*f);pixels[i+3]=(byte)alpha;
                }
                BitmapData data=glow.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
                try {Marshal.Copy(pixels,0,data.Scan0,pixels.Length);}finally {glow.UnlockBits(data);}
                g.DrawImageUnscaled(glow,screen.X,screen.Y);
            }
        }
        internal static void Pointer(Graphics g,float phase) {
            // The hotspot is (48,48). Windows draws the temporary native arrow
            // above us. Four common roles share the dart; app-owned cursors and resize shapes remain application-controlled.
            using(GraphicsPath circle=new GraphicsPath()) {
                circle.AddEllipse(14,14,68,68);
                using(PathGradientBrush halo=new PathGradientBrush(circle)) {
                    halo.CenterColor=Color.FromArgb(88,Violet);halo.SurroundColors=new Color[]{Color.Transparent};
                    g.FillEllipse(halo,14,14,68,68);
                }
            }
        }
        internal static void Arrow(Graphics g) {
            // An original swept dart: a different silhouette from the Windows
            // arrow, with a luminous face, blue-grey facet and a precise tip.
            using(GraphicsPath dart=new GraphicsPath()) {
                dart.AddLine(4,2,28,16);dart.AddBezier(28,16,29.5f,17,29,18,27.8f,18.2f);
                dart.AddLine(27.8f,18.2f,17.3f,19.6f);dart.AddLine(17.3f,19.6f,11.8f,28.5f);
                dart.AddBezier(11.8f,28.5f,11,29.8f,9.9f,29.3f,9.6f,27.8f);dart.AddLine(9.6f,27.8f,4,2);dart.CloseFigure();
                var original=g.Save();g.TranslateTransform(.4f,1.1f);
                using(SolidBrush shadow=new SolidBrush(Color.FromArgb(145,24,13,48)))g.FillPath(shadow,dart);g.Restore(original);
                using(LinearGradientBrush face=new LinearGradientBrush(new Point(4,2),new Point(23,29),Color.FromArgb(250,251,252),Color.FromArgb(130,175,201)))g.FillPath(face,dart);
                using(SolidBrush facet=new SolidBrush(Color.FromArgb(100,60,113,148)))g.FillPolygon(facet,new PointF[]{new PointF(5,4),new PointF(17.3f,19.6f),new PointF(10.8f,27.4f)});
                using(Pen outline=new Pen(Color.FromArgb(250,244,255),1.25f)){outline.LineJoin=LineJoin.Round;g.DrawPath(outline,dart);}
                using(Pen crease=new Pen(Color.FromArgb(95,46,80,106),.8f))g.DrawLine(crease,5,4,17.3f,19.6f);
                using(SolidBrush signal=new SolidBrush(Color.FromArgb(218,209,255,255)))g.FillEllipse(signal,16.1f,16.4f,2.4f,2.4f);
            }
        }
        internal const int HudWidth=384,HudHeight=44;
        internal static Rectangle ToggleRect {get {return new Rectangle(254,6,32,32);}}
        internal static Rectangle StopRect {get {return new Rectangle(294,6,78,32);}}
        internal static Rectangle ModeRect {get {return new Rectangle(214,6,32,32);}}
        static void Label(Graphics g,string text,float size,FontStyle style,Color color,RectangleF box) {
            using(Font font=new Font(Overlay.UiFont,size,style))
            using(SolidBrush brush=new SolidBrush(color))
            using(StringFormat format=new StringFormat()) {format.LineAlignment=StringAlignment.Center;format.Trimming=StringTrimming.EllipsisCharacter;format.FormatFlags=StringFormatFlags.NoWrap;g.DrawString(text,font,brush,box,format);}
        }
        internal static void Hud(Graphics g,string state,int hover,float phase,string activity=null) {
            g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            RectangleF panel=new RectangleF(1,1,HudWidth-2,HudHeight-2);Color accent=StateColor(state);
            using(GraphicsPath shape=Overlay.RoundRect(panel,21)) {
                using(LinearGradientBrush bg=new LinearGradientBrush(panel,Color.FromArgb(34,37,42),Color.FromArgb(25,28,32),90f))g.FillPath(bg,shape);
                using(Pen edge=new Pen(Color.FromArgb(65,164,178,191),1))g.DrawPath(edge,shape);
            }
            using(SolidBrush dot=new SolidBrush(Color.FromArgb(state=="active"?(int)(BreathLevel*255):220,accent)))g.FillEllipse(dot,16,19,6,6);
            string detail=state=="active"?(String.IsNullOrEmpty(activity)?"Antigravity is working":activity+" with Antigravity"):state=="paused"?"Paused · you have control":state=="stopped"?"Stopped · re-arm to begin":"Antigravity is ready";
            Label(g,detail,9,FontStyle.Regular,Color.FromArgb(234,237,239),new RectangleF(32,5,178,34));
            Rectangle hot=hover==1?ToggleRect:hover==2?StopRect:ModeRect;
            if(hover!=0)using(GraphicsPath r=Overlay.RoundRect(hot,16))using(SolidBrush b=new SolidBrush(hover==2?Color.FromArgb(68,43,48):Color.FromArgb(53,59,65)))g.FillPath(b,r);
            using(SolidBrush dots=new SolidBrush(Color.FromArgb(166,175,183)))for(int i=0;i<3;i++)g.FillEllipse(dots,223+i*5,21,2,2);
            using(Pen icon=new Pen(Color.FromArgb(220,227,232),1.6f)) {
                icon.StartCap=icon.EndCap=LineCap.Round;
                if(state=="active"){g.DrawLine(icon,267,17,267,27);g.DrawLine(icon,273,17,273,27);}
                else {g.DrawPolygon(icon,new Point[]{new Point(266,16),new Point(266,28),new Point(275,22)});}
            }
            using(Pen divider=new Pen(Color.FromArgb(40,180,193,202)))g.DrawLine(divider,290,13,290,31);
            using(SolidBrush b=new SolidBrush(hover==2?Color.FromArgb(245,159,165):Color.FromArgb(192,202,211)))g.FillRectangle(b,306,19,6,6);
            Label(g,"Stop",8.5f,FontStyle.Regular,Color.FromArgb(212,219,225),new RectangleF(320,6,42,32));
        }
        internal static void Export(string directory) {
            Directory.CreateDirectory(directory);
            foreach(float scale in new float[]{1,1.25f,2}) {
                int w=(int)(1200*scale),h=(int)(760*scale);
                using(Bitmap image=new Bitmap(w,h,PixelFormat.Format32bppArgb)) {
                    using(Graphics g=Graphics.FromImage(image)) {
                        g.SmoothingMode=SmoothingMode.AntiAlias;
                        g.Clear(Color.FromArgb(24,26,34));
                        // A fictional desktop, never a capture of the user's data.
                        using(SolidBrush panel=new SolidBrush(Color.FromArgb(33,36,47)))g.FillRectangle(panel,90*scale,135*scale,1020*scale,520*scale);
                        using(Font f=new Font(Overlay.UiFont,20*scale))
                        using(SolidBrush ink=new SolidBrush(Color.FromArgb(190,194,211)))g.DrawString("Desktop control · visual preview",f,ink,130*scale,180*scale);
                        Edge(g,new Rectangle(0,0,w,h),scale);
                        var state=g.Save();g.TranslateTransform((w-HudWidth*scale)/2,18*scale);g.ScaleTransform(scale,scale);Hud(g,"active",0,0);g.Restore(state);
                        state=g.Save();g.TranslateTransform(650*scale,400*scale);g.ScaleTransform(scale,scale);Pointer(g,0);
                        g.TranslateTransform(44,46);Arrow(g);
                        g.Restore(state);
                    }
                    image.Save(Path.Combine(directory,"desktop-"+scale.ToString(System.Globalization.CultureInfo.InvariantCulture)+".png"),ImageFormat.Png);
                }
            }
            foreach(string state in new string[]{"active","paused","stopped","idle"})
            using(Bitmap image=new Bitmap(HudWidth*2,HudHeight*2,PixelFormat.Format32bppArgb)) {
                using(Graphics g=Graphics.FromImage(image)){g.ScaleTransform(2,2);Hud(g,state,state=="paused"?1:0,0);}
                image.Save(Path.Combine(directory,"hud-"+state+".png"),ImageFormat.Png);
            }
            using(Bitmap image=new Bitmap(800,600,PixelFormat.Format32bppArgb)) {
                using(Graphics g=Graphics.FromImage(image)){g.SmoothingMode=SmoothingMode.AntiAlias;Edge(g,new Rectangle(0,0,800,600),1);}
                if(image.GetPixel(400,300).A!=0)throw new Exception("Edge glow obscures desktop center");
                if(image.GetPixel(400,8).A<=image.GetPixel(400,45).A)throw new Exception("Glow must fade inward");
                if(image.GetPixel(400,8).A>=210)throw new Exception("Glow became an opaque frame");
                image.Save(Path.Combine(directory,"edge-alpha.png"),ImageFormat.Png);
            }
            Console.WriteLine("Visual renders and alpha falloff checks passed.");
        }
    }
}
