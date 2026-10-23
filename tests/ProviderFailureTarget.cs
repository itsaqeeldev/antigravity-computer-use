// Owned fault-injection target, not production UI or application acceptance.
// WPF peer contract: https://learn.microsoft.com/en-us/dotnet/desktop/wpf/controls/ui-automation-of-a-wpf-custom-control
// Invoke contract: https://learn.microsoft.com/dotnet/api/system.windows.automation.provider.iinvokeprovider.invoke
using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Interop;

public sealed class FailureButton : Button {
    public bool EffectBeforeFailure;
    public int Dispatches, Effects, PhysicalClicks;
    public TextBlock Evidence;
    public void Report() {
        Evidence.Text = (EffectBeforeFailure ? "After effect" : "Before effect") +
            ": dispatches=" + Dispatches + ", effects=" + Effects + ", physical=" + PhysicalClicks;
    }
    protected override AutomationPeer OnCreateAutomationPeer() { return new FailurePeer(this); }
    protected override void OnClick() { PhysicalClicks++; Effects++; Report(); base.OnClick(); }
}

public sealed class FailurePeer : ButtonAutomationPeer, IInvokeProvider {
    readonly FailureButton button;
    public FailurePeer(FailureButton owner) : base(owner) { button=owner; }
    public override object GetPattern(PatternInterface pattern) {
        return pattern==PatternInterface.Invoke ? this : base.GetPattern(pattern);
    }
    void IInvokeProvider.Invoke() {
        button.Dispatcher.Invoke(new Action(delegate {
            button.Dispatches++;
            if(button.EffectBeforeFailure)button.Effects++;
            button.Report();
        }));
        throw new InvalidOperationException("Deliberate owned-provider failure after dispatch; do not retry it.");
    }
}

public static class FailureTarget {
    [STAThread] public static void Main() {
        var app=new Application();
        var stack=new StackPanel { Margin=new Thickness(24) };
        stack.Children.Add(new TextBlock { Text="Owned provider error test. Never target another application.",Margin=new Thickness(0,0,0,16) });
        foreach(bool after in new bool[]{true,false}) {
            var evidence=new TextBlock { Margin=new Thickness(0,6,0,20),FontSize=16 };
            var button=new FailureButton { Content=after?"Dispatch then throw":"Refuse without effect",EffectBeforeFailure=after,Evidence=evidence,Height=54,FontSize=18 };
            AutomationProperties.SetAutomationId(button,after?"after-effect":"before-effect");
            button.Report();stack.Children.Add(button);stack.Children.Add(evidence);
        }
        var window=new Window { Title="AGCU Provider Failure Target "+Process.GetCurrentProcess().Id,Width=660,Height=330,Content=stack,WindowStartupLocation=WindowStartupLocation.CenterScreen };
        window.Loaded+=delegate { Console.WriteLine("{\"hwnd\":"+new WindowInteropHelper(window).Handle.ToInt64()+",\"pid\":"+Process.GetCurrentProcess().Id+"}");Console.Out.Flush(); };
        app.Run(window);
    }
}
