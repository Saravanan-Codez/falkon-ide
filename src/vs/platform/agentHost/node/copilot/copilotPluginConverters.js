import { spawn } from "child_process";
import { Schemas } from "../../../../base/common/network.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { parseFrontMatter } from "../../../../base/common/yaml.js";
import { McpServerType } from "../../../mcp/common/mcpPlatformTypes.js";
import { dirname } from "../../../../base/common/path.js";
function toSdkMcpServers(defs) {
  const result = {};
  for (const def of defs) {
    result[def.name] = toSdkMcpServer(def.name, def.configuration);
  }
  return result;
}
function toSdkMcpServersFromConfigMap(servers) {
  const result = {};
  for (const [name, config] of Object.entries(servers)) {
    if (isSupportedMcpServerConfiguration(config)) {
      result[name] = toSdkMcpServer(name, config);
    }
  }
  return result;
}
function isSupportedMcpServerConfiguration(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  if (candidate.type === McpServerType.LOCAL) {
    return typeof candidate.command === "string";
  }
  if (candidate.type === McpServerType.REMOTE) {
    return typeof candidate.url === "string";
  }
  return false;
}
function toSdkMcpServer(_name, config) {
  if (config.type === McpServerType.LOCAL) {
    return {
      type: "local",
      command: config.command,
      args: config.args ? [...config.args] : [],
      tools: ["*"],
      ...config.env && { env: toStringEnv(config.env) },
      ...config.cwd && { cwd: config.cwd }
    };
  }
  return {
    type: "http",
    url: config.url,
    tools: ["*"],
    ...config.headers && { headers: { ...config.headers } }
  };
}
function toStringEnv(env) {
  const result = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}
