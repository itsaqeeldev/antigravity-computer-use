import AppKit
import ApplicationServices
import Carbon
import CoreGraphics
import Foundation
import ScreenCaptureKit

func macWindowIdentity(_ args: [String: Any]) throws -> [String: Any] {
    let (window, pid, title, handle) = try resolveWindow(args)
    var result = try macIdentity(pid)
    guard let rect = axRect(window) else { throw AxonError("window_rect_failed", "Window geometry is unavailable.") }
    result.merge(["hwnd": handle, "title": title, "rect": rect, "root": handle, "owner": 0,
                  "class": axString(window, kAXRoleAttribute as String) ?? "AXWindow",
                  "visible": true, "overlay": false, "minimized": axBool(window, kAXMinimizedAttribute as String) ?? false]) { _, new in new }
    return result
}

func macDisplayRects() -> [CGRect] {
    var displays = [CGDirectDisplayID](repeating: 0, count: 32); var count: UInt32 = 0
    guard CGGetActiveDisplayList(32, &displays, &count) == .success else { return [] }
    return displays.prefix(Int(count)).map { CGDisplayBounds($0) }
}
func macCheckPoint(_ point: CGPoint) throws {
    guard point.x.isFinite, point.y.isFinite, macDisplayRects().contains(where: { $0.contains(point) }) else {
        throw AxonError("point_off_desktop", "Point is outside the active displays. No input was sent.")
    }
}
func macCheckTargetPoint(_ point: CGPoint, _ args: [String: Any]) throws {
    try macCheckPoint(point)
    let (window, pid, _, _) = try resolveWindow(args)
    guard let rect = axRect(window), CGRect(x: rect[0], y: rect[1], width: rect[2], height: rect[3]).contains(point) else {
        throw AxonError("bad_point", "Point is outside the approved window.")
    }
    guard let expected = windowNumber(pid: pid, title: try resolveWindow(args).2, rect: rect),
          let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { throw AxonError("obscured", "The target point cannot be verified.") }
    let guardianRecord = (try? String(contentsOfFile: MacFence.file + ".guardian", encoding: .utf8).split(separator:"|")) ?? []
    let guardian = guardianRecord.count == 2 ? Int32(guardianRecord[0]) : nil
    let guardianAlive = guardian != nil && (try? macProcessStart(guardian!)) == String(guardianRecord.last ?? "")
    for candidate in windows {
        let owner = (candidate[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value ?? -1
        if guardianAlive && owner == guardian { continue } // only this runtime's native click-through chrome
        guard (candidate[kCGWindowAlpha as String] as? NSNumber)?.doubleValue ?? 0 > 0,
              let bounds = candidate[kCGWindowBounds as String] as? [String:Any],
              let boundsRect = CGRect(dictionaryRepresentation: bounds as CFDictionary), boundsRect.contains(point) else { continue }
        guard (candidate[kCGWindowNumber as String] as? NSNumber)?.uint32Value == expected else {
            throw AxonError("obscured", "Another window covers this point. No click was sent.")
        }
        return
    }
    throw AxonError("obscured", "The target point has no verifiable owning window.")
}

func macBringToFront(_ args: [String: Any]) throws {
    let (window, pid, title, _) = try resolveWindow(args)
    guard axBool(window, kAXMinimizedAttribute as String) != true,
          windowNumber(pid: pid, title: title, rect: axRect(window)) != nil else {
        throw AxonError("other_desktop", "Bring the approved window onto the current Space yourself. No Space was switched.")
    }
    if NSWorkspace.shared.frontmostApplication?.processIdentifier != pid {
        try MacFence.dispatched()
        guard NSRunningApplication(processIdentifier: pid)?.activate(options: []) == true,
              AXUIElementPerformAction(window, kAXRaiseAction as CFString) == .success else {
            throw AxonError("input_outcome_unknown", "Window activation was not confirmed. Observe before continuing.")
        }
        Thread.sleep(forTimeInterval: 0.12)
    }
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else { throw AxonError("focus_changed", "The approved app did not become foreground.") }
}

func macRole(_ role: String) -> String {
    return ["AXWindow":"Window", "AXSheet":"Window", "AXDialog":"Window", "AXButton":"Button", "AXTextField":"Edit",
            "AXTextArea":"Edit", "AXCheckBox":"CheckBox", "AXRadioButton":"RadioButton", "AXPopUpButton":"ComboBox",
            "AXComboBox":"ComboBox", "AXStaticText":"Text", "AXGroup":"Group", "AXWebArea":"Document",
            "AXScrollArea":"Pane", "AXMenu":"Menu", "AXMenuItem":"MenuItem", "AXSlider":"Slider"] [role] ?? role
}

func macOpen(_ args: [String: Any]) throws -> [String: Any] {
    let path = str(args["path"]) ?? ""
    guard path.hasPrefix("/"), !path.contains("\0"), URL(fileURLWithPath: path).pathExtension != "app" else {
        throw AxonError("invalid_path", "Use an absolute local document path; use launch for applications.")
    }
    try MacFence.dispatched()
    guard NSWorkspace.shared.open(URL(fileURLWithPath: path)) else { throw AxonError("input_outcome_unknown", "Document opening was submitted but not confirmed.") }
    return ["opened": path, "refresh_apps": true]
}

func macSetup() {
    _ = NSApplication.shared; NSApp.setActivationPolicy(.accessory)
    let alert = NSAlert(); alert.messageText = "Set up Antigravity Computer Use"
    alert.informativeText = "macOS requires your approval for Accessibility, Screen Recording and Input Monitoring. These permissions let the native helper observe and operate your desktop and stop on Esc. Approvals must be completed by you in macOS. This setup sends no clicks or keystrokes."
    alert.addButton(withTitle: "Request Mac Permissions"); alert.addButton(withTitle: "Cancel")
    if alert.runModal() == .alertFirstButtonReturn {
        _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
        _ = CGRequestScreenCaptureAccess(); _ = CGRequestListenEventAccess(); _ = CGRequestPostEventAccess()
    }
    emit(["accessibility": AXIsProcessTrusted(), "screen_capture": CGPreflightScreenCaptureAccess(),
          "input_monitoring": CGPreflightListenEventAccess(), "input_posting": CGPreflightPostEventAccess()])
}

func macContractTest() throws {
    try MacContract.load()
    let oldText = "old" as CFString, newText = "new" as CFString
    let zero = NSNumber(value: 0), one = NSNumber(value: 1)
    guard axValueDisposition(oldText, newText, newText) == "exact",
          axValueDisposition(oldText, oldText, newText) == nil,
          axValueDisposition(oldText, nil, newText) == nil,
          axValueDisposition(zero, one, one) == "exact" else {
        throw AxonError("contract_test_failed", "Value read-back classification differs.")
    }
    let token = "native-contract-test", grant = "123:birth:/app"
    guard MacFence.resolvedState("idle", latched: true) == "stopped",
          MacFence.resolvedState("active", latched: true) == "stopped",
          MacFence.resolvedState("idle", latched: false) == "idle" else {
        throw AxonError("contract_test_failed", "Latched Stop was lost during state resolution.")
    }
    let bounded = MacDeadline.create(requested: 100_000_000, wallNow: 0, bootNow: 1000, maximumMs: 500)
    guard bounded == 1500, MacDeadline.valid(bounded, now: 1499), !MacDeadline.valid(bounded, now: 1500),
          MacDeadline.create(requested: 100, wallNow: 100, bootNow: 10, maximumMs: 500) == 0,
          MacDeadline.create(requested: 100_000_000, wallNow: 0, bootNow: UInt64.max - 1, maximumMs: 500) == 0 else {
        throw AxonError("contract_test_failed", "Monotonic deadline arithmetic differs.")
    }
    guard !MacPanicMonitor.deadlineGraceElapsed(since: 100, now: 5099),
          MacPanicMonitor.deadlineGraceElapsed(since: 100, now: 5100),
          !MacPanicMonitor.deadlineGraceElapsed(since: 100, now: 99) else {
        throw AxonError("contract_test_failed", "Watchdog expiry grace differs.")
    }
    let readyPipe = Pipe()
    DispatchQueue.global().async {
        readyPipe.fileHandleForWriting.write(Data("{\"watchdog_".utf8))
        Thread.sleep(forTimeInterval: 0.02)
        readyPipe.fileHandleForWriting.write(Data("ready\":true}\n".utf8))
        try? readyPipe.fileHandleForWriting.close()
    }
    guard MacWorkers.readReadyLine(readyPipe.fileHandleForReading) == "{\"watchdog_ready\":true}" else {
        throw AxonError("contract_test_failed", "Fragmented watchdog readiness was not reassembled.")
    }
    guard MacWorkers.readyAcknowledged("{\"watchdog_ready\":true}"),
          !MacWorkers.readyAcknowledged("{\"watchdog_ready\":false}"),
          !MacWorkers.readyAcknowledged("{\"watchdog_ready\":1}"),
          !MacWorkers.readyAcknowledged("{\"message\":\"watchdog_ready\"}"),
          !MacWorkers.readyAcknowledged("not-json") else {
        throw AxonError("contract_test_failed", "Invalid watchdog readiness was accepted.")
    }
    let oversizedReady = Pipe()
    DispatchQueue.global().async {
        oversizedReady.fileHandleForWriting.write(Data(repeating: 65, count: 8193))
        try? oversizedReady.fileHandleForWriting.close()
    }
    guard MacWorkers.readReadyLine(oversizedReady.fileHandleForReading) == nil else {
        throw AxonError("contract_test_failed", "Oversized watchdog readiness was accepted.")
    }
    let text = "active|\(token)|\(MacFenceState.now + 10_000_000)|\(Data(grant.utf8).base64EncodedString())|\(MacDeadline.now + 1000)"
    let state = try MacFenceState(text)
    guard state.state == "active", state.token == token, state.grants.contains(grant), state.until > MacFenceState.now else {
        throw AxonError("contract_test_failed", "Shared state decoding differs.")
    }
    do { _ = try MacFenceState("active|broken|NaN|"); throw AxonError("contract_test_failed", "Malformed state accepted.") }
    catch let error as AxonError { if error.code == "contract_test_failed" { throw error } }
    for invalid in ["active|fixture|999|", "active|fixture|999||0", "active|fixture|999||invalid"] {
        do { _ = try MacFenceState(invalid); throw AxonError("contract_test_failed", "Unbounded active state accepted.") }
        catch let error as AxonError { if error.code == "contract_test_failed" { throw error } }
    }
    let a = try macFingerprint("click", ["index": 1, "__session": "one"], "Button")
    let b = try macFingerprint("click", ["__session": "two", "index": 1], "Button")
    let c = try macFingerprint("click", ["index": 2], "Button")
    guard a == b, a != c, MacFence.sensitive("click", ["__risk":"routine"], label: "Delete file"),
          MacFence.sensitive("click", ["__risk":"routine"], label: "de\u{200D}lete file"),
          MacFence.sensitive("click", ["__risk":"routine"], label: "  \u{200D}"),
          MacFence.sensitive("drag", ["__risk":"routine"], label: ""),
          !MacFence.sensitive("move", ["__risk":"routine"], label: ""),
          !MacFence.sensitive("click", ["__risk":"routine"], label: "Open settings Button"),
          try macProcessStart(getpid()) == macProcessStart(getpid()) else { throw AxonError("contract_test_failed", "Approval fingerprint or classification differs.") }
    // Exercise the actual native fence in isolated project-local storage.
    // Refusals only: no fake live permission, application grant or input event.
    try MacFence.initialize()
    MacFence.current = ["__session": token]
    let live = "active|\(token)|\(MacFenceState.now + 10_000_000)||\(MacDeadline.now + 1000)"
    func refused(_ state: String, _ description: String) throws {
        try MacFence.write(state)
        do { try MacFence.check(); throw AxonError("contract_test_failed", "Fence accepted \(description).") }
        catch let error as AxonError { if error.code != "control_stopped" { throw error } }
    }
    for mode in ["idle", "paused", "stopped"] { try refused("\(mode)|\(token)|\(MacFenceState.now + 10_000_000)|", mode) }
    try refused("active|\(token)|1|", "expired control")
    try refused("active|another-session|\(MacFenceState.now + 10_000_000)|", "wrong session")
    try refused(live, "missing independent Stop monitor")
    try Data("stopped".utf8).write(to: URL(fileURLWithPath: MacFence.latch))
    defer { try? FileManager.default.removeItem(atPath: MacFence.latch); try? MacFence.write("idle||0|") }
    try refused(live, "latched emergency Stop")
    if !FileManager.default.fileExists(atPath: MacInputLedger.path) {
        guard !MacInputLedger.recover() else { throw AxonError("contract_test_failed","Missing input journal was accepted.") }
    }
    try MacInputLedger.save(["keys":[Int](),"buttons":[Int]()])
    guard MacInputLedger.recover() else { throw AxonError("contract_test_failed","Empty input cleanup failed.") }
    try MacInputLedger.withLock {
        guard !MacInputLedger.recover() else { throw AxonError("contract_test_failed","Concurrent input cleanup bypassed the held lock.") }
    }
    guard MacInputLedger.recover() else { throw AxonError("contract_test_failed","Input lock was not released.") }
    // Exercise the kernel lock across actual native processes, including owner
    // death. The child posts no desktop events and holds the lock until killed.
    let holder = Process(), output = Pipe(), input = Pipe()
    holder.executableURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
    holder.arguments = ["--contract-lock-holder"]
    holder.environment = ProcessInfo.processInfo.environment
    holder.standardOutput = output; holder.standardInput = input; holder.standardError = FileHandle.standardError
    try holder.run()
    defer { if holder.isRunning { kill(holder.processIdentifier, SIGKILL); holder.waitUntilExit() } }
    let ready = DispatchSemaphore(value: 0); var message: String?
    DispatchQueue.global().async { message = String(data: output.fileHandleForReading.availableData, encoding: .utf8); ready.signal() }
    guard ready.wait(timeout: .now() + 5) == .success, message?.contains("lock_held") == true else {
        throw AxonError("contract_test_failed", "Native input-lock holder did not start.")
    }
    guard !MacInputLedger.recover() else { throw AxonError("contract_test_failed", "Cleanup overlapped another process's input lock.") }
    guard MacWorkers.terminateBeforeRetry(holder, expectedBirth: try macProcessStart(holder.processIdentifier)) else { throw AxonError("contract_test_failed", "Lock-holder exit was not confirmed.") }
    guard MacInputLedger.recover() else { throw AxonError("contract_test_failed", "Cleanup did not recover after lock-owner death.") }
    // Replacing the private root while its original inode is locked must not
    // let a contender acquire a different directory lock and claim cleanup.
    let root = URL(fileURLWithPath: MacFence.file).deletingLastPathComponent().path
    let backup = root + ".contract-backup"
    try MacInputLedger.withLock {
        guard rename(root, backup) == 0 else { throw AxonError("contract_test_failed", "Cannot move lock directory fixture.") }
        var replaced = false
        defer {
            if replaced { _ = rmdir(root) }
            _ = rename(backup, root)
        }
        guard mkdir(root, 0o700) == 0 else { throw AxonError("contract_test_failed", "Cannot replace lock directory fixture.") }
        replaced = true
        guard !MacInputLedger.recover() else { throw AxonError("contract_test_failed", "Cleanup accepted a replaced lock directory.") }
    }
    guard MacInputLedger.recover() else { throw AxonError("contract_test_failed", "Restored lock directory is unavailable.") }
    try Data("invalid journal".utf8).write(to:URL(fileURLWithPath:MacInputLedger.path))
    guard !MacInputLedger.recover() else { throw AxonError("contract_test_failed","Malformed input journal was accepted.") }
    try MacInputLedger.save(["keys":[Int](),"buttons":[Int]()])
    emit(["ok": true, "control_contract": 1, "checks": ["shared state codec", "malformed state refusal", "canonical approval fingerprint", "sensitive action classification", "kernel process birth identity", "native idle/paused/stopped/expired/session/monitor/Stop refusals", "empty cleanup and malformed input-journal refusal"], "desktop_input_sent": false])
}

func macMoveCursor(_ point: CGPoint, _ args: [String: Any]) throws -> [String: Any] {
    try macCheckTargetPoint(point, args)
    let from = CGEvent(source: nil)?.location ?? point
    let distance = hypot(point.x - from.x, point.y - from.y)
    let duration = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion || distance < 3 ? 0 : max(120, min(600, 100 + 10 * sqrt(distance)))
    let start = ProcessInfo.processInfo.systemUptime; var frames = 0
    while duration > 0 && (ProcessInfo.processInfo.systemUptime - start) * 1000 < duration {
        try MacFence.check()
        let t = min(1, (ProcessInfo.processInfo.systemUptime - start) * 1000 / duration)
        let eased = t*t*t*(10+t*(-15+6*t))
        let p = CGPoint(x: from.x + (point.x-from.x)*eased, y: from.y + (point.y-from.y)*eased)
        // Travel may cross display gaps without emitting input there. The end
        // point and every button transition still require exact display/window ownership.
        if !macDisplayRects().contains(where: { $0.contains(p) }) { Thread.sleep(forTimeInterval: 0.016); continue }
        try post(CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: .left))
        frames += 1; Thread.sleep(forTimeInterval: 0.016)
    }
    try macCheckTargetPoint(point, args)
    try post(CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left))
    return ["frames": frames + 1, "duration_ms": Int(duration), "animated": duration > 0]
}

