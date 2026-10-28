import Foundation
import Darwin

func storageReply(_ value: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    FileHandle.standardOutput.write(data + Data([10]))
}

@main enum StorageMain {
    static func main() {
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            if args == ["identity"] { storageReply(["ok": true, "owner_uid": getuid()]); return }
            guard args.count == 2 else { throw PrivateStorageError(code: "bad_arguments", path: "", message: "Pass a storage operation and absolute directory.") }
            let mode = args[0]
            guard ["install", "data", "legacy", "verify", "verify-tree", "verify-data-tree", "lease"].contains(mode) else {
                throw PrivateStorageError(code: "bad_arguments", path: args[1], message: "Unknown storage operation.")
            }
            if mode == "lease" { try lease(args[1]); return }
            let root: String
            if mode.hasPrefix("verify") {
                root = try MacPrivateStorage.normalized(args[1])
                if mode == "verify" { try MacPrivateStorage.verify(root) } else { try MacPrivateStorage.verifyTree(root) }
            } else { root = try MacPrivateStorage.prepare(args[1]) }
            storageReply(["ok": true, "private_storage": true, "path": root])
        } catch let error as PrivateStorageError {
            storageReply(["ok": false, "error": ["code": error.code, "message": error.message, "path": error.path]])
            exit(1)
        } catch {
            storageReply(["ok": false, "error": ["code": "storage_permissions_failed", "message": String(describing: error)]])
            exit(1)
        }
    }
    static func lease(_ raw: String) throws {
        let root = try MacPrivateStorage.prepare(raw)
        let directory = open(root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
        guard directory >= 0 else { try MacPrivateStorage.reject("service_ownership_unavailable", root, "Cannot hold the data directory.") }
        defer { close(directory) }
        var identity = stat()
        guard fstat(directory, &identity) == 0 else { try MacPrivateStorage.reject("service_ownership_unavailable", root, "Cannot identify data directory.") }
        let lockPath = (root as NSString).appendingPathComponent(".controller-lease")
        let fd = open(lockPath, O_RDWR | O_CREAT | O_NOFOLLOW, 0o600)
        guard fd >= 0 else { try MacPrivateStorage.reject("service_ownership_unavailable", lockPath, "Cannot open controller lease.") }
        defer { close(fd) }
        var lockIdentity = stat()
        guard fstat(fd, &lockIdentity) == 0, lockIdentity.st_uid == getuid(), lockIdentity.st_mode & 0o077 == 0 else {
            try MacPrivateStorage.reject("service_ownership_unavailable", lockPath, "Controller lease file is not private.")
        }
        guard flock(fd, LOCK_EX | LOCK_NB) == 0 else {
            try MacPrivateStorage.reject("service_already_running", root, "Another controller owns this directory.")
        }
        defer { flock(fd, LOCK_UN) }
        storageReply(["ok": true, "lease_acquired": true, "pid": getpid()])
        let closed = DispatchSemaphore(value: 0)
        DispatchQueue.global().async { while readLine() != nil {} ; closed.signal() }
        while closed.wait(timeout: .now() + 0.1) == .timedOut {
            let current = try MacPrivateStorage.info(root)
            let currentLock = try MacPrivateStorage.info(lockPath)
            guard current.st_dev == identity.st_dev, current.st_ino == identity.st_ino,
                  currentLock.st_dev == lockIdentity.st_dev, currentLock.st_ino == lockIdentity.st_ino else {
                try MacPrivateStorage.reject("service_ownership_lost", root, "The held directory or lease was replaced. Control must stop.")
            }
        }
    }
}
