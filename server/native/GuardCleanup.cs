using System;

// Stop cleanup is best-effort per operation: one failed cleanup must not
// prevent the remaining independent safety actions from being attempted.
internal static class GuardCleanup {
    internal static void Run(params Action[] actions) {
        foreach (Action action in actions) try { action(); } catch { }
    }
}
