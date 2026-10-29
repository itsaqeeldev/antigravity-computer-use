// Platform renderer for the same minimal controls and original pointer artwork.
import AppKit
import CoreGraphics
import Foundation

final class MacVisuals: NSObject {
    var onToggle: (() -> Void)?, onStop: (() -> Void)?, onMode: ((String) -> Void)?
    var panel: NSPanel?
    var label = NSTextField(labelWithString: "")
    var toggle = NSButton(), stop = NSButton(), more = NSButton()
    var rings: [NSPanel] = []
    var pointer: NSPanel?
    var hiddenDisplays: [CGDirectDisplayID] = []
    var state = "idle", captureHidden = false
    var hoverChecked = Date.distantPast
    let origin = ProcessInfo.processInfo.systemUptime
    var visible: Bool { panel?.isVisible == true }
    var cursorApplied: Bool { !hiddenDisplays.isEmpty }
    func makePanel(_ frame: NSRect, clickThrough: Bool) -> NSPanel {
        let p = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        p.isOpaque = false; p.backgroundColor = .clear; p.hasShadow = !clickThrough
        p.level = .statusBar; p.hidesOnDeactivate = false; p.ignoresMouseEvents = clickThrough
        p.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        p.sharingType = .none; p.isReleasedWhenClosed = false
        return p
    }
    func build() {
        guard panel == nil else { return }
        let screen = NSScreen.screens.first(where: { $0.frame.contains(NSEvent.mouseLocation) }) ?? NSScreen.main!
        let p = makePanel(NSRect(x: screen.frame.midX - 192, y: screen.frame.maxY - 62, width: 384, height: 44), clickThrough: false)
        p.title = "Antigravity Computer Use"
        let background = NSVisualEffectView(frame: NSRect(x: 0, y: 0, width: 384, height: 44))
        background.material = .hudWindow; background.blendingMode = .behindWindow; background.state = .active
        background.wantsLayer = true; background.layer?.cornerRadius = 21; background.layer?.masksToBounds = true
        background.appearance = NSAppearance(named: .darkAqua)
        label.frame = NSRect(x: 16, y: 12, width: 196, height: 20); label.font = .systemFont(ofSize: 12.5)
        label.textColor = NSColor(calibratedWhite: 0.91, alpha: 1); background.addSubview(label)
        for (button, x, symbol, action) in [(more, 214.0, "ellipsis", #selector(menu)), (toggle, 254.0, "pause.fill", #selector(toggleControl)), (stop, 294.0, "stop.fill", #selector(stopControl))] {
            button.frame = NSRect(x: x, y: 6, width: button === stop ? 78 : 32, height: 32)
            button.target = self; button.action = action; button.isBordered = false
            button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
            button.contentTintColor = NSColor(calibratedWhite: 0.9, alpha: 1)
            background.addSubview(button)
        }
        stop.title = " Stop"; stop.imagePosition = .imageLeading; stop.font = .systemFont(ofSize: 12)
        stop.toolTip = "Stop immediately · Esc or Control+Option+F12"
        more.setAccessibilityLabel("Control settings")
        p.contentView = background; panel = p
        for screen in NSScreen.screens {
            let ring = makePanel(screen.frame, clickThrough: true)
            ring.contentView = MacGlowView(frame: NSRect(origin: .zero, size: screen.frame.size))
            rings.append(ring)
        }
        let cursor = makePanel(NSRect(x: 0, y: 0, width: 40, height: 40), clickThrough: true)
        cursor.contentView = MacPointerView(frame: NSRect(x: 0, y: 0, width: 40, height: 40)); pointer = cursor
        let quartzY = (NSScreen.screens.first?.frame.maxY ?? 0) - p.frame.maxY
        if let bytes = try? JSONSerialization.data(withJSONObject: [p.frame.minX, quartzY, p.frame.width, p.frame.height]) {
            try? bytes.write(to: URL(fileURLWithPath: MacFence.file + ".hud"), options: [.atomic]); chmod(MacFence.file + ".hud", 0o600)
        }
    }
    func show(_ next: String) {
        build(); state = next
        label.stringValue = next == "active" ? "Antigravity is working" : next == "paused" ? "Paused · you have control" : next == "stopped" ? "Stopped · re-arm to begin" : "Ready · awaiting a task"
        toggle.image = NSImage(systemSymbolName: next == "active" ? "pause.fill" : "play.fill", accessibilityDescription: nil)
        toggle.setAccessibilityLabel(next == "active" ? "Pause computer use" : next == "paused" ? "Resume computer use" : "Re-arm computer use")
        stop.setAccessibilityLabel(next == "stopped" ? "Dismiss stopped controls" : "Stop computer use immediately")
        if next != "active" { releaseCursor(); rings.forEach { $0.orderOut(nil) }; pointer?.orderOut(nil) }
        if !captureHidden { panel?.orderFrontRegardless() }
        if next == "active" && !captureHidden { applyCursor(); rings.forEach { $0.orderFrontRegardless() }; animate() }
    }
    func applyCursor() {
        if cursorApplied { return }
        var displays = [CGDirectDisplayID](repeating: 0, count: 32); var count: UInt32 = 0
        guard CGGetActiveDisplayList(32, &displays, &count) == .success else { return }
        for display in displays.prefix(Int(count)) where CGDisplayHideCursor(display) == .success { hiddenDisplays.append(display) }
        if !hiddenDisplays.isEmpty { pointer?.orderFrontRegardless() }
    }
    func releaseCursor() {
        for display in hiddenDisplays { CGDisplayShowCursor(display) }
        hiddenDisplays.removeAll(); pointer?.orderOut(nil)
    }
    func hide() { releaseCursor(); panel?.orderOut(nil); rings.forEach { $0.orderOut(nil) }; pointer?.orderOut(nil) }
    func hideForCapture() { captureHidden = true; panel?.orderOut(nil); rings.forEach { $0.orderOut(nil) }; pointer?.orderOut(nil) }
    func finishCapture(_ state: String) { captureHidden = false; if state == "active" || state == "paused" { show(state) } }
    func activity(_ action: String) { /* The persistent state label stays calm between actions. */ }
    func animate() {
        if captureHidden || state != "active" { return }
        let reduce = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        let ui = MacContract.value["ui"] as? [String: Any] ?? [:]
        let configuredSeconds = ui["breath_seconds"] as? Double ?? 4.0
        let configuredBase = ui["breath_base"] as? Double ?? 0.82
        let configuredAmplitude = ui["breath_amplitude"] as? Double ?? 0.18
        let seconds = configuredSeconds.isFinite && (1.0...30.0).contains(configuredSeconds) ? configuredSeconds : 4.0
        let base = configuredBase.isFinite && (0.0...1.0).contains(configuredBase) ? configuredBase : 0.82
        let amplitude = configuredAmplitude.isFinite && (0.0...1.0).contains(configuredAmplitude) ? configuredAmplitude : 0.18
        let alpha = reduce ? 0.94 : max(0, min(1, base + amplitude * sin((ProcessInfo.processInfo.systemUptime - origin) * .pi * 2 / seconds)))
        rings.forEach { $0.alphaValue = alpha; if !$0.isVisible { $0.orderFrontRegardless() } }
        if cursorApplied {
            let point = NSEvent.mouseLocation
            pointer?.setFrameOrigin(NSPoint(x: point.x - 4, y: point.y - 38))
            if pointer?.isVisible != true { pointer?.orderFrontRegardless() }
            if Date().timeIntervalSince(hoverChecked) >= 0.15 {
                hoverChecked=Date();var insertion=false
                if let location=CGEvent(source:nil)?.location,
                   let element=elementAt(Int(location.x),Int(location.y)) {
                    var pid: pid_t=0
                    if AXUIElementGetPid(element,&pid) == .success,
                       let identity=try? macIdentity(pid), let key=identity["key"] as? String,
                       let control=try? MacFence.read(), control.grants.contains(key) {
                        AXUIElementSetMessagingTimeout(element,0.08)
                        let role=axString(element,kAXRoleAttribute as String) ?? ""
                        insertion=["AXTextField","AXTextArea","AXComboBox"].contains(role)
                    }
                }
                if let view=pointer?.contentView as? MacPointerView,view.textInsertion != insertion {view.textInsertion=insertion;view.needsDisplay=true}
            }
        }
    }
    @objc func toggleControl() { onToggle?() }
    @objc func stopControl() { if state == "stopped" { hide() } else { onStop?() } }
    @objc func menu() {
        let menu = NSMenu()
        for (title, value) in [("Keep working — Pause or Esc to interrupt", "manual"), ("Yield on deliberate input", "smart")] {
            let item = NSMenuItem(title: title, action: #selector(changeMode(_:)), keyEquivalent: "")
            item.target = self; item.representedObject = value; menu.addItem(item)
        }
        menu.addItem(.separator()); let hint = NSMenuItem(title: "Esc always stops immediately", action: nil, keyEquivalent: "")
        hint.isEnabled = false; menu.addItem(hint)
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: 0), in: more)
    }
    @objc func changeMode(_ item: NSMenuItem) { if let mode = item.representedObject as? String { onMode?(mode) } }
    deinit { releaseCursor() }
}

