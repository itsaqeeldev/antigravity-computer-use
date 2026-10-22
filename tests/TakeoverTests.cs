using System;using Axon;
internal static class TakeoverTests {
    static int count;
    static void Check(bool ok,string name) {if(!ok)throw new Exception(name);count++;Console.WriteLine("PASS "+name);}
    static PhysicalInputSample Move(long moves,long x,long y,long time) {return new PhysicalInputSample{Moves=moves,MotionX=x,MotionY=y,LastMoveAt=time};}
    static int Main() {
        try {
            var p=new TakeoverPolicy("manual");p.Reset(new PhysicalInputSample());
            Check(!p.ShouldPause(new PhysicalInputSample{Commits=4,Moves=100,MotionX=999,LastMoveAt=200},200,1),"manual mode ignores physical mouse/keyboard commits");
            p=new TakeoverPolicy("smart");p.Reset(new PhysicalInputSample());
            bool tripped=false;for(int i=1;i<100;i++)tripped|=p.ShouldPause(Move(i,i%2,0,i*10),i*10,1);
            Check(!tripped,"back-and-forth pointer jitter never accumulates into takeover");
            p.Reset(new PhysicalInputSample());Check(!p.ShouldPause(Move(1,5,0,100),100,1),"single light mouse movement ignored");
            Check(!p.ShouldPause(Move(1,5,0,100),500,1),"quiet movement does not become a delayed pause");
            p.Reset(new PhysicalInputSample());p.ShouldPause(Move(1,10,0,100),100,1);p.ShouldPause(Move(2,24,0,200),200,1);
            Check(p.ShouldPause(Move(3,36,0,300),300,1),"sustained meaningful mouse movement pauses in smart mode");
            p.Reset(new PhysicalInputSample());Check(p.ShouldPause(new PhysicalInputSample{Commits=1},100,1),"deliberate input pauses smart mode immediately");
            p.Reset(new PhysicalInputSample{Commits=5});Check(!p.ShouldPause(new PhysicalInputSample{Commits=5},100,1),"resume resets old commits rather than immediately pausing again");
            p.Reset(new PhysicalInputSample());p.ShouldPause(Move(1,15,0,100),100,2);p.ShouldPause(Move(2,35,0,200),200,2);
            Check(!p.ShouldPause(Move(3,60,0,300),300,2),"movement threshold scales with DPI");
            Check(p.ShouldPause(Move(4,66,0,350),350,2),"DPI-scaled threshold still detects intent");
            var input=new PhysicalInputAccumulator();input.Mouse(0x0200,true,10,10,0);input.Mouse(0x0200,true,1600,900,10);input.Mouse(0x0200,false,1602,901,20);
            Check(input.Capture().MotionX==2&&input.Capture().MotionY==1,"agent cursor warp is not charged to a tiny human movement");
            input.Key(0x0100,true);input.Mouse(0x0201,true,1602,901,30);Check(input.Capture().Commits==0,"injected keys and clicks never count as human takeover");
            input.Key(0x0101,false);input.Mouse(0x0202,false,1602,901,40);Check(input.Capture().Commits==0,"key and button release do not retrigger pause after resume");
            input.Key(0x0100,false);input.Mouse(0x0201,false,1602,901,50);input.Mouse(0x020A,false,1602,901,60);Check(input.Capture().Commits==3,"physical typing clicking and wheel are deliberate commits");
            p.SetMode("manual",input.Capture());Check(!p.ShouldPause(new PhysicalInputSample{Commits=20},100,1),"switching to manual suppresses automatic pause");
            p.SetMode("smart",new PhysicalInputSample{Commits=20});Check(!p.ShouldPause(new PhysicalInputSample{Commits=20},110,1),"switching to smart discards historical physical events");
            Console.WriteLine("TOTAL "+count);return 0;
        }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
    }
}
