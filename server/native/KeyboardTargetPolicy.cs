// A child input surface belongs to its containing top-level window. Owner
// chains are deliberately excluded: another document/dialog is not the target.
namespace Axon {
    internal static class KeyboardTargetPolicy {
        internal static bool Same(long expected,long actual,long expectedRoot,long actualRoot) {
            if(expected==0||actual==0)return false;
            if(expected==actual)return true;
            return expectedRoot!=0&&actualRoot==expectedRoot;
        }
    }
}