func macScroll(_ args: [String:Any]) throws -> [String:Any] {
    try macBringToFront(args)
    let point: CGPoint
    if let pixels = pair(args["point"]) { point = CGPoint(x:pixels[0],y:pixels[1]) }
    else {
        let (element, _) = try snapshotElement(args)
        if bool(args["into_view"],false) {
            guard axActions(element).contains("AXScrollToVisible") else { throw AxonError("unsupported_action","This control has no ScrollToVisible accessibility action.") }
            try MacFence.dispatched()
            guard AXUIElementPerformAction(element,"AXScrollToVisible" as CFString) == .success else { throw AxonError("input_outcome_unknown","The provider did not confirm scrolling. Observe before continuing.") }
            return ["method":"ax_scroll_to_visible"]
        }
        guard let r = axRect(element) else { throw AxonError("no_click_point","The observed scroll target has no rectangle.") }
        point = CGPoint(x:r[0]+r[2]/2,y:r[1]+r[3]/2)
    }
    _ = try macMoveCursor(point,args)
    try macCheckTargetPoint(point,args)
    let amount=Int32(int(args["amount"],-3)), horizontal=bool(args["horizontal"],false)
    try post(CGEvent(scrollWheelEvent2Source:nil,units:.line,wheelCount:2,wheel1:horizontal ? 0 : amount,wheel2:horizontal ? amount : 0,wheel3:0))
    return ["method":"wheel","delta":amount]
}

