# Motion Mouse

Cross-platform, local-first motion mouse. This repository is Phase 1: a dependency-free, testable domain/protocol workspace. Native mobile and desktop hosts are intentionally not yet implemented.

Run `npm.cmd install` then `npm.cmd run verify` on Windows.

The architectural record is rooted in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). No module may bypass `packages/protocol` to communicate across the phone/desktop boundary.
