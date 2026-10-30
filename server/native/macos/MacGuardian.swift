// Native consent/Stop authority. No approval Boolean exists in the action API.
import AppKit
import ApplicationServices
import CoreGraphics
import Darwin
import Foundation

enum MacWorkers {
    static func start(_ args: [String]) throws -> Process {
        let child = Process(); child.executableURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
        child.arguments = args; child.environment = ProcessInfo.processInfo.environment
        let output = Pipe(); child.standardOutput = output; child.standardError = FileHandle.standardError
        try child.run()
        let ready = DispatchSemaphore(value:0); var line: String?
        DispatchQueue.global().async { line = String(data:output.fileHandleForReading.availableData,encoding:.utf8); ready.signal() }
        guard ready.wait(timeout:.now()+5) == .success, line?.contains("watchdog_ready") == true else {
            if child.isRunning { child.terminate() }
            throw AxonError("stop_monitor_unavailable", "Independent Stop monitoring did not start. Check Input Monitoring permission.")
        }
        return child
    }
}

final class MacPanicMonitor {
    var tap: CFMachPort?
    var baseline: CGPoint?
    var moved: Double = 0
    var at = Date()
    var expiredKey: String?
    var expiredSince: UInt64 = 0
    var invalidSince: UInt64?
    static func deadlineGraceElapsed(since: UInt64, now: UInt64) -> Bool {
        now >= since && now - since >= 5000
    }
    func checkDeadline() {
        guard let state = try? MacFence.read() else {
            let now = MacDeadline.now
            if invalidSince == nil { invalidSince = now; return }
            if let since = invalidSince, now >= since, now - since >= 1000, (try? MacFence.read()) == nil {
                MacFence.emergency("watchdog_state_unavailable"); invalidSince = nil
            }
            return
        }
        invalidSince = nil
        guard state.state == "active",
              !MacDeadline.valid(state.bootUntil, now: MacDeadline.now) else {
            expiredKey = nil; expiredSince = 0; return
        }
        let key = state.token + "|" + String(state.bootUntil), now = MacDeadline.now
        if expiredKey != key { expiredKey = key; expiredSince = now; return }
        guard Self.deadlineGraceElapsed(since: expiredSince, now: now),
              let latest = try? MacFence.read(), latest.state == "active",
              latest.token == state.token, latest.bootUntil == state.bootUntil,
              !MacDeadline.valid(latest.bootUntil, now: MacDeadline.now) else { return }
        MacFence.emergency("watchdog_deadline_expired")
        expiredKey = nil; expiredSince = 0
    }
    func start() -> Bool {
        let mask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.mouseMoved.rawValue) |
            (1 << CGEventType.leftMouseDown.rawValue) | (1 << CGEventType.rightMouseDown.rawValue) | (1 << CGEventType.scrollWheel.rawValue)
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly,
                               eventsOfInterest: CGEventMask(mask), callback: { _, type, event, pointer in
            let monitor = Unmanaged<MacPanicMonitor>.fromOpaque(pointer!).takeUnretainedValue()
            if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
                if let tap = monitor.tap { CGEvent.tapEnable(tap: tap, enable: true) }
                MacFence.emergency("event_tap_disabled")
            } else { monitor.receive(type, event) }
            return Unmanaged.passUnretained(event)
        }, userInfo: Unmanaged.passUnretained(self).toOpaque())
        guard let tap = tap, let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else { return false }
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes); CGEvent.tapEnable(tap: tap, enable: true)
        return true
    }
    func receive(_ type: CGEventType, _ event: CGEvent) {
        if event.getIntegerValueField(.eventSourceUserData) == AXON_EVENT_MARKER { return }
        guard let state = try? MacFence.read(), ["active", "paused"].contains(state.state) else { return }
        let key = event.getIntegerValueField(.keyboardEventKeycode)
        if type == .keyDown && (key == 53 || (key == 111 && event.flags.contains([.maskControl, .maskAlternate]))) {
            MacFence.emergency("escape"); return
        }
        guard state.state == "active" else { return }
        let preferences = (URL(fileURLWithPath: MacFence.file).deletingLastPathComponent()).appendingPathComponent("control-preferences.json")
        let mode = (try? Data(contentsOf: preferences)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }?["takeover_mode"] as? String ?? "manual"
        guard mode == "smart" else { return }
        // Local controls must remain usable without the takeover hook racing them.
        if let bytes = try? Data(contentsOf: URL(fileURLWithPath: MacFence.file + ".hud")),
           let r = try? JSONSerialization.jsonObject(with: bytes) as? [Double], r.count == 4,
           CGRect(x: r[0], y: r[1], width: r[2], height: r[3]).contains(event.location) { return }
        var deliberate = type != .mouseMoved
        if type == .mouseMoved {
            if Date().timeIntervalSince(at) > 0.5 { moved = 0; at = Date(); baseline = event.location }
            if let previous = baseline { moved += hypot(event.location.x - previous.x, event.location.y - previous.y) }
            baseline = event.location; deliberate = moved >= 70
        }
        if deliberate {
            try? MacFence.write("paused|\(state.token)|\(state.until)|\(Data(state.grants.sorted().joined(separator: "\n").utf8).base64EncodedString())")
            macKillWorkers(); _ = MacInputLedger.recover()
        }
    }
    func run(guardian: pid_t, birth: String) -> Never {
        guard start() else { emit(["ev": "error", "message": "Input Monitoring permission is required for independent Stop."]); exit(1) }
        do {
            let marker = MacFence.file + ".watchdog"
            try Data("\(getpid())|\(try macProcessStart(getpid()))".utf8).write(to: URL(fileURLWithPath: marker), options: [.atomic])
            guard chmod(marker, 0o600) == 0 else { throw AxonError("stop_monitor_unavailable", "Cannot protect watchdog identity.") }
            let fd = open(marker, O_RDWR | O_NOFOLLOW); guard fd >= 0 else { throw AxonError("stop_monitor_unavailable", "Cannot open watchdog identity.") }
            defer { close(fd) }
            var info = stat()
            guard fstat(fd, &info) == 0, info.st_uid == getuid(), info.st_mode & S_IFMT == S_IFREG,
                  info.st_mode & 0o077 == 0, info.st_nlink == 1, fsync(fd) == 0 else {
                throw AxonError("stop_monitor_unavailable", "Cannot confirm watchdog identity.")
            }
        } catch { emit(["ev":"error", "message":"Independent Stop monitoring could not record its identity."]); exit(1) }
        emit(["watchdog_ready": true])
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            let parent = pid_t(ProcessInfo.processInfo.environment["AGCU_PARENT_PID"] ?? "0") ?? 0
            if (try? macProcessStart(guardian)) != birth || (try? macProcessStart(parent)) != MacFence.parentIdentity {
                if (try? MacFence.read().state) != "idle" { MacFence.emergency("guardian_exited") }
                else { macKillWorkers(); if !MacInputLedger.recover() { MacFence.emergency("input_cleanup_failed") } }
                exit(0)
            }
            self.checkDeadline()
        }
        RunLoop.current.run(); exit(0)
    }
}

