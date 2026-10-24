# Project housekeeping

- Keep all test, probe, qualification, recording and temporary evidence folders
  inside this checkout's ignored `.localdata/` directory. Never create them at a
  drive root or in the operating system's temporary directory.
- Tests use `tests/paths.mjs` to resolve `.localdata/tests/` from the checkout,
  independent of the caller's current directory. Ad hoc checks follow the same
  rule. Do not modify a live installation merely to store test artifacts.
- If project-local Windows ACL qualification is refused because an ancestor is
  replaceable by another account, report the limitation. Do not widen or change
  parent permissions, weaken the runtime guard, or silently move tests outside
  the project. Skipped native qualification is not a passing qualification.
