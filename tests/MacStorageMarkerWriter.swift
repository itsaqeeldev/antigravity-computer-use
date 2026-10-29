// Inert producer for native storage concurrency qualification. No desktop APIs.
import Foundation
import Darwin

@main enum MarkerWriter {
    static func main() throws {
        let root = CommandLine.arguments[1]
        let directory = open(root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
        guard directory >= 0 else { exit(1) }
        defer { close(directory) }
        var info = stat()
        guard fstat(directory, &info) == 0, info.st_uid == getuid(), info.st_mode & 0o077 == 0,
              try FileManager.default.contentsOfDirectory(atPath: root).isEmpty,
              flock(directory, LOCK_EX) == 0 else { exit(2) }
        defer { flock(directory, LOCK_UN) }
        let file = openat(directory, ".agcu-private-storage", O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        guard file >= 0 else { exit(3) }
        defer { close(file) }
        print("marker-open"); fflush(stdout)
        guard readLine() == "commit" else { exit(4) }
        let bytes = Data("agcu-posix-v1:\(getuid())\n".utf8)
        guard bytes.withUnsafeBytes({ write(file, $0.baseAddress, bytes.count) }) == bytes.count,
              fsync(file) == 0 else { exit(5) }
    }
}