final class MacGuardian: NSObject {
    var state = "idle", token = "", until: Int64 = 0
    var bootUntil: UInt64 = 0
    var grants = Set<String>()
    var watchdog: Process?
    var timer: Timer?
    var visuals = MacVisuals()
    var prompt: NSAlert?
    var controlsUntil = Date.distantFuture
    let hostManaged = ProcessInfo.processInfo.environment["AGCU_PERMISSION_MODE"] == "host-managed"
    func run() throws -> Never {
        _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
        try Data("\(getpid())|\(try macProcessStart(getpid()))".utf8).write(to: URL(fileURLWithPath: MacFence.file + ".guardian"), options: [.atomic])
        chmod(MacFence.file + ".guardian", 0o600)
        visuals.onToggle = { [weak self] in self?.humanToggle() }
        visuals.onStop = { [weak self] in self?.stop("button") }
        visuals.onMode = { [weak self] mode in self?.saveMode(mode) }
        state = !MacFence.latch.isEmpty && FileManager.default.fileExists(atPath: MacFence.latch) ? "stopped" : "idle"
        try writeState(); visuals.hide()
        emit(["ev": "settings", "takeover_mode": takeoverMode()])
        emit(["ev": "ready", "pid": Int(getpid()), "hotkey": false, "presence": false, "platform": "darwin"])
        timer = Timer(timeInterval: 0.07, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(timer!, forMode: .common); RunLoop.main.add(timer!, forMode: .modalPanel)
        Thread.detachNewThread { [weak self] in
            while let line = readLine() {
                guard line.utf8.count <= 1_048_576, let bytes = line.data(using: .utf8),
                      let message = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else { continue }
                DispatchQueue.main.async { self?.receive(message) }
            }
            DispatchQueue.main.async {
                if self?.state != "idle" { self?.stop("controller_exited") }
                self?.visuals.hide(); exit(0)
            }
        }
        NSApp.run(); exit(0)
    }
    func takeoverMode() -> String {
        let path = URL(fileURLWithPath: MacFence.file).deletingLastPathComponent().appendingPathComponent("control-preferences.json")
        let value = (try? Data(contentsOf: path)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        return value?["takeover_mode"] as? String == "smart" ? "smart" : "manual"
    }
    func saveMode(_ mode: String) {
        let path = URL(fileURLWithPath: MacFence.file).deletingLastPathComponent().appendingPathComponent("control-preferences.json")
        var value = (try? Data(contentsOf: path)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        value["takeover_mode"] = mode
        if let bytes = try? JSONSerialization.data(withJSONObject: value) { try? bytes.write(to: path, options: [.atomic]); chmod(path.path, 0o600) }
        emit(["ev": "settings", "takeover_mode": takeoverMode()])
    }
    func ensureWatchdog() throws {
        guard AXIsProcessTrusted(), CGPreflightScreenCaptureAccess(), CGPreflightListenEventAccess(), CGPreflightPostEventAccess() else {
            throw AxonError("mac_permissions_required", "Open the installed Mac setup application and grant Accessibility, Screen Recording and Input Monitoring yourself. Control has not started.")
        }
        if watchdog?.isRunning == true { return }
        watchdog = try MacWorkers.start(["--mac-watchdog", String(getpid()), try macProcessStart(getpid())])
    }
    func writeState() throws {
        let encoded = Data(grants.sorted().joined(separator: "\n").utf8).base64EncodedString()
        try MacFence.write("\(state)|\(token)|\(until)|\(encoded)|\(bootUntil)")
    }
    func set(_ next: String, reason: String = "") {
        if next == "active" && (!MacFence.latch.isEmpty && FileManager.default.fileExists(atPath: MacFence.latch) || state == "stopped") { return }
        var effectiveReason = reason
        state = next
        if next == "stopped" || next == "idle" { grants.removeAll() }
        do { try writeState() } catch { state = "stopped"; MacFence.emergency("state_write_failed") }
        // The independent watchdog may latch Stop while this transition is
        // being published. Recheck after the write so a stale idle/paused
        // transition cannot leave the local UI claiming control is available.
        let resolved = MacFence.resolvedState(state, latched: !MacFence.latch.isEmpty && FileManager.default.fileExists(atPath: MacFence.latch))
        if resolved != state {
            state = resolved; grants.removeAll(); effectiveReason = "emergency_stop"
            do { try writeState() } catch { MacFence.emergency("state_write_failed") }
        }
        if state != "active" {
            macKillWorkers()
            if !MacInputLedger.recover() { state = "stopped"; grants.removeAll(); effectiveReason = "input_cleanup_failed"; MacFence.emergency(effectiveReason) }
            visuals.releaseCursor()
        }
        if state == "idle" { visuals.hide() }
        else { visuals.show(state); controlsUntil = state == "stopped" ? Date().addingTimeInterval(8) : .distantFuture }
        emit(["ev": "state", "state": state, "reason": effectiveReason, "custom_cursor": visuals.cursorApplied])
    }
    func stop(_ reason: String) { MacFence.emergency(reason); set("stopped", reason: reason) }
    func humanToggle() {
        if state == "active" { set("paused", reason: "requested_pause"); return }
        do { try ensureWatchdog() } catch { emit(["ev":"visual_warning", "message":String(describing:error)]); return }
        guard MacInputLedger.recover() else { return }
        until = MacFenceState.now + Int64(MacContract.value["session_ms"] as? Int ?? 600_000) * 10_000
        bootUntil = MacDeadline.create(requested: until, wallNow: MacFenceState.now, bootNow: MacDeadline.now, maximumMs: MacContract.value["session_ms"] as? Int ?? 600_000)
        guard bootUntil > 0 else { return }
        if state == "stopped" && !MacFence.latch.isEmpty {
            do { if FileManager.default.fileExists(atPath: MacFence.latch) { try FileManager.default.removeItem(atPath: MacFence.latch) } } catch { return }
        }
        set(state == "paused" ? "active" : "idle", reason: "human_resume")
        emit(["ev": "human_resume", "state": state])
    }
    func tick() {
        if Date() > controlsUntil { visuals.hide(); controlsUntil = .distantFuture }
        guard let stored = try? MacFence.read() else { if state == "active" { stop("state_unavailable") }; return }
        if stored.state == "stopped" && state != "stopped" { if prompt != nil { NSApp.abortModal() }; set("stopped", reason: "escape") }
        if stored.state == "paused" && state == "active" { set("paused", reason: "human_takeover") }
        if state == "active" {
            if watchdog?.isRunning != true { stop("watchdog_exited"); return }
            if MacFenceState.now >= until || !MacDeadline.valid(bootUntil, now: MacDeadline.now) { set("idle", reason: "expired"); return }
            visuals.animate()
        }
        let parent = pid_t(ProcessInfo.processInfo.environment["AGCU_PARENT_PID"] ?? "0") ?? 0
        if (try? macProcessStart(parent)) != MacFence.parentIdentity {
            if state != "idle" { stop("parent_exited") }; visuals.hide(); exit(0)
        }
    }
    func receive(_ message: [String: Any]) {
        let op = str(message["op"]) ?? "", id = message["id"] ?? NSNull()
        func reply(_ extra: [String: Any] = [:]) { emit(extra.merging(["id": id, "state": state]) { _, new in new }) }
        do {
            switch op {
            case "visual_status": reply(["controls_visible": visuals.visible, "cursor": state == "active", "takeover_mode": takeoverMode()])
            case "show_controls": visuals.show(state); controlsUntil = Date().addingTimeInterval(state == "idle" || state == "stopped" ? 30 : 600); reply(["controls_visible": true, "human_rearm_required": state == "stopped"])
            case "dismiss_controls": if ["active", "paused"].contains(state) { stop("dismiss") }; visuals.hide(); reply(["controls_visible": false])
            case "attach": reply(["registered": true]) // worker self-registers before reporting ready
            case "activate":
                guard state != "stopped", state != "paused", MacInputLedger.recover() else { reply(["allowed": false]); return }
                try ensureWatchdog(); let nextToken = str(message["token"]) ?? "", requested = Int64(str(message["deadline"]) ?? "0") ?? 0
                let nextBoot = MacDeadline.create(requested: requested, wallNow: MacFenceState.now, bootNow: MacDeadline.now, maximumMs: MacContract.value["session_ms"] as? Int ?? 600_000)
                guard !nextToken.isEmpty, nextBoot > 0 else { reply(["allowed": false]); return }
                token = nextToken; until = requested; bootUntil = nextBoot
                set("active"); reply(["allowed": state == "active"])
            case "resume":
                guard hostManaged, state == "paused", MacInputLedger.recover() else { reply(["allowed": false]); return }
                try ensureWatchdog(); until = MacFenceState.now + 6_000_000_000
                bootUntil = MacDeadline.create(requested: until, wallNow: MacFenceState.now, bootNow: MacDeadline.now, maximumMs: MacContract.value["session_ms"] as? Int ?? 600_000)
                guard bootUntil > 0 else { reply(["allowed": false]); return }
                set("active", reason: "host_authorized_resume")
                emit(["ev": "host_resume", "state": state]); reply(["allowed": state == "active"])
            case "pause": set("paused", reason: "requested_pause")
            case "stop": stop("request")
            case "end": grants.removeAll(); set(["stopped", "paused"].contains(state) ? state : "idle"); visuals.hide(); reply(["controls_visible": false])
            case "capture": visuals.hideForCapture(); reply(["allowed": true])
            case "capture_end": visuals.finishCapture(state)
            case "activity": visuals.activity(str(message["action"]) ?? "Checking")
            case "shutdown": if state != "idle" { stop("shutdown") }; visuals.hide(); watchdog?.terminate(); exit(0)
            case "prompt":
                guard state != "stopped", state != "paused" else { reply(["allowed": false]); return }
                try ensureWatchdog()
                let kind = str(message["kind"]) ?? ""
                var identity: [String: Any]?
                if kind == "app" { identity = try macIdentity(pid_t(int(message["app_pid"], -1))) }
                var allowed = hostManaged
                if !hostManaged {
                    visuals.hideForCapture()
                    let alert = NSAlert(); alert.messageText = kind == "app" ? "Allow this app for this session?" : "Allow one sensitive action?"
                    alert.informativeText = String((identity?["path"] as? String ?? "") + "\n\n" + (str(message["message"]) ?? "").prefix(6000))
                    alert.addButton(withTitle: "Deny"); alert.addButton(withTitle: "Allow")
                    prompt = alert
                    let expiry = Timer(timeInterval: 90, repeats: false) { _ in NSApp.abortModal() }
                    RunLoop.main.add(expiry, forMode: .common); RunLoop.main.add(expiry, forMode: .modalPanel)
                    allowed = alert.runModal() == .alertSecondButtonReturn
                    expiry.invalidate(); prompt = nil; visuals.finishCapture(state)
                }
                if state == "stopped" || !MacFence.latch.isEmpty && FileManager.default.fileExists(atPath: MacFence.latch) { allowed = false }
                var result: [String: Any] = ["allowed": allowed, "decision": allowed ? (hostManaged ? "host-authorized" : "allowed") : "denied"]
                if allowed && kind == "app", let identity = identity {
                    let current = try macIdentity(pid_t(identity["pid"] as! Int))
                    guard current["key"] as? String == identity["key"] as? String else { throw AxonError("identity_changed", "App restarted during approval.") }
                    grants.insert(identity["key"] as! String); try writeState()
                }
                if allowed && kind == "action" {
                    let args = message["args"] as? [String: Any] ?? [:], operation = str(message["action_op"]) ?? ""
                    let label = str(message["label"]) ?? "", permit = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
                    let key = args["__pid"] != nil ? try macIdentity(pid_t(int(args["__pid"], -1)))["key"] as! String : ""
                    let dir = MacFence.file + ".permits"; try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                    let contents = "\(token)\n\(try macFingerprint(operation, args, label))\n\(key)\n\(MacFenceState.now + 900_000_000)"
                    let path = (dir as NSString).appendingPathComponent(permit)
                    try Data(contents.utf8).write(to: URL(fileURLWithPath: path), options: [.atomic]); chmod(path, 0o600); result["permit"] = permit
                }
                reply(result)
            default: reply(["allowed": false, "error": "unknown_guardian_operation"])
            }
        } catch {
            reply(["allowed": false, "decision": "refused", "message": String(describing: error)])
        }
    }
}
