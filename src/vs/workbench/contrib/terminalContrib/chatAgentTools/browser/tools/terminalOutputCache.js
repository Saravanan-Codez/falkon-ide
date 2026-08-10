import { TerminalToolId } from "../../../../chat/common/tools/terminalToolIds.js";
import { parseCommand, segmentHead } from "./terminalCommandParser.js";
var CacheClass = /* @__PURE__ */ ((CacheClass2) => {
  CacheClass2["Fast"] = "fast";
  CacheClass2["Medium"] = "medium";
  CacheClass2["Slow"] = "slow";
  return CacheClass2;
})(CacheClass || {});
const TTL_MS = {
  ["fast" /* Fast */]: 3e4,
  ["medium" /* Medium */]: 12e4,
  ["slow" /* Slow */]: 3e5
};
const MAX_ENTRIES = 256;
function classifyCommand(command) {
  const parsed = parseCommand(command);
  if (!parsed || parsed.segments.length === 0) {
    return { cls: void 0, invalidates: [] };
  }
  if (parsed.segments.length > 1) {
    const allInvalidates = [];
    for (const seg of parsed.segments) {
      const h = segmentHead(seg);
      if (h) {
        const sub = classifySingleHead(h);
        allInvalidates.push(...sub.invalidates);
      }
    }
    return { cls: void 0, invalidates: allInvalidates };
  }
  const head = segmentHead(parsed.segments[0]);
  if (!head) {
    return { cls: void 0, invalidates: [] };
  }
  return classifySingleHead(head);
}
function classifySingleHead(head) {
  switch (head.head) {
    case "git": {
      if (head.sub && /^(add|commit|push|pull|fetch|merge|rebase|reset|checkout|switch|restore|cherry-pick|revert|stash|tag|branch|am|apply|clean|rm|mv)$/.test(head.sub)) {
        return { cls: void 0, invalidates: ["git"] };
      }
      if (head.sub === "status" || head.sub === "diff" || head.sub === "show" || head.sub === "blame") {
        return { cls: "fast" /* Fast */, invalidates: [] };
      }
      if (head.sub === "log" || head.sub === "reflog" || head.sub === "shortlog") {
        return { cls: "slow" /* Slow */, invalidates: [] };
      }
      return { cls: void 0, invalidates: [] };
    }
    case "ls":
    case "pwd":
    case "tree":
    case "find":
      return { cls: head.head === "find" || head.head === "tree" ? "slow" /* Slow */ : "fast" /* Fast */, invalidates: [] };
    case "npm":
    case "pnpm":
    case "yarn":
      if (head.sub === "ls" || head.sub === "list" || head.sub === "outdated") {
        return { cls: "slow" /* Slow */, invalidates: [] };
      }
      if (head.sub === "install" || head.sub === "i" || head.sub === "ci" || head.sub === "add" || head.sub === "remove" || head.sub === "uninstall" || head.sub === "update") {
        return { cls: void 0, invalidates: ["npm", "pnpm", "yarn"] };
      }
      if (head.sub === "test" || head.sub === "run" || head.sub === void 0) {
        return { cls: "medium" /* Medium */, invalidates: [] };
      }
      return { cls: void 0, invalidates: [] };
    case "pytest":
    case "jest":
    case "vitest":
    case "cargo":
      if (head.head === "cargo" && head.sub && /^(test|nextest|check|build)$/.test(head.sub)) {
        return { cls: "medium" /* Medium */, invalidates: [] };
      }
      if (head.head !== "cargo") {
        return { cls: "medium" /* Medium */, invalidates: [] };
      }
      return { cls: void 0, invalidates: [] };
    case "go":
      if (head.sub === "test" || head.sub === "build" || head.sub === "vet") {
        return { cls: "medium" /* Medium */, invalidates: [] };
      }
      return { cls: void 0, invalidates: [] };
    case "docker":
    case "kubectl":
      if (head.sub === "ps" || head.sub === "images" || head.sub === "get" || head.sub === "describe") {
        return { cls: "fast" /* Fast */, invalidates: [] };
      }
      return { cls: void 0, invalidates: [] };
    case "env":
    case "printenv":
      return { cls: "slow" /* Slow */, invalidates: [] };
    case "gh":
      return { cls: "medium" /* Medium */, invalidates: [] };
  }
  return { cls: void 0, invalidates: [] };
}
function getInput(input) {
  if (typeof input !== "object" || input === null) {
    return void 0;
  }
  const i = input;
  if (typeof i.command !== "string" || !i.command.trim()) {
    return void 0;
  }
  const cwd = typeof i.cwd === "string" ? i.cwd : "";
  return { command: i.command, cwd };
}
class TerminalOutputCache {
  constructor(now = () => Date.now()) {
    this.id = "terminal.session-dedup";
    this.toolIds = [TerminalToolId.RunInTerminal];
    this._entries = /* @__PURE__ */ new Map();
    this._now = now;
  }
  _key(cwd, command) {
    return `${cwd}::${command.trim()}`;
  }
  observe(_toolId, input) {
    const parsed = getInput(input);
    if (!parsed) {
      return;
    }
    const { invalidates } = classifyCommand(parsed.command);
    if (invalidates.length === 0) {
      return;
    }
    this._invalidateByProgram(parsed.cwd, invalidates);
  }
  lookup(_toolId, input) {
    const parsed = getInput(input);
    if (!parsed) {
      return void 0;
    }
    const { cls } = classifyCommand(parsed.command);
    if (cls === void 0) {
      return void 0;
    }
    const key = this._key(parsed.cwd, parsed.command);
    const entry = this._entries.get(key);
    if (!entry) {
      return void 0;
    }
    const ttl = TTL_MS[entry.cls];
    if (this._now() - entry.timestamp > ttl) {
      this._entries.delete(key);
      return void 0;
    }
    return { text: entry.text, timestamp: entry.timestamp };
  }
  record(_toolId, input, text) {
    const parsed = getInput(input);
    if (!parsed) {
      return;
    }
    const { cls } = classifyCommand(parsed.command);
    if (cls === void 0) {
      return;
    }
    const key = this._key(parsed.cwd, parsed.command);
    if (this._entries.has(key)) {
      this._entries.delete(key);
    }
    this._entries.set(key, {
      cwd: parsed.cwd,
      command: parsed.command,
      text,
      timestamp: this._now(),
      cls
    });
    while (this._entries.size > MAX_ENTRIES) {
      const oldestKey = this._entries.keys().next().value;
      if (oldestKey === void 0) {
        break;
      }
      this._entries.delete(oldestKey);
    }
  }
  /** External hook for editor file-write notifications etc. */
  invalidateCwd(cwd) {
    for (const key of [...this._entries.keys()]) {
      const e = this._entries.get(key);
      if (e.cwd === cwd) {
        this._entries.delete(key);
      }
    }
  }
  _invalidateByProgram(cwd, programs) {
    const progSet = new Set(programs);
    for (const key of [...this._entries.keys()]) {
      const e = this._entries.get(key);
      if (e.cwd !== cwd) {
        continue;
      }
      const head = segmentHead(parseCommand(e.command)?.segments[0] ?? { raw: "", tokens: [], rawTokens: [], envPrefixes: [], wrappers: [], trailingSeparator: void 0 });
      if (head && progSet.has(head.head)) {
        this._entries.delete(key);
      }
    }
  }
}
export {
  CacheClass,
  TerminalOutputCache
};