func macEnsureTyping(_ args: [String: Any]) throws {
    let (window, pid, _, _) = try resolveWindow(args)
    guard !IsSecureEventInputEnabled(), NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
        throw AxonError("focus_changed", "Keyboard input requires the foreground approved app and nonsecure input.")
    }
    if args["index"] != nil {
        let (target, _) = try snapshotElement(args)
        try MacFence.dispatched()
        let outcome = AXUIElementSetAttributeValue(target, kAXFocusedAttribute as CFString, true as CFTypeRef)
        guard outcome == .success else { throw AxonError("input_outcome_unknown", "The accessibility provider did not confirm focus. Observe before continuing.") }
    }
    guard let value = axAttr(AXUIElementCreateApplication(pid), kAXFocusedUIElementAttribute as String),
          CFGetTypeID(value) == AXUIElementGetTypeID() else { throw AxonError("focus_failed", "No actual editable focus was observed.") }
    let focused = value as! AXUIElement
    let role = (axString(focused, kAXRoleAttribute as String) ?? "") + (axString(focused, kAXSubroleAttribute as String) ?? "")
    guard !role.lowercased().contains("secure") else { throw AxonError("protected_app", "Secure fields require a human.") }
    var cursor: AXUIElement? = focused; var contained = false
    for _ in 0..<64 {
        guard let element = cursor else { break }
        if CFEqual(element, window) { contained = true; break }
        cursor = axAttr(element, kAXParentAttribute as String) as! AXUIElement?
    }
    guard contained else { throw AxonError("focus_failed", "Keyboard focus is outside the approved window.") }
    if args["index"] != nil {
        let (target, _) = try snapshotElement(args)
        var current: AXUIElement? = focused; var matched = false
        for _ in 0..<64 {
            guard let element = current else { break }
            if CFEqual(element, target) { matched = true; break }
            current = axAttr(element, kAXParentAttribute as String) as! AXUIElement?
        }
        guard matched else { throw AxonError("focus_failed", "The requested editor did not acquire focus.") }
    }
    MacFence.keyboardPID = pid
    MacFence.keyboardWindow = window
}

