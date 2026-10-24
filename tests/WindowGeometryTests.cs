using System;using System.Drawing;using Axon;
class WindowGeometryTests {
 static int n;static void Check(bool value,string name){if(!value)throw new Exception(name);n++;}
 static int Main(){try{
  Rectangle work=new Rectangle(0,0,1920,1040);
  Check(WindowGeometry.Fit(new Rectangle(525,-787,473,1053),work)==new Rectangle(525,0,473,1040),"Reported offscreen emulator is moved and bounded");
  Check(WindowGeometry.Fit(new Rectangle(10,20,800,600),work)==new Rectangle(10,20,800,600),"Visible placement is preserved");
  Check(WindowGeometry.Fit(new Rectangle(1900,1000,800,600),work)==new Rectangle(1120,440,800,600),"Right and bottom edges clamp");
  Check(WindowGeometry.Fit(new Rectangle(300,-900,3000,2000),work)==work,"Oversized bounds shrink to work area");
  Rectangle left=new Rectangle(-2560,-300,2560,1400);Check(WindowGeometry.Fit(new Rectangle(-3000,-800,1000,900),left)==new Rectangle(-2560,-300,1000,900),"Negative monitor origins remain valid");
  Rectangle[] displays={new Rectangle(-1920,0,1920,1080),new Rectangle(0,0,2560,1440)};
  Check(WindowGeometry.Reachable(new Point(-1800,1000),displays),"Negative display pixel is reachable");
  Check(!WindowGeometry.Reachable(new Point(-1800,1300),displays),"A virtual bounding-box gap is not a physical pixel");
  Check(!WindowGeometry.Reachable(new Point(2560,10),displays),"Right boundary is exclusive");
  bool refused=false;try{WindowGeometry.Fit(Rectangle.Empty,work);}catch(ArgumentOutOfRangeException){refused=true;}Check(refused,"Invalid bounds refuse");
  Console.WriteLine("TOTAL "+n);return 0;
 }catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
