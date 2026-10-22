using System;using System.Drawing;using System.Collections.Generic;using Axon;
internal static class CursorMotionTests {
    static int count;
    static void Check(bool value,string name){if(!value)throw new Exception(name);count++;Console.WriteLine("PASS "+name);}
    static int Main(){try {
        var path=new CursorPath(new Point(-1600,1000),new Point(1800,-200),1.25f,true);
        Check(path.At(0)==new Point(-1600,1000)&&path.At(1)==new Point(1800,-200),"exact endpoints across negative monitor origins");
        Check(path.DurationMs>=120&&path.DurationMs<=600,"travel duration is bounded");
        Point previous=path.At(0);bool monotonic=true;
        for(int i=1;i<=100;i++){Point p=path.At(i/100.0);monotonic&=p.X>=previous.X&&p.Y<=previous.Y&&p.X<=1800&&p.Y>=-200;previous=p;}
        Check(monotonic,"trajectory is monotonic with no overshoot");
        var shortPath=new CursorPath(new Point(0,0),new Point(1000,0),1,true);
        Check(shortPath.At(.05).X<10&&shortPath.At(.95).X>990,"movement eases in and out rather than teleporting");
        double now=0;var points=new List<Point>();int guards=0;
        int frames=shortPath.Run(points.Add,delegate {guards++;},delegate {return now;},delegate(int delay){now+=delay;});
        Check(frames>10&&points.Count==frames&&points[points.Count-1]==new Point(1000,0),"multiple timed position updates end at the exact target");
        Check(guards==frames,"every position update is checked by the cancellation fence");
        now=0;points.Clear();guards=0;bool cancelled=false;
        try {shortPath.Run(points.Add,delegate {if(++guards==5)throw new OperationCanceledException();},delegate{return now;},delegate(int delay){now+=delay;});}catch(OperationCanceledException){cancelled=true;}
        Check(cancelled&&points.Count==4&&points[points.Count-1].X<1000,"cancellation stops mid-flight without a final target jump");
        var reduced=new CursorPath(Point.Empty,new Point(1000,500),1,false);Check(reduced.DurationMs==0,"reduced-motion preference disables decorative travel");
        points.Clear();cancelled=false;try{reduced.Run(points.Add,delegate {throw new OperationCanceledException();},delegate{return 0;},delegate(int delay){});}catch(OperationCanceledException){cancelled=true;}
        Check(cancelled&&points.Count==0,"even immediate motion cannot bypass cancellation");
        Check(new CursorPath(Point.Empty,new Point(1,1),1,true).DurationMs==0,"tiny corrections do not add a slow animation");
        Rectangle desktop=new Rectangle(-1920,-1080,3840,2160);bool mapped=true;
        foreach(Point p in new Point[]{new Point(-1920,-1080),new Point(1919,1079),new Point(0,0),new Point(-600,322)}) {
            Point n=CursorPath.Normalize(p,desktop);Point decoded=new Point(desktop.Left+(int)((long)n.X*desktop.Width/65536),desktop.Top+(int)((long)n.Y*desktop.Height/65536));mapped&=decoded==p;
        }
        Check(mapped,"absolute input mapping hits pixel centers across negative monitor origins");
        Console.WriteLine("TOTAL "+count);return 0;
    }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