func macChord(_ code: CGKeyCode, _ flags: CGEventFlags = []) throws {
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true),
          let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false) else { throw AxonError("event_creation_failed", "Cannot construct the keyboard event.") }
    down.flags = flags; up.flags = flags
    try post(down); try post(up)
}

func macPaste(_ args: [String: Any]) throws -> [String: Any] {
    try macEnsureTyping(args)
    let pasteboard = NSPasteboard.general
    let before = pasteboard.changeCount
    var saved: [[(NSPasteboard.PasteboardType, Data)]] = []
    for item in pasteboard.pasteboardItems ?? [] {
        var formats: [(NSPasteboard.PasteboardType, Data)] = []
        for type in item.types {
            guard let bytes = item.data(forType: type) else { throw AxonError("clipboard_preservation_failed", "A clipboard format cannot be preserved. Nothing was pasted.") }
            formats.append((type, bytes))
        }
        saved.append(formats)
    }
    guard before == pasteboard.changeCount else { throw AxonError("clipboard_changed", "The clipboard changed before preservation.") }
    try MacFence.dispatched(); pasteboard.clearContents()
    guard pasteboard.setString(str(args["text"]) ?? "", forType: .string) else { throw AxonError("clipboard_failed", "Cannot set temporary text.") }
    let ours = pasteboard.changeCount
    func restore() throws -> Bool {
        if pasteboard.changeCount == ours {
            let items = saved.map { formats -> NSPasteboardItem in let item = NSPasteboardItem(); for (type, data) in formats { item.setData(data, forType: type) }; return item }
            pasteboard.clearContents()
            guard items.isEmpty || pasteboard.writeObjects(items) else { throw AxonError("input_cleanup_failed", "The clipboard could not be restored. Inspect before continuing.") }
            return true
        }
        return false
    }
    do { try macChord(9, .maskCommand); Thread.sleep(forTimeInterval: 0.12) }
    catch { _ = try? restore(); throw error }
    return ["method": "clipboard_paste", "clipboard_restored": try restore(), "verification_required": true]
}