async function toSdkCustomAgents(agents, fileService) {
  const configs = [];
  for (const agent of agents) {
    try {
      const content = await fileService.readFile(agent.uri);
      const raw = content.value.toString();
      const md = parseFrontMatter(raw);
      if (!md) {
        configs.push({
          name: agent.name,
          prompt: raw
        });
      } else {
        const name = md.getStringValue("name")?.trim() || agent.name;
        const description = md.getStringValue("description");
        const tools = md.getStringArrayValue("tools");
        const skills = md.getStringArrayValue("skills");
        let infer = md.getBooleanValue("infer");
        const disableModelInvocation = md.getBooleanValue("disable-model-invocation");
        if (infer === void 0 && disableModelInvocation === true) {
          infer = false;
        }
        const prompt = md.body ?? raw;
        let model = md.getStringValue("model") ?? void 0;
        const models = md.getStringArrayValue("model") ?? void 0;
        if (!model && models && Array.isArray(models) && models.length > 0) {
          model = models[0];
        }
        configs.push({
          name,
          ...description ? { description } : {},
          ...model ? { model } : {},
          tools: tools && tools.length > 0 ? tools : null,
          ...skills !== void 0 ? { skills } : {},
          ...infer !== void 0 ? { infer } : {},
          prompt
        });
      }
    } catch {
    }
  }
  return configs;
}
async function toSdkSessionCustomAgents(plugins, resolvedAgentName, fileService) {
  const pluginsWithoutDirs = plugins.filter((p) => !p.pluginDir || p.pluginDir.scheme !== Schemas.file);
  const customAgents = await toSdkCustomAgents(pluginsWithoutDirs.flatMap((p) => p.agents), fileService);
  if (resolvedAgentName && !customAgents.some((agent) => agent.name === resolvedAgentName)) {
    const selectedAgents = plugins.flatMap((p) => p.agents).filter((agent) => agent.name === resolvedAgentName);
    for (const config of await toSdkCustomAgents(selectedAgents, fileService)) {
      if (!customAgents.some((agent) => agent.name === config.name)) {
        customAgents.push(config);
      }
    }
  }
  return customAgents;
}
function toAgentCustomizations(agents) {
  return agents.map((a) => a.customization);
}
function toChildCustomizations(plugins) {
  const byId = /* @__PURE__ */ new Map();
  const add = (c) => {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
    }
  };
  for (const plugin of plugins) {
    for (const a of plugin.agents) {
      add(a.customization);
    }
    for (const s of plugin.skills) {
      add(s.customization);
    }
    for (const r of plugin.instructions) {
      add(r.customization);
    }
    for (const h of plugin.hooks) {
      add(h.customization);
    }
    for (const m of plugin.mcpServers) {
      add(m.customization);
    }
  }
  return [...byId.values()];
}
function toSdkSkillDirectories(skills) {
  return toSdkResourceDirectories(skills);
}
function toSdkInstructionDirectories(instructions) {
  return toSdkResourceDirectories(instructions);
}
function toSdkResourceDirectories(resources) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const resource of resources) {
    const dir = dirname(resource.uri.fsPath);
    if (!seen.has(dir)) {
      seen.add(dir);
      result.push(dir);
    }
  }
  return result;
}
function resolveEffectiveCommand(hook, os) {
  if (os === OperatingSystem.Windows && hook.windows) {
    return hook.windows;
  } else if (os === OperatingSystem.Macintosh && hook.osx) {
    return hook.osx;
  } else if (os === OperatingSystem.Linux && hook.linux) {
    return hook.linux;
  }
  return hook.command;
}
function executeHookCommand(hook, stdin) {
  const command = resolveEffectiveCommand(hook, OS);
  if (!command) {
    return Promise.resolve("");
  }
  const timeout = (hook.timeout ?? 30) * 1e3;
  const cwd = hook.cwd?.fsPath;
  return new Promise((resolve, reject) => {
    const isWindows = OS === OperatingSystem.Windows;
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellArgs = isWindows ? ["/c", command] : ["-c", command];
    const child = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env, ...hook.env },
      stdio: ["pipe", "pipe", "pipe"],
      timeout
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Hook command exited with code ${code}: ${stderr || stdout}`));
      }
    });
  });
}
async function runHookCommands(commands, input) {
  if (!commands) {
    return void 0;
  }
  const stdin = JSON.stringify(input);
  for (const cmd of commands) {
    try {
      const output = await executeHookCommand(cmd, stdin);
      if (output.trim()) {
        try {
          const parsed = JSON.parse(output);
          if (parsed && typeof parsed === "object") {
            return parsed;
          }
        } catch {
        }
      }
    } catch {
    }
  }
  return void 0;
}
const HOOK_TYPE_TO_SDK_KEY = {
  "PreToolUse": "onPreToolUse",
  "PostToolUse": "onPostToolUse",
  "UserPromptSubmit": "onUserPromptSubmitted",
  "SessionStart": "onSessionStart",
  "SessionEnd": "onSessionEnd",
  "ErrorOccurred": "onErrorOccurred"
};
function toSdkHooks(hookGroups, editTrackingHooks) {
  const commandsByKey = /* @__PURE__ */ new Map();
  for (const group of hookGroups) {
    const sdkKey = HOOK_TYPE_TO_SDK_KEY[group.type];
    if (!sdkKey) {
      continue;
    }
    const existing = commandsByKey.get(sdkKey) ?? [];
    existing.push(...group.commands);
    commandsByKey.set(sdkKey, existing);
  }
  const hooks = {};
  const preToolCommands = commandsByKey.get("onPreToolUse");
  if (preToolCommands?.length || editTrackingHooks) {
    hooks.onPreToolUse = async (input) => {
      await editTrackingHooks?.onPreToolUse(input);
      return runHookCommands(preToolCommands, input);
    };
  }
  const postToolCommands = commandsByKey.get("onPostToolUse");
  if (postToolCommands?.length || editTrackingHooks) {
    hooks.onPostToolUse = async (input) => {
      await editTrackingHooks?.onPostToolUse(input);
      return runHookCommands(postToolCommands, input);
    };
  }
  const promptCommands = commandsByKey.get("onUserPromptSubmitted");
  if (promptCommands?.length) {
    hooks.onUserPromptSubmitted = async (input) => {
      const stdin = JSON.stringify(input);
      for (const cmd of promptCommands) {
        try {
          await executeHookCommand(cmd, stdin);
        } catch {
        }
      }
    };
  }
  const startCommands = commandsByKey.get("onSessionStart");
  if (startCommands?.length) {
    hooks.onSessionStart = async (input) => {
      const stdin = JSON.stringify(input);
      for (const cmd of startCommands) {
        try {
          await executeHookCommand(cmd, stdin);
        } catch {
        }
      }
    };
  }
  const endCommands = commandsByKey.get("onSessionEnd");
  if (endCommands?.length) {
    hooks.onSessionEnd = async (input) => {
      const stdin = JSON.stringify(input);
      for (const cmd of endCommands) {
        try {
          await executeHookCommand(cmd, stdin);
        } catch {
        }
      }
    };
  }
  const errorCommands = commandsByKey.get("onErrorOccurred");
  if (errorCommands?.length) {
    hooks.onErrorOccurred = async (input) => {
      const stdin = JSON.stringify(input);
      for (const cmd of errorCommands) {
        try {
          await executeHookCommand(cmd, stdin);
        } catch {
        }
      }
    };
  }
  return hooks;
}
function parsedPluginsEqual(a, b) {
  const serialize = (plugins) => {
    return JSON.stringify(plugins.map((p) => ({
      format: p.format,
      hooks: p.hooks.map((h) => ({ type: h.type, commands: h.commands.map((c) => ({ command: c.command, windows: c.windows, linux: c.linux, osx: c.osx, cwd: c.cwd?.toString(), env: c.env, timeout: c.timeout })) })),
      mcpServers: p.mcpServers.map((m) => ({ name: m.name, configuration: m.configuration })),
      skills: p.skills.map((s) => ({ uri: s.uri.toString(), name: s.name })),
      agents: p.agents.map((a2) => ({ uri: a2.uri.toString(), name: a2.name })),
      instructions: p.instructions.map((i) => ({ uri: i.uri.toString(), name: i.name }))
    })));
  };
  return serialize(a) === serialize(b);
}
export {
  parsedPluginsEqual,
  toAgentCustomizations,
  toChildCustomizations,
  toSdkCustomAgents,
  toSdkHooks,
  toSdkInstructionDirectories,
  toSdkMcpServers,
  toSdkMcpServersFromConfigMap,
  toSdkSessionCustomAgents,
  toSdkSkillDirectories
};
