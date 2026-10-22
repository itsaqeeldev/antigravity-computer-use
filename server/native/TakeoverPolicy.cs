// Pure takeover policy, separate from Windows hooks so jitter/intent can be
// tested without faking human input or sending desktop events.
using System;
using System.Diagnostics;

namespace Axon {
    internal struct PhysicalInputSample {
        internal long Commits, Moves, MotionX, MotionY, LastMoveAt;
    }
    internal sealed class PhysicalInputAccumulator {
        PhysicalInputSample sample;
        bool pointKnown;int lastX,lastY;
        internal PhysicalInputSample Capture() {return sample;}
        internal void Mouse(uint message,bool injected,int x,int y,long now) {
            if(!injected) {
                if(message==0x0200) {
                    if(pointKnown){sample.MotionX+=(long)x-lastX;sample.MotionY+=(long)y-lastY;}
                    sample.Moves++;sample.LastMoveAt=now;
                }
                if(message==0x0201||message==0x0204||message==0x0207||message==0x020B||message==0x020A||message==0x020E)sample.Commits++;
            }
            pointKnown=true;lastX=x;lastY=y;
        }
        internal void Key(uint message,bool injected) {if(!injected&&(message==0x0100||message==0x0104))sample.Commits++;}
    }
    internal sealed class TakeoverPolicy {
        internal string Mode {get;private set;}
        long commits,moves,anchorMoves,anchorX,anchorY,firstMove=-1;
        internal static long NowMs {get {return (long)(Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency);}}
        internal TakeoverPolicy(string mode) {Mode=mode=="smart"?"smart":"manual";}
        internal void SetMode(string mode,PhysicalInputSample sample) {Mode=mode=="smart"?"smart":"manual";Reset(sample);}
        internal void Reset(PhysicalInputSample sample) {
            commits=sample.Commits;moves=sample.Moves;anchorMoves=sample.Moves;
            anchorX=sample.MotionX;anchorY=sample.MotionY;firstMove=-1;
        }
        internal bool ShouldPause(PhysicalInputSample sample,long now,float scale) {
            if(Mode=="manual") {Reset(sample);return false;}
            if(sample.Commits!=commits) {Reset(sample);return true;}
            if(now-sample.LastMoveAt>250 || now<sample.LastMoveAt) {Reset(sample);return false;}
            if(sample.Moves!=moves) {if(firstMove<0)firstMove=now;moves=sample.Moves;}
            double displacement=Math.Max(Math.Abs(sample.MotionX-anchorX),Math.Abs(sample.MotionY-anchorY));
            double threshold=32*Math.Max(.5,Math.Min(4,scale));
            // At least three real movements, a meaningful excursion and time
            // sustained across samples. Back-and-forth 1px jitter cancels out.
            if(firstMove>=0 && now-firstMove>=160 && sample.Moves-anchorMoves>=3 && displacement>=threshold) {
                Reset(sample);return true;
            }
            return false;
        }
    }
}