func macFitWindow(_ args: [String: Any]) throws -> [String: Any] {
    let (window, _, _, _) = try resolveWindow(args)
    guard axBool(window, kAXMinimizedAttribute as String) != true, let r = axRect(window),
          windowNumber(pid: try resolveWindow(args).1, title: try resolveWindow(args).2, rect: r) != nil else {
        throw AxonError("other_desktop", "Restore the app on the current Space yourself before fitting it. No Space was switched.")
    }
    let current = CGRect(x: r[0], y: r[1], width: r[2], height: r[3])
    guard let screen = macDisplayRects().max(by: { $0.intersection(current).width * $0.intersection(current).height < $1.intersection(current).width * $1.intersection(current).height }) else {
        throw AxonError("display_unavailable", "No display is available.")
    }
    var size = CGSize(width: min(current.width, screen.width), height: min(current.height, screen.height))
    var point = CGPoint(x: max(screen.minX, min(current.minX, screen.maxX-size.width)), y: max(screen.minY, min(current.minY, screen.maxY-size.height)))
    guard let sizeValue = AXValueCreate(.cgSize, &size), let pointValue = AXValueCreate(.cgPoint, &point) else { throw AxonError("window_geometry_failed", "Cannot represent window bounds.") }
    try MacFence.dispatched()
    guard AXUIElementSetAttributeValue(window, kAXSizeAttribute as CFString, sizeValue) == .success,
          AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, pointValue) == .success else {
        throw AxonError("input_outcome_unknown", "The app did not confirm its new geometry. Observe before retrying.")
    }
    let deadline = Date().addingTimeInterval(0.4)
    repeat {
        try MacFence.check()
        if let actual = axRect(window), screen.contains(CGRect(x:actual[0],y:actual[1],width:actual[2],height:actual[3])) {
            return ["rect":actual,"fully_visible":true]
        }
        Thread.sleep(forTimeInterval:0.02)
    } while Date() < deadline
    throw AxonError("input_outcome_unknown", "The app acknowledged fitting but its bounds are not fully visible. Observe before continuing; do not replay input.")
}