final class MacPointerView: NSView {
    var textInsertion=false
    override var isFlipped: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        if textInsertion {
            let p=NSBezierPath();p.move(to:NSPoint(x:4,y:3));p.line(to:NSPoint(x:4,y:28))
            p.move(to:NSPoint(x:0,y:3));p.line(to:NSPoint(x:8,y:3));p.move(to:NSPoint(x:0,y:28));p.line(to:NSPoint(x:8,y:28))
            NSColor(calibratedWhite:0.12,alpha:0.95).setStroke();p.lineWidth=4;p.stroke()
            NSColor(calibratedRed:0.84,green:0.93,blue:0.98,alpha:1).setStroke();p.lineWidth=1.8;p.stroke();return
        }
        let p = NSBezierPath(); p.move(to: NSPoint(x: 4, y: 2)); p.line(to: NSPoint(x: 28, y: 16))
        p.curve(to: NSPoint(x: 27.8, y: 18.2), controlPoint1: NSPoint(x: 29.5, y: 17), controlPoint2: NSPoint(x: 29, y: 18))
        p.line(to: NSPoint(x: 17.3, y: 19.6)); p.line(to: NSPoint(x: 11.8, y: 28.5))
        p.curve(to: NSPoint(x: 9.6, y: 27.8), controlPoint1: NSPoint(x: 11, y: 29.8), controlPoint2: NSPoint(x: 9.9, y: 29.3))
        p.close(); NSGradient(starting: .white, ending: NSColor(calibratedRed: 0.51, green: 0.69, blue: 0.79, alpha: 1))?.draw(in: p, angle: 90)
        NSColor(calibratedRed: 0.11, green: 0.15, blue: 0.21, alpha: 0.94).setStroke(); p.lineWidth = 1.25; p.stroke()
    }
}

