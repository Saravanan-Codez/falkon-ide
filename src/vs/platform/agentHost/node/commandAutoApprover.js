import * as fs from "fs";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { FileAccess } from "../../../base/common/network.js";
import { escapeRegExpCharacters, regExpLeadsToEndlessLoop } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { getAppNodeModulesPath } from "./appNodeModules.js";
import { shouldRequireConfirmationForAutoApproveParse } from "../../terminal/common/autoApprove/autoApproveParseSafety.js";
import { gitAutoApproveRules } from "../../terminal/common/autoApprove/gitAutoApproveRules.js";
import { powershellAutoApproveRules } from "../../terminal/common/autoApprove/powershellAutoApproveRules.js";
import { SedFileWriteParser } from "../../terminal/common/autoApprove/sedFileWriteParser.js";
import { sortAutoApproveRules } from "../../terminal/common/autoApprove/sortAutoApproveRules.js";
const SAFE_POSIX_REDIRECT_TARGETS = /* @__PURE__ */ new Set([
  "/dev/null",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/tty"
]);
function isSafeRedirectDestination(dest, isPowerShell) {
  let cleaned = dest.trim();
  if (cleaned.length === 0) {
    return false;
  }
  if (isPowerShell && cleaned.toLowerCase() === "$null") {
    return true;
  }
  if (cleaned.startsWith(`'`) && cleaned.endsWith(`'`) || cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (/^&[0-9]+-?$/.test(cleaned)) {
    return true;
  }
  return !isPowerShell && SAFE_POSIX_REDIRECT_TARGETS.has(cleaned);
}
function classifyFileRedirect(redirectText, isPowerShell) {
  if (!redirectText.includes(">")) {
    return { kind: "read" };
  }
  const destMatch = redirectText.match(/(?:[0-9]+|&|\*)?>>?\|?\s*(.+)$/);
  if (!destMatch) {
    return { kind: "unsafeWrite", dest: void 0 };
  }
  const rawDest = destMatch[1].trim();
  if (isSafeRedirectDestination(rawDest, isPowerShell)) {
    return { kind: "safeWrite" };
  }
  let dest = rawDest;
  if (dest.startsWith(`'`) && dest.endsWith(`'`) || dest.startsWith('"') && dest.endsWith('"')) {
    dest = dest.slice(1, -1);
  }
  return { kind: "unsafeWrite", dest };
}
const pwshFlagEqualsRegex = /(^|\s)(-{1,2}[\w-]+)=/g;
function maskPwshFlagEquals(commandLine) {
  return commandLine.replace(pwshFlagEqualsRegex, (_, pre, flag) => `${pre}${flag} `);
}
const pwshNoSpaceRedirectRegex = /^[0-9*]?>>?/;
const neverMatchRegex = /(?!.*)/;
const transientEnvVarRegex = /^[A-Z_][A-Z0-9_]*=/i;
const sedFileWriteParser = new SedFileWriteParser();
class CommandAutoApprover extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._initPromise = this._initTreeSitter();
  }
  /**
   * Returns a promise that resolves once tree-sitter WASM has been loaded.
   * Await this before processing any events to guarantee that
   * {@link shouldAutoApprove} can parse commands synchronously.
   */
  initialize() {
    return this._initPromise;
  }
  /**
   * Synchronously check whether the given command line should be auto-approved.
   * Uses tree-sitter (if loaded) to parse compound commands into sub-commands.
   *
   * When the command contains write redirections, `options.isWriteDestApproved`
   * is consulted for each destination. If every destination is approved by the
   * predicate, write redirections do not block auto-approval.
   */
  shouldAutoApprove(commandLine, options) {
    return this.evaluate(commandLine, options).result;
  }
  /** Evaluates the command and reports whether adding a persistent allow rule could resolve the result. */
  evaluate(commandLine, options) {
    const trimmed = commandLine.trimStart();
    if (trimmed.length === 0) {
      return { result: "approved", autoApproveRuleResolvable: false };
    }
    const rules = this._compileRules(options?.autoApproveRules);
    const isPowerShell = options?.language === "powershell";
    if (this._matchesCommandLineRule(trimmed, rules.denyCommandLineRules)) {
      return { result: "denied", autoApproveRuleResolvable: false };
    }
    const parsed = this._extractSubCommands(trimmed, isPowerShell);
    if (!parsed) {
      this._logService.trace("[CommandAutoApprover] Command line could not be analyzed, requiring confirmation");
      return { result: "noMatch", autoApproveRuleResolvable: false };
    }
    const hasUnapprovedRedirect = () => parsed.unsafeWriteDests.some((dest) => dest === void 0 || !options?.isWriteDestApproved?.(dest));
    let result = this._matchSubCommands(parsed.subCommands, rules, isPowerShell);
    if (result !== "denied" && this._matchesCommandLineRule(trimmed, rules.allowCommandLineRules)) {
      result = "approved";
    }
    if (result === "approved" && hasUnapprovedRedirect()) {
      this._logService.trace("[CommandAutoApprover] Write redirection to non-approved destination, requiring confirmation");
      return { result: "noMatch", autoApproveRuleResolvable: false };
    }
    return { result, autoApproveRuleResolvable: result === "noMatch" && !hasUnapprovedRedirect() };
  }
  _matchSubCommands(subCommands, rules, isPowerShell) {
    let allApproved = true;
    for (const subCommand of subCommands) {
      if (sedFileWriteParser.canHandle(subCommand)) {
        return "denied";
      }
      if (transientEnvVarRegex.test(subCommand)) {
        return "denied";
      }
      const result = this._matchSingleCommand(subCommand, rules, isPowerShell);
      if (result === "denied") {
        return "denied";
      }
      if (result !== "approved") {
        allApproved = false;
      }
    }
    return allApproved ? "approved" : "noMatch";
  }
  _matchSingleCommand(command, rules, isPowerShell) {
    if (this._matchesRule(command, rules.denyRules, isPowerShell)) {
      return "denied";
    }
    if (this._matchesRule(command, rules.allowRules, isPowerShell)) {
      return "approved";
    }
    return "noMatch";
  }
  _matchesCommandLineRule(commandLine, rules) {
    return rules.some((rule) => rule.regex.test(commandLine));
  }
  _matchesRule(command, rules, isPowerShell) {
    for (const rule of rules) {
      if ((isPowerShell ? rule.regexCaseInsensitive : rule.regex).test(command)) {
        return true;
      }
      if (isPowerShell && command.startsWith("(") && rule.regexCaseInsensitive.test(command.slice(1))) {
        return true;
      }
    }
    return false;
  }
  // ---- Tree-sitter --------------------------------------------------------
  _extractSubCommands(commandLine, isPowerShell) {
    const language = isPowerShell ? this._powershellLanguage : this._bashLanguage;
    if (!this._parser || !language || !this._queryClass) {
      return void 0;
    }
    try {
      this._parser.setLanguage(language);
      const masked = isPowerShell ? maskPwshFlagEquals(commandLine) : commandLine;
      const tree = this._parser.parse(masked);
      if (!tree) {
        return void 0;
      }
      try {
        if (shouldRequireConfirmationForAutoApproveParse(isPowerShell ? "powershell" : "bash", tree.rootNode.hasError)) {
          this._logService.trace("[CommandAutoApprover] PowerShell parse contains errors, requiring confirmation");
          return void 0;
        }
        const query = new this._queryClass(language, isPowerShell ? "(command) @command (redirection) @redirection (generic_token) @generic_token (assignment_expression) @unanalyzable (invokation_expression) @unanalyzable" : "(command) @command (file_redirect) @file_redirect (heredoc_redirect) @heredoc_redirect (herestring_redirect) @herestring_redirect (variable_assignment) @unanalyzable (declaration_command) @unanalyzable");
        const captures = query.captures(tree.rootNode);
        const subCommands = [];
        const unsafeWriteDests = [];
        let unanalyzableType;
        for (const capture of captures) {
          const text = masked === commandLine ? capture.node.text : commandLine.substring(capture.node.startIndex, capture.node.endIndex);
          if (capture.name === "command") {
            subCommands.push(text);
          } else if (capture.name === "unanalyzable" && (capture.node.type !== "variable_assignment" || capture.node.parent?.type !== "command")) {
            unanalyzableType ??= capture.node.type;
          } else if (capture.name === "file_redirect" || capture.name === "redirection" || capture.name === "generic_token" && pwshNoSpaceRedirectRegex.test(text)) {
            const cls = classifyFileRedirect(text, isPowerShell);
            if (cls.kind === "unsafeWrite") {
              unsafeWriteDests.push(cls.dest);
            }
          } else if (capture.name === "heredoc_redirect" || capture.name === "herestring_redirect") {
          }
        }
        query.delete();
        if (unanalyzableType) {
          this._logService.trace(`[CommandAutoApprover] Command line contains an unanalyzable ${unanalyzableType}, requiring confirmation`);
          return void 0;
        }
        return subCommands.length > 0 || unsafeWriteDests.length > 0 ? { subCommands, unsafeWriteDests } : void 0;
      } finally {
        tree.delete();
      }
    } catch (err) {
      this._logService.warn("[CommandAutoApprover] Tree-sitter parsing failed", err);
      return void 0;
    }
  }
  async _initTreeSitter() {
    try {
      const { default: TreeSitter } = await import("@vscode/tree-sitter-wasm");
      if (this._store.isDisposed) {
        return;
      }
      const moduleRoot = URI.joinPath(FileAccess.asFileUri(getAppNodeModulesPath()), "@vscode", "tree-sitter-wasm", "wasm");
      const wasmPath = URI.joinPath(moduleRoot, "tree-sitter.wasm").fsPath;
      await TreeSitter.Parser.init({
        locateFile() {
          return wasmPath;
        }
      });
      if (this._store.isDisposed) {
        return;
      }
      const parser = new TreeSitter.Parser();
      this._register(toDisposable(() => {
        try {
          parser.delete();
        } catch {
        }
      }));
      const loadGrammar = async (fileName) => {
        const grammarWasm = await fs.promises.readFile(URI.joinPath(moduleRoot, fileName).fsPath);
        return TreeSitter.Language.load(new Uint8Array(grammarWasm.buffer, grammarWasm.byteOffset, grammarWasm.byteLength));
      };
      const [bashLanguage, powershellLanguage] = await Promise.allSettled([
        loadGrammar("tree-sitter-bash.wasm"),
        loadGrammar("tree-sitter-powershell.wasm")
      ]);
      if (this._store.isDisposed) {
        return;
      }
      this._parser = parser;
      this._queryClass = TreeSitter.Query;
      if (bashLanguage.status === "fulfilled") {
        this._bashLanguage = bashLanguage.value;
      } else {
        this._logService.warn("[CommandAutoApprover] Failed to load the bash grammar; bash commands will require confirmation", bashLanguage.reason);
      }
      if (powershellLanguage.status === "fulfilled") {
        this._powershellLanguage = powershellLanguage.value;
      } else {
        this._logService.warn("[CommandAutoApprover] Failed to load the PowerShell grammar; PowerShell commands will require confirmation", powershellLanguage.reason);
      }
      this._logService.info(`[CommandAutoApprover] Tree-sitter initialized (bash=${this._bashLanguage ? "available" : "unavailable"}, powershell=${this._powershellLanguage ? "available" : "unavailable"})`);
    } catch (err) {
      this._logService.warn("[CommandAutoApprover] Failed to initialize tree-sitter", err);
    }
  }
  // ---- Rules --------------------------------------------------------------
  _compileRules(ruleConfig) {
    if (!ruleConfig) {
      if (!this._fallbackRules) {
        this._fallbackRules = this._compileRuleEntries(DEFAULT_TERMINAL_AUTO_APPROVE_RULES);
      }
      return this._fallbackRules;
    }
    if (this._cachedRuleConfig === ruleConfig && this._cachedRules) {
      return this._cachedRules;
    }
    this._cachedRuleConfig = ruleConfig;
    this._cachedRules = this._compileRuleEntries(ruleConfig);
    return this._cachedRules;
  }
  _compileRuleEntries(ruleConfig) {
    const allowRules = [];
    const denyRules = [];
    const allowCommandLineRules = [];
    const denyCommandLineRules = [];
    for (const [key, value] of Object.entries(ruleConfig)) {
      const regex = convertAutoApproveEntryToRegex(key);
      const rule = {
        regex,
        regexCaseInsensitive: regex.flags.includes("i") ? regex : new RegExp(regex.source, regex.flags + "i")
      };
      if (value === true) {
        allowRules.push(rule);
      } else if (value === false) {
        denyRules.push(rule);
      } else if (value && typeof value === "object" && typeof value.approve === "boolean") {
        if (value.approve) {
          if (value.matchCommandLine === true) {
            allowCommandLineRules.push(rule);
          } else {
            allowRules.push(rule);
          }
        } else {
          if (value.matchCommandLine === true) {
            denyCommandLineRules.push(rule);
          } else {
            denyRules.push(rule);
          }
        }
      }
    }
    return { allowRules, denyRules, allowCommandLineRules, denyCommandLineRules };
  }
}
function convertAutoApproveEntryToRegex(value) {
  const regexMatch = value.match(/^\/(?<pattern>.+)\/(?<flags>[dgimsuvy]*)$/);
  const regexPattern = regexMatch?.groups?.pattern;
  if (regexPattern) {
    let flags = regexMatch.groups?.flags;
    if (flags) {
      flags = flags.replaceAll("g", "");
    }
    if (regexPattern === ".*") {
      return new RegExp(regexPattern);
    }
    try {
      const regex = new RegExp(regexPattern, flags || void 0);
      if (regExpLeadsToEndlessLoop(regex)) {
        return neverMatchRegex;
      }
      return regex;
    } catch {
      return neverMatchRegex;
    }
  }
  if (value === "") {
    return neverMatchRegex;
  }
  let sanitizedValue;
  if (value.includes("/") || value.includes("\\")) {
    let pattern = value.replace(/[/\\]/g, "%%PATH_SEP%%");
    pattern = escapeRegExpCharacters(pattern);
    pattern = pattern.replace(/%%PATH_SEP%%*/g, "[/\\\\]");
    sanitizedValue = `^(?:\\.[/\\\\])?${pattern}`;
  } else {
    sanitizedValue = escapeRegExpCharacters(value);
  }
  return new RegExp(`^${sanitizedValue}\\b`);
}
const DEFAULT_TERMINAL_AUTO_APPROVE_RULES = {
  // Safe readonly commands
  cd: true,
  echo: true,
  ls: true,
  dir: true,
  pwd: true,
  cat: true,
  head: true,
  tail: true,
  findstr: true,
  wc: true,
  tr: true,
  cut: true,
  cmp: true,
  which: true,
  basename: true,
  dirname: true,
  realpath: true,
  readlink: true,
  stat: true,
  file: true,
  od: true,
  du: true,
  df: true,
  sleep: true,
  nl: true,
  grep: true,
  // Safe git sub-commands
  ...gitAutoApproveRules,
  // Docker readonly sub-commands
  "/^docker\\s+(ps|images|info|version|inspect|logs|top|stats|port|diff|search|events)\\b/": true,
  "/^docker\\s+(container|image|network|volume|context|system)\\s+(ls|ps|inspect|history|show|df|info)\\b/": true,
  "/^docker\\s+compose\\s+(ps|ls|top|logs|images|config|version|port|events)\\b/": true,
  // PowerShell
  ...powershellAutoApproveRules,
  // Package manager read-only commands
  "/^npm\\s+(ls|list|outdated|view|info|show|explain|why|root|prefix|bin|search|doctor|fund|repo|bugs|docs|home|help(-search)?)\\b/": true,
  "/^npm\\s+config\\s+(list|get)\\b/": true,
  "/^npm\\s+pkg\\s+get\\b/": true,
  "/^npm\\s+audit$/": true,
  "/^npm\\s+cache\\s+verify\\b/": true,
  "/^yarn\\s+(list|outdated|info|why|bin|help|versions)\\b/": true,
  "/^yarn\\s+licenses\\b/": true,
  "/^yarn\\s+audit\\b(?!.*\\bfix\\b)/": true,
  "/^yarn\\s+config\\s+(list|get)\\b/": true,
  "/^yarn\\s+cache\\s+dir\\b/": true,
  "/^pnpm\\s+(ls|list|outdated|why|root|bin|doctor)\\b/": true,
  "/^pnpm\\s+licenses\\b/": true,
  "/^pnpm\\s+audit\\b(?!.*\\bfix\\b)/": true,
  "/^pnpm\\s+config\\s+(list|get)\\b/": true,
  // Safe lockfile-only installs
  "npm ci": true,
  "/^yarn\\s+install\\s+--frozen-lockfile\\b/": true,
  "/^pnpm\\s+install\\s+--frozen-lockfile\\b/": true,
  // Safe commands with dangerous arg blocking
  column: true,
  "/^column\\b.*\\s-c\\s+[0-9]{4,}/": false,
  date: true,
  "/^date\\b.*\\s(-s|--set)\\b/": false,
  find: true,
  "/^find\\b.*\\s-(delete|exec|execdir|fprint|fprintf|fls|ok|okdir)\\b/": false,
  rg: true,
  "/^rg\\b.*\\s(--pre|--hostname-bin)\\b/": false,
  // TODO: replace sed deny regexes with a shared script analyzer — https://github.com/microsoft/vscode/issues/329218
  sed: true,
  "/^sed\\b.*\\s(-[a-zA-Z]*(e|f)[a-zA-Z]*|--expression|--file)\\b/": false,
  "/^sed\\b.*s\\/.*\\/.*\\/[ew]/": false,
  // Quoted positional script whose first command is e/r/R/w/W. The opening quote is
  // captured so the closing quote must match it, and whitespace and `!` are allowed
  // around the optional address since sed ignores them. The option prefix also skips
  // the separate operand consumed by -l/--line-length.
  "/^sed\\b(?:\\s+(?:(?:-l|--line-length)\\s+\\S+|--line-length=\\S+|-\\S+))*\\s+(['\"])\\s*(?:(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/)(?:\\s*,\\s*(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/))?)?\\s*!?\\s*[erRwW](?:\\s|\\1)/": false,
  // Same dangerous commands after a `;` or `{` separator inside a quoted script.
  // Escaped characters are consumed before testing for the matching closing quote.
  "/^sed\\b(?:\\s+(?:(?:-l|--line-length)\\s+\\S+|--line-length=\\S+|-\\S+))*\\s+(['\"])(?:\\\\.|(?!\\1).)*[;{]\\s*(?:(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/)(?:\\s*,\\s*(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/))?)?\\s*!?\\s*[erRwW](?:\\s|\\1|[;}])/": false,
  // Unquoted positional script form (e.g. `sed 1e id`, `sed w file`, `sed /pat/e file`)
  "/^sed\\b(?:\\s+(?:(?:-l|--line-length)\\s+\\S+|--line-length=\\S+|-\\S+))*\\s+(?:(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/)(?:\\s*,\\s*(?:\\d+|\\$|\\/(?:\\\\.|[^\\/])*\\/))?)?\\s*!?\\s*[erRwW](?:\\s|$)/": false,
  ...sortAutoApproveRules,
  tree: true,
  "/^tree\\b.*\\s-o\\b/": false,
  "/^xxd$/": true,
  "/^xxd\\b(\\s+-\\S+)*\\s+[^-\\s]\\S*$/": true,
  // Dangerous commands
  rm: false,
  rmdir: false,
  del: false,
  "Remove-Item": false,
  ri: false,
  rd: false,
  erase: false,
  dd: false,
  kill: false,
  ps: false,
  top: false,
  "Stop-Process": false,
  spps: false,
  taskkill: false,
  "taskkill.exe": false,
  curl: false,
  wget: false,
  "Invoke-RestMethod": false,
  "Invoke-WebRequest": false,
  irm: false,
  iwr: false,
  chmod: false,
  chown: false,
  "Set-ItemProperty": false,
  sp: false,
  "Set-Acl": false,
  jq: false,
  xargs: false,
  eval: false,
  "Invoke-Expression": false,
  iex: false
};
export {
  CommandAutoApprover
};