func macLaunch(_ args: [String: Any]) throws -> [String: Any] {
    let url = URL(fileURLWithPath: str(args["app"]) ?? "").standardizedFileURL
    guard url.pathExtension == "app", let bundle = Bundle(url: url), bundle.executableURL != nil else {
        throw AxonError("invalid_application", "Select an existing GUI application bundle.")
    }
    let signal = DispatchSemaphore(value: 0); var running: NSRunningApplication?; var failure: Error?
    let configuration = NSWorkspace.OpenConfiguration(); configuration.arguments = args["args"] as? [String] ?? []
    try MacFence.dispatched()
    NSWorkspace.shared.openApplication(at: url, configuration: configuration) { app, error in running = app; failure = error; signal.signal() }
    guard signal.wait(timeout: .now()+15) == .success, let app = running else {
        throw AxonError("input_outcome_unknown", "Launch was submitted but not confirmed: \(String(describing: failure)). Discover apps; do not relaunch.")
    }
    return ["pid": Int(app.processIdentifier), "path": url.path]
}

func macCapture(_ args: [String: Any]) throws -> [String: Any] {
    guard CGPreflightScreenCaptureAccess() else { throw AxonError("mac_permissions_required", "Screen Recording permission needs human setup.") }
    let (window, pid, title, _) = try resolveWindow(args)
    guard let r = axRect(window), let number = windowNumber(pid: pid, title: title, rect: r) else {
        throw AxonError("window_capture_unavailable", "The approved window is not unambiguously available on the current Space. No desktop fallback was captured.")
    }
    let signal = DispatchSemaphore(value: 0); var captured: CGImage?; var failure: Error?
    SCShareableContent.getExcludingDesktopWindows(true, onScreenWindowsOnly: true) { content, error in
        guard let target = content?.windows.first(where: { $0.windowID == number && $0.owningApplication?.processID == pid }) else {
            failure = error; signal.signal(); return
        }
        let configuration = SCStreamConfiguration()
        let maxWidth = min(1400, max(100, int(args["max_width"], 1400)))
        let ratio = min(1, Double(maxWidth)/Double(max(1, r[2])))
        configuration.width = max(1, Int(Double(r[2])*ratio)); configuration.height = max(1, Int(Double(r[3])*ratio))
        configuration.showsCursor = false
        SCScreenshotManager.captureImage(contentFilter: SCContentFilter(desktopIndependentWindow: target), configuration: configuration) { image, error in
            captured = image; failure = error; signal.signal()
        }
    }
    guard signal.wait(timeout: .now()+10) == .success, let image = captured else {
        throw AxonError("window_capture_unavailable", "Window capture failed: \(String(describing: failure)). No covering-app pixels were returned.")
    }
    try MacFence.check()
    guard axRect(window) == r else { throw AxonError("window_moved", "The window moved during capture. Discard this observation.") }
    let bitmap = NSBitmapImageRep(cgImage: image)
    guard let bytes = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8]) else { throw AxonError("encode_failed", "Screenshot encoding failed.") }
    return ["mime": "image/jpeg", "width": image.width, "height": image.height, "source": r,
            "capture": "window", "data": bytes.base64EncodedString()]
}

