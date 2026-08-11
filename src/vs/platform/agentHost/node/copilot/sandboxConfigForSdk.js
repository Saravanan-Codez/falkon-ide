import { AgentSandboxEnabledValue } from "../../../sandbox/common/settings.js";
import { AgentHostSandboxKey } from "../../common/sandboxConfigSchema.js";
const WINDOWS_SANDBOX_SUPPORTED = false;
function buildSandboxConfigForSdk(platform, sandbox) {
  if (!sandbox) {
    return void 0;
  }
  if (platform === "win32" && !WINDOWS_SANDBOX_SUPPORTED) {
    return void 0;
  }
  const enabledRaw = platform === "win32" && sandbox[AgentHostSandboxKey.WindowsEnabled] !== void 0 ? sandbox[AgentHostSandboxKey.WindowsEnabled] : sandbox[AgentHostSandboxKey.Enabled];
  if (enabledRaw !== AgentSandboxEnabledValue.On && enabledRaw !== AgentSandboxEnabledValue.AllowNetwork) {
    return void 0;
  }
  const fsRaw = platform === "win32" ? sandbox[AgentHostSandboxKey.WindowsFileSystem] : platform === "darwin" ? sandbox[AgentHostSandboxKey.MacFileSystem] : sandbox[AgentHostSandboxKey.LinuxFileSystem];
  const fs = fsRaw && typeof fsRaw === "object" ? fsRaw : {};
  const denied = new Set(fs.denyRead ?? []);
  const readonly = /* @__PURE__ */ new Set();
  const readwrite = /* @__PURE__ */ new Set();
  for (const p of fs.denyWrite ?? []) {
    if (!denied.has(p)) {
      readonly.add(p);
    }
  }
  for (const p of fs.allowWrite ?? []) {
    if (!denied.has(p) && !readonly.has(p)) {
      readwrite.add(p);
    }
  }
  for (const p of fs.allowRead ?? []) {
    if (!denied.has(p) && !readonly.has(p) && !readwrite.has(p)) {
      readonly.add(p);
    }
  }
  const legacyAllowAllNetwork = enabledRaw === AgentSandboxEnabledValue.AllowNetwork;
  const allowAllNetwork = legacyAllowAllNetwork || enabledRaw === AgentSandboxEnabledValue.On && sandbox[AgentHostSandboxKey.AllowNetwork] === true;
  return {
    enabled: true,
    allowBypass: true,
    userPolicy: {
      filesystem: {
        ...readwrite.size ? { readwritePaths: [...readwrite] } : {},
        ...readonly.size ? { readonlyPaths: [...readonly] } : {},
        ...denied.size ? { deniedPaths: [...denied] } : {}
      },
      network: {
        allowOutbound: allowAllNetwork
      }
    }
  };
}
export {
  buildSandboxConfigForSdk
};
