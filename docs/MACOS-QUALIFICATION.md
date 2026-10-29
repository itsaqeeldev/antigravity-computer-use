# macOS Intel Qualification Report

This document records the qualification, repairs, and real desktop acceptance of **Antigravity Computer Use** on Intel macOS (x86_64).

---

## 1. Environment & Target Identities

- **Host Machine**: Intel Mac (MacBook Pro), macOS 26.6.2 (Darwin 25.4.0, Build 25G83)
- **CPU Architecture**: Intel Core i7-9750H @ 2.60GHz (6 physical cores, 12 logical cores, x86_64)
- **Translation Status**: Pure native x86_64 execution (`sysctl sysctl.proc_translated` = `0`)
- **Host Antigravity**: Version 2.28.1 (PID 90344, language server active with sidecar support)
- **Toolchain**:
  - Standalone Node: v24.20.0 (darwin-x64, verified against `licenses/Node-provenance.json`)
  - Swift Compiler: Apple Swift 6.3.1 (swiftlang-6.3.1.0.33 clang-2100.0.123.102)
  - Target Triple: `x86_64-apple-macosx26.0`, SDK: `MacOSX26.4.sdk`
- **Upstream Target**: PR #1 (`https://github.com/shayann07/antigravity-computer-use/pull/1`), tracking branch `codex/macos-and-latency-review` at HEAD commit `f97b748956976260a92f026771d1822c9545ca6e`
- **Local Qualification Branch**: `codex/intel-mac-qualification` (rebased on `f97b748`, commit `6b38f83`)
- **Candidate Bundle Build ID**: `75989c9a63fe5c1f7ce3b8212e9393e7d1e1385e88d09a9b4b6a456e9e6c2cb2`
- **Live Installation Target**: `~/Library/Application Support/AntigravityComputerUse`
- **Installed Release**: `releases/0.3.0-beta.3-2026-10-29T13-53-50-911Z-53c7f550`

---

## 2. Qualification Results Matrix

| Gate / Requirement | Status | Verification Method & Evidence |
| :--- | :---: | :--- |
| **Native Swift Compilation** | **PASS** | `scripts/macos-native-check.mjs` built `AxonHost.app` and `StorageGuard` |
| **Native Control Contract** | **PASS** | Headless contract tests verified state decoding, risk patterns, and process start identification |
| **POSIX Private Storage** | **PASS** | `StorageGuard` verified user-only permissions (`0700` dirs, `0600` files, reject insecure ancestors) |
| **Automated Unit Tests** | **PASS** | `node --test tests/*.test.mjs`: 198 passed, 0 failed, 22 skipped (Windows-only NTFS/PowerShell) |
| **Tracked File Provenance** | **PASS** | `scripts/check-provenance.mjs`: 150/150 files match `UPSTREAM.json` |
| **Sealed Installation Verification** | **PASS** | `scripts/verify-install.mjs` verified 108 files, SHA256 manifest, and matching skill registration |
| **Passive Sidecar Startup** | **PASS** | Antigravity discovered `sidecar.json` and started `desktop.mjs serve` passively with zero UI |
| **OS Permission Setup** | **PASS** | Human approved `AxonHost.app` permissions via `--setup`: Accessibility, Screen Recording, Input Monitoring, Input Posting |
| **Native Control Bar Display** | **PASS** | `ready` and `controls` explicitly display minimal HUD bar; stays hidden when passive |
| **Native App Discovery** | **PASS** | `apps` listed active windows (Finder, Antigravity, TextEdit) with stable HWND handles |
| **Standalone App Approval** | **PASS** | Human approved `TextEdit` via native modal dialog; session token activated |
| **Sensitive Denial Handling** | **PASS** | Human denied approval prompt; control safely refused with `permission_denied` and zero input sent |
| **Native Window Capture** | **PASS** | ScreenCaptureKit returned high-resolution window screenshots without covering desktop pixels |
| **Semantic Actions (`ax_press`)** | **PASS** | Clicked "New Document" button via accessibility action, transitioning window safely |
| **Exact Unicode Input** | **PASS** | Typed Urdu (`اردو زبان`), ZWNJ (`U+200C`), ZWJ (`U+200D`), and emoji (`👩🏾‍💻`); verified exact code points in AX tree |
| **Emergency Stop Latch** | **PASS** | Emergency Stop created `emergency.stop` latch file; blocked subsequent actions with `control_inactive` |
| **Stop Persistence Across Restart** | **PASS** | Stop latch survived full service shutdown and startup; service stayed in `stopped` state |
| **Human Re-arm Required** | **PASS** | Human clicked Re-arm on native control bar; Stop latch removed, state restored to `idle` (`human_resume`) |
| **Session Teardown (`end`)** | **PASS** | `end` hid visuals, released cursor, cleared frame cache and tokens |
| **Subsequent Task Without Restart** | **PASS** | Second task ran immediately after `end` without restarting Antigravity |
| **Signed Updater & Rollback** | **PASS** | `scripts/macos-install-check.mjs` verified signed update, Stop preservation, and automatic rollback |

---

## 3. Defects Identified and Repaired

1. **Concurrent Storage Marker Collision (`PrivateStorage.swift`)**:
   - *Issue*: Concurrent processes collided on marker file creation (`open(..., O_CREAT | O_EXCL)`), throwing `EEXIST` as an unhandled permission error.
   - *Fix*: Handled `errno == EEXIST` by allowing the existing marker rather than treating it as a permission violation.
2. **Empty MCP Configuration Parse Crash (`install.mjs`, `sidecar.mjs`)**:
   - *Issue*: A 0-byte `~/.gemini/config/mcp_config.json` caused `JSON.parse` to crash with unexpected end of JSON input.
   - *Fix*: Added whitespace trimming and emptiness checks before parsing config files.
3. **Windows-Only Test Suite Portability**:
   - *Issue*: Unit tests compiling C# via `csc.exe` or asserting Windows NTFS ACLs failed on macOS.
   - *Fix*: Added standard `{skip: process.platform !== 'win32'}` guards matching existing test patterns.
4. **Installer Active Service Guard**:
   - *Issue*: Installing while a prior sidecar listener was active threw an error without guidance.
   - *Fix*: Verified that `cu.mjs shutdown` cleanly halts the service and allows subsequent atomic reinstallation.

---

## 4. Private Evidence References

All raw evidence and captures are preserved locally in the git-ignored `.localdata/` directory:
- `.localdata/evidence/01-textedit-open-panel.jpg`: TextEdit initial open panel observation
- `.localdata/evidence/02-textedit-untitled.jpg`: TextEdit Untitled document after semantic click
- `.localdata/evidence/03-textedit-unicode-typed.jpg`: TextEdit edit view with verified Urdu, ZWNJ, ZWJ, and emoji
- `.localdata/unicode-test.txt`: Exact reference UTF-8 byte stream used for verification
- `.localdata/macos-bundle/`: Complete sealed candidate bundle with build manifest

---

## 5. Remaining Distribution Gates

- **Developer ID Signing & Apple Notarization**: Current binaries are ad-hoc signed for local developer qualification. Production general distribution requires an Apple Developer ID Application certificate and notarization ticket.
- **Multi-Monitor Edge Layouts**: Tested on primary internal Retina display; secondary disjoint/negative-origin monitor layouts should be exercised with external displays when hardware is connected.
