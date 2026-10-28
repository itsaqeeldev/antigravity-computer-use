// Original POSIX storage adapter. No desktop APIs, elevation or parent chmod.
import Foundation
import Darwin

struct PrivateStorageError: Error {
    let code: String
    let path: String
    let message: String
}

enum MacPrivateStorage {
    static let marker = ".agcu-private-storage"
    static func checkACL(_ path: String) throws {
        // POSIX mode bits alone cannot exclude extended ACL access. A standard
        // macOS deny-delete ACL is retained; any extended Allow entry refuses.
        // Do not edit parent ACLs or infer that mode 0700 overrules them.
        errno = 0
        guard let acl = acl_get_file(path, ACL_TYPE_EXTENDED) else {
            if errno == ENOENT || errno == ENOTSUP { return }
            try reject("storage_acl_unavailable", path, "Cannot inspect extended access permissions.")
        }
        defer { acl_free(UnsafeMutableRawPointer(acl)) }
        var entry: acl_entry_t?
        var cursor = Int32(ACL_FIRST_ENTRY.rawValue)
        while acl_get_entry(acl, cursor, &entry) == 0 {
            cursor = Int32(ACL_NEXT_ENTRY.rawValue)
            var tag = ACL_UNDEFINED_TAG
            guard acl_get_tag_type(entry, &tag) == 0 else { try reject("storage_acl_unavailable", path, "Cannot read extended access entry.") }
            if tag == ACL_EXTENDED_ALLOW { try reject("storage_unsafe_acl", path, "Extended Allow permissions need manual review. ACLs were not changed.") }
        }
    }
    static func reject(_ code: String, _ path: String, _ message: String) throws -> Never {
        throw PrivateStorageError(code: code, path: path, message: message)
    }
    static func info(_ path: String) throws -> stat {
        var value = stat()
        guard lstat(path, &value) == 0 else {
            try reject("storage_unavailable", path, "Cannot inspect the private path (errno \(errno)).")
        }
        return value
    }
    static func normalized(_ path: String) throws -> String {
        guard path.hasPrefix("/"), !path.contains("\0") else {
            try reject("storage_invalid_path", path, "An absolute local path is required.")
        }
        return URL(fileURLWithPath: path).standardizedFileURL.path
    }
    static func ancestors(_ raw: String) throws {
        var cursor = try normalized(raw)
        while true {
            if FileManager.default.fileExists(atPath: cursor) {
                let s = try info(cursor)
                guard (s.st_mode & S_IFMT) == S_IFDIR else {
                    try reject("storage_reparse_point", cursor, "Directory links and non-directory ancestors are refused.")
                }
                guard s.st_uid == getuid() || s.st_uid == 0 else {
                    try reject("storage_untrusted_owner", cursor, "An unrelated account owns this ancestor.")
                }
                guard s.st_mode & 0o022 == 0 else {
                    try reject("storage_unsafe_ancestor", cursor, "Another account can replace this path. Parent permissions were not changed.")
                }
                try checkACL(cursor)
            }
            if cursor == "/" { break }
            cursor = URL(fileURLWithPath: cursor).deletingLastPathComponent().path
        }
    }
    static func dedicated(_ root: String) -> Bool {
        let file = (root as NSString).appendingPathComponent(marker)
        guard let s = try? info(file), s.st_uid == getuid(), s.st_mode & S_IFMT == S_IFREG,
              s.st_mode & 0o077 == 0,
              let value = try? String(contentsOfFile: file, encoding: .utf8) else { return false }
        return value == "agcu-posix-v1:\(getuid())\n"
    }
    static func prepare(_ raw: String) throws -> String {
        let root = try normalized(raw)
        guard root != "/" else { try reject("storage_invalid_path", root, "A volume root cannot be private application storage.") }
        let parent = URL(fileURLWithPath: root).deletingLastPathComponent().path
        try ancestors(parent)
        if !FileManager.default.fileExists(atPath: root) {
            try FileManager.default.createDirectory(atPath: root, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        } else {
            let s = try info(root)
            try checkACL(root)
            guard s.st_mode & S_IFMT == S_IFDIR, s.st_uid == getuid() else {
                try reject("storage_untrusted_owner", root, "The private directory must be a real directory owned by this account.")
            }
            let entries = try FileManager.default.contentsOfDirectory(atPath: root)
            let package = URL(fileURLWithPath: parent).appendingPathComponent("package.json")
            let sourceData = URL(fileURLWithPath: root).lastPathComponent == ".localdata" &&
                ((try? Data(contentsOf: package)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["name"] as? String) == "antigravity-native-computer-use"
            guard entries.isEmpty || dedicated(root) || sourceData else {
                try reject("storage_not_dedicated", root, "Refusing to change permissions on unrelated existing data.")
            }
            // Only the dedicated leaf is tightened. Never an ancestor.
            guard chmod(root, 0o700) == 0 else { try reject("storage_permissions_failed", root, "Cannot make the application directory private.") }
        }
        try ancestors(root)
        let file = (root as NSString).appendingPathComponent(marker)
        if !FileManager.default.fileExists(atPath: file) {
            let fd = open(file, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
            guard fd >= 0 else { try reject("storage_permissions_failed", file, "Cannot create private storage marker.") }
            let value = Data("agcu-posix-v1:\(getuid())\n".utf8)
            let wrote = value.withUnsafeBytes { write(fd, $0.baseAddress, value.count) }
            close(fd)
            guard wrote == value.count else { try reject("storage_permissions_failed", file, "Cannot write storage marker.") }
        }
        try verify(root)
        return root
    }
    static func verify(_ raw: String) throws {
        let root = try normalized(raw)
        try ancestors(root)
        let s = try info(root)
        try checkACL(root)
        guard s.st_uid == getuid(), s.st_mode & 0o077 == 0, dedicated(root) else {
            try reject("storage_permissions_failed", root, "Application storage is not private and owned by this account.")
        }
    }
    static func verifyTree(_ raw: String) throws {
        let root = try normalized(raw)
        try verify(root)
        guard let enumerator = FileManager.default.enumerator(atPath: root) else {
            try reject("storage_unavailable", root, "Cannot enumerate private storage.")
        }
        for case let relative as String in enumerator {
            let file = (root as NSString).appendingPathComponent(relative)
            let s = try info(file)
            try checkACL(file)
            guard s.st_uid == getuid(), s.st_mode & 0o022 == 0,
                  s.st_mode & S_IFMT == S_IFDIR || s.st_mode & S_IFMT == S_IFREG else {
                try reject("storage_permissions_failed", file, "Private storage contains a link, foreign owner or writable entry.")
            }
        }
    }
}