func macFileDialog(_ args: [String: Any]) throws -> [String: Any] {
    // Fail closed until a real AppKit picker can be identified and read back.
    // Implemented below through AX sheets; never use blind Enter or shell paths.
    let (owner, pid, _, _) = try resolveWindow(args)
    let sheets = axChildren(owner).filter { axString($0, kAXRoleAttribute as String) == "AXSheet" }
    let ownRole = axString(owner, kAXRoleAttribute as String) ?? ""
    let ownSubrole = axString(owner, kAXSubroleAttribute as String) ?? ""
    let candidates = sheets + ((ownRole == "AXSheet" || ownSubrole == "AXDialog") ? [owner] : [])
    guard candidates.count == 1, NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
        throw AxonError("file_dialog_not_found", "Observe an already-open native file picker attached to this owner.")
    }
    let dialog = candidates[0], path = str(args["path"]) ?? ""
    guard path.hasPrefix("/"), !path.contains("\n"), !path.contains("\r"), !path.contains("\0") else {
        throw AxonError("invalid_path", "The picker needs an exact absolute local path.")
    }
    MacFence.keyboardPID = pid
    MacFence.keyboardWindow = dialog
    try macChord(5, [.maskCommand, .maskShift]); Thread.sleep(forTimeInterval: 0.2)
    func descendants(_ root: AXUIElement) -> [AXUIElement] {
        var pending = [root], result: [AXUIElement] = []
        while !pending.isEmpty && result.count < 500 { let el = pending.removeLast(); result.append(el); pending.append(contentsOf: axChildren(el)) }
        return result
    }
    let fields = descendants(dialog).filter { (axString($0, kAXRoleAttribute as String) == "AXTextField" || axString($0, kAXRoleAttribute as String) == "AXComboBox") && axBool($0, kAXFocusedAttribute as String) == true }
    guard fields.count == 1 else { throw AxonError("file_dialog_field_not_found", "The Go to Folder field was not unambiguously observed. No filename was submitted.") }
    try MacFence.dispatched()
    guard AXUIElementSetAttributeValue(fields[0], kAXValueAttribute as CFString, path as CFTypeRef) == .success,
          axString(fields[0], kAXValueAttribute as String) == path else {
        throw AxonError("file_dialog_path_mismatch", "Exact path readback failed. The picker was not confirmed.")
    }
    try macChord(36); Thread.sleep(forTimeInterval: 0.2)
    if !axAlive(dialog) { return ["dialog_closed": true, "path_verified": true, "verification_required": true] }
    let expectedURL = URL(fileURLWithPath: path).standardizedFileURL
    let selectionVerified = descendants(dialog).contains { element in
        guard axBool(element, kAXSelectedAttribute as String) == true,
              let selectedURL = axAttr(element, kAXURLAttribute as String) as? URL else { return false }
        return selectedURL.standardizedFileURL == expectedURL
    }
    guard selectionVerified else {
        throw AxonError("file_dialog_path_mismatch", "The picker did not expose an exact selected-file URL after navigation. It was not confirmed; inspect it without replaying input.")
    }
    guard let value = axAttr(dialog, kAXDefaultButtonAttribute as String), CFGetTypeID(value) == AXUIElementGetTypeID() else {
        throw AxonError("file_dialog_confirmation_required", "The original picker has no observed default button. Inspect it without replay.")
    }
    try MacFence.dispatched()
    guard AXUIElementPerformAction(value as! AXUIElement, kAXPressAction as CFString) == .success else {
        throw AxonError("input_outcome_unknown", "Picker confirmation was not acknowledged. Inspect before continuing.")
    }
    return ["path_verified": true, "verification_required": true, "method": "accessibility_picker"]
}