final class MacGlowView: NSView {
    var image: NSImage?
    override init(frame: NSRect) { super.init(frame: frame); buildGlow() }
    required init?(coder: NSCoder) { super.init(coder: coder); buildGlow() }
    func buildGlow() {
        let w = max(1, Int(bounds.width)), h = max(1, Int(bounds.height))
        guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8,
                                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                           bytesPerRow: w * 4, bitsPerPixel: 32), let bytes = bitmap.bitmapData else { return }
        let ui = MacContract.value["ui"] as? [String: Any] ?? [:]
        let sigma = ui["edge_sigma"] as? Double ?? 27, depth = ui["edge_depth"] as? Int ?? 82
        let core = ui["edge_core"] as? Double ?? 5, amplitude = ui["edge_alpha"] as? Double ?? 154
        let coreAmplitude = ui["edge_core_alpha"] as? Double ?? 20
        let horizontal = (0..<w).map { x -> Double in let d = Double(min(x, w - 1 - x)); return exp(-d * d / (2 * sigma * sigma)) }
        let vertical = (0..<h).map { y -> Double in let d = Double(min(y, h - 1 - y)); return exp(-d * d / (2 * sigma * sigma)) }
        for y in 0..<h { for x in 0..<w {
            let i = (y * w + x) * 4
            if x > depth && x < w - depth && y > depth && y < h - depth { bytes[i+3] = 0; continue }
            let dx = Double(min(x, w - 1 - x)), dy = Double(min(y, h - 1 - y))
            let alpha = amplitude * (1 - (1 - horizontal[x]) * (1 - vertical[y])) + coreAmplitude * (1 - (1 - exp(-dx*dx/(2*core*core))) * (1 - exp(-dy*dy/(2*core*core))))
            bytes[i] = 155; bytes[i+1] = 205; bytes[i+2] = 235; bytes[i+3] = UInt8(min(255, max(0, alpha)))
        } }
        let output = NSImage(size: bounds.size); output.addRepresentation(bitmap); image = output
    }
    override func draw(_ dirtyRect: NSRect) { image?.draw(in: bounds) }
}
