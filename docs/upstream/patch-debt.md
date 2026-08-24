# Code-OSS Upstream Patch Debt Report

**Migration Baseline**: Code-OSS `1.133.0` → `1.134.0`

---

## Patch Inventory & Debt Audit

| Patch ID | Target File | Status | Technical Rationale & Retain/Remove Decision |
| :--- | :--- | :--- | :--- |
| `FALKON-001` | `platform.ts` | **RETAIN** | Overrides browser branch `_isWeb=true` to `_isNative=true`, `_isWeb=false` in Tauri environment. Essential for desktop workbench behaviors. |
| `FALKON-002` | `lifecycleService.ts` | **RETAIN** | Suppresses `event.returnValue` browser "Leave site?" prompt which freezes desktop native Webview windows. |
| `FALKON-003` to `FALKON-008` | `builtinExtensionsScannerService.ts` | **RETAIN** | Bypasses `if (isWeb)` gate and caches extension promises so all 96 built-in extensions load natively in Tauri desktop mode. |
| `FALKON-009` | `workbench.ts` | **RETAIN** | Forces single window reuse via `location.href` when opening workspace locations in Tauri. |
| `FALKON-010` | `workbench.ts` | **RETAIN** | Injects Falkon `configurationDefaults` (custom titlebar, dark modern theme, seti icons, layout controls, tree indent guides). |

### Summary
- **Total Patches Before Migration**: 10
- **Total Patches After Migration**: 10
- **Obsolete/Removed**: 0
- **Patch Debt Rating**: **LOW & STABLE** (All 10 patches are minimal, isolated integration bridges).
