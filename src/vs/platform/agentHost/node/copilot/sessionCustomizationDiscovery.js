var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { appendFile, mkdir } from "fs/promises";
import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { joinPath, dirname as uriDirname, extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { compare as compareStrings } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { basename, isAbsolute, dirname as nodeDirname } from "../../../../base/common/path.js";
import { IFileService } from "../../../files/common/files.js";
import { ILogService } from "../../../log/common/log.js";
import { CustomizationLoadStatus, CustomizationType, customizationId } from "../../common/state/sessionState.js";
import { toAgentCustomizationMeta } from "../../common/meta/agentCustomizationMeta.js";
import { raceCancellationError } from "../../../../base/common/async.js";
var DiscoveredType = /* @__PURE__ */ ((DiscoveredType2) => {
  DiscoveredType2["Agent"] = "agent";
  DiscoveredType2["Skill"] = "skill";
  DiscoveredType2["Instruction"] = "instruction";
  DiscoveredType2["Hook"] = "hook";
  DiscoveredType2["AgentInstruction"] = "agentInstruction";
  return DiscoveredType2;
})(DiscoveredType || {});
function areDiscoveredDirectoriesEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.type !== right.type || left.uri.toString() !== right.uri.toString() || !areDiscoveredFilesEqual(left.files, right.files)) {
      return false;
    }
  }
  return true;
}
function compareDiscoveredDirectory(a, b) {
  const byType = compareStrings(a.type, b.type);
  if (byType !== 0) {
    return byType;
  }
  return compareStrings(a.uri.toString(), b.uri.toString());
}
function areDiscoveredFilesEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.uri.toString() !== right.uri.toString() || left.etag !== right.etag) {
      return false;
    }
  }
  return true;
}
function compareDiscoveredFile(a, b) {
  return compareStrings(a.uri.toString(), b.uri.toString());
}
function compareDirectoryCustomization(a, b) {
  const byUri = compareStrings(a.uri, b.uri);
  if (byUri !== 0) {
    return byUri;
  }
  return compareStrings(a.contents, b.contents);
}
const MAX_INSTRUCTIONS_RECURSION_DEPTH = 5;
const MAX_HOOKS_RECURSION_DEPTH = 8;
const AGENT_FILE_SUFFIX = ".agent.md";
const MARKDOWN_SUFFIX = ".md";
const INSTRUCTION_FILE_SUFFIX = ".instructions.md";
const HOOK_FILE_SUFFIX = ".json";
const SKILL_FILENAME = "SKILL.md";
const README_FILENAME = "README.md";
const CUSTOMIZATION_DISCOVERY_DEBUG_LOG_PATH = void 0;
const AGENT_INSTRUCTION_FILENAMES = /* @__PURE__ */ new Set(["agents.md", "claude.md", "gemini.md", "copilot-instructions.md"]);
const searchRoots = {
  workspace: [
    { path: [".github", "agents"], type: "agent" /* Agent */, name: ".github" },
    { path: [".claude", "agents"], type: "agent" /* Agent */, name: ".claude" },
    { path: [".github", "skills"], recursive: true, type: "skill" /* Skill */, name: ".github" },
    { path: [".agents", "skills"], recursive: true, type: "skill" /* Skill */, name: ".agents" },
    { path: [".claude", "skills"], recursive: true, type: "skill" /* Skill */, name: ".claude" },
    { path: [".github", "instructions"], recursive: true, type: "instruction" /* Instruction */, name: ".github" },
    { path: [".github", "hooks"], recursive: true, type: "hook" /* Hook */, name: ".github" }
  ],
  user: [
    { path: [".copilot", "agents"], type: "agent" /* Agent */, name: "~/.copilot" },
    { path: [".agents", "skills"], recursive: true, type: "skill" /* Skill */, name: "~/.agents" },
    { path: [".copilot", "skills"], recursive: true, type: "skill" /* Skill */, name: "~/.copilot" },
    { path: [".copilot", "instructions"], recursive: true, type: "instruction" /* Instruction */, name: "~/.copilot" },
    { path: [".copilot", "hooks"], recursive: true, type: "hook" /* Hook */, name: "~/.copilot" }
  ]
};
const fixedDiscoveryFiles = {
  workspace: [
    { path: [".github"], filenames: ["copilot-instructions.md"], type: "agentInstruction" /* AgentInstruction */ },
    { path: [], filenames: ["AGENTS.md", "CLAUDE.md", "GEMINI.md"], type: "agentInstruction" /* AgentInstruction */ },
    { path: [".claude"], filenames: ["CLAUDE.md"], type: "agentInstruction" /* AgentInstruction */ },
    { path: [".github", "copilot"], filenames: ["settings.json", "settings.local.json"], type: "hook" /* Hook */ },
    { path: [".claude"], filenames: ["settings.json", "settings.local.json"], type: "hook" /* Hook */ }
  ],
  user: [
    { path: [".copilot"], filenames: ["copilot-instructions.md"], type: "agentInstruction" /* AgentInstruction */ }
  ]
};
const agentInstructions = fixedDiscoveryFiles;
function throwIfCancelled(token) {
  if (token.isCancellationRequested) {
    throw new CancellationError();
  }
}
function addWatch(map, watchUri, recursive, resourceToWatch) {
  let entry = map.get(watchUri);
  if (!entry) {
    entry = { recursive, resourcesToWatch: new ResourceSet() };
    map.set(watchUri, entry);
  } else if (recursive && !entry.recursive) {
    entry = { recursive: true, resourcesToWatch: entry.resourcesToWatch };
    map.set(watchUri, entry);
  }
  entry.resourcesToWatch.add(resourceToWatch);
}
let SessionCustomizationDiscovery = class extends Disposable {
  constructor(_workingDirectories, _userHome, _pathToUri = URI.file, _fileService, _logService) {
    super();
    this._workingDirectories = _workingDirectories;
    this._userHome = _userHome;
    this._pathToUri = _pathToUri;
    this._fileService = _fileService;
    this._logService = _logService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._discoveredDirectories = void 0;
    this._watchers = new ResourceMap();
    if (_workingDirectories.length === 0) {
      this.dispose();
      throw new Error("SessionCustomizationDiscovery requires at least one working directory (index 0 = primary root).");
    }
    this._register({ dispose: () => this._disposeAllWatchers() });
    this._register(this._fileService.onDidFilesChange((e) => {
      for (const watcher of this._watchers.values()) {
        for (const uri of watcher.resourcesToWatch) {
          if (e.affects(uri)) {
            this._scheduleRefresh();
            return;
          }
        }
      }
    }));
  }
  _scheduleRefresh() {
    this._onDidChange.fire();
  }
  /**
   * True when `uri` is one of the workspace roots or the user home — i.e. an
   * ancestor-walk boundary. With a single root this is exactly the previous
   * `isEqual(uri, workingDirectory) || isEqual(uri, userHome)` check.
   */
  _isDiscoveryBoundary(uri) {
    if (extUriBiasedIgnorePathCase.isEqual(uri, this._userHome)) {
      return true;
    }
    return this._workingDirectories.some((root) => extUriBiasedIgnorePathCase.isEqual(uri, root));
  }
  /**
   * The workspace root that contains (or equals) `uri`, or `undefined` when it
   * lives under none of them. Prefers the most specific root when roots nest.
   */
  _containingWorkspaceRoot(uri) {
    let best;
    for (const root of this._workingDirectories) {
      if (extUriBiasedIgnorePathCase.isEqualOrParent(uri, root) && (!best || root.path.length > best.path.length)) {
        best = root;
      }
    }
    return best;
  }
  /**
   * Maps an SDK-supplied `projectPath` (an fs path string) back to the original
   * workspace-root {@link URI}, preserving its scheme/authority. Returns
   * `undefined` when the path matches none of the roots.
   */
  _rootForProjectPath(projectPath) {
    if (!projectPath) {
      return void 0;
    }
    const target = this._pathToUri(projectPath);
    return this._workingDirectories.find((root) => extUriBiasedIgnorePathCase.isEqual(root, target));
  }
  /**
   * The working-directory roots that hooks are discovered from.
   *
   * **Hooks are discovered from the PRIMARY working directory only** (index 0 of
   * {@link _workingDirectories}, which callers MUST order primary-first). Hooks
   * from non-primary roots are intentionally NOT discovered because the Copilot
   * agent currently applies hooks from a single primary directory only. Every
   * other customization types (agents, skills, and instructions) are discovered
   * across all roots.
   *
   * Example: for roots `[B, A, C]` (with `B` selected as primary), hooks are
   * discovered from `B` only; hooks under `A`/`C` are ignored.
   *
   * This may expand to all roots in the future — see `MULTI_ROOT_CHANGES.md`.
   */
  get _hookWorkingDirectories() {
    return this._workingDirectories.slice(0, 1);
  }
  async writeCustomizationDiscoveryDebugLog(payload) {
    if (!CUSTOMIZATION_DISCOVERY_DEBUG_LOG_PATH) {
      return;
    }
    try {
      await mkdir(nodeDirname(CUSTOMIZATION_DISCOVERY_DEBUG_LOG_PATH), { recursive: true });
      await appendFile(CUSTOMIZATION_DISCOVERY_DEBUG_LOG_PATH, `${JSON.stringify({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ...payload
      }, void 0, 2)}
`, "utf8");
    } catch (err) {
      this._logService.error(`[SessionCustomizationDiscovery] Failed to write discovery debug log: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  async getDiscoveredDirectories(client, token) {
    throwIfCancelled(token);
    const p = { projectPaths: this._workingDirectories.map((uri) => uri.fsPath) };
    const result = this.getHooksDiscoveryPaths();
    const workspaceAgentInstructionFilesByRoot = new ResourceMap();
    const userAgentInstructionFiles = [];
    try {
      const [agentDiscovery, instructionDiscovery, skillDiscovery] = await Promise.all([
        raceCancellationError(client.rpc.agents.getDiscoveryPaths(p), token),
        raceCancellationError(client.rpc.instructions.getDiscoveryPaths(p), token),
        raceCancellationError(client.rpc.skills.getDiscoveryPaths(p), token)
      ]);
      for (const agentPath of agentDiscovery?.paths ?? []) {
        throwIfCancelled(token);
        result.push({
          uri: this._pathToUri(agentPath.path),
          type: "agent" /* Agent */,
          files: [],
          name: basename(agentPath.path),
          writable: true
        });
      }
      for (const instructionPath of instructionDiscovery?.paths ?? []) {
        throwIfCancelled(token);
        if (instructionPath.kind === "file") {
          const fileUri = this._pathToUri(instructionPath.path);
          const discoveredFile = { uri: fileUri, etag: "" };
          const containingRoot = this._containingWorkspaceRoot(fileUri);
          if (containingRoot) {
            const files = workspaceAgentInstructionFilesByRoot.get(containingRoot) ?? [];
            files.push(discoveredFile);
            workspaceAgentInstructionFilesByRoot.set(containingRoot, files);
          } else if (extUriBiasedIgnorePathCase.isEqualOrParent(fileUri, this._userHome)) {
            userAgentInstructionFiles.push(discoveredFile);
          }
          continue;
        } else if (instructionPath.kind === "directory") {
          result.push({
            uri: this._pathToUri(instructionPath.path),
            type: "instruction" /* Instruction */,
            files: [],
            name: basename(instructionPath.path),
            writable: true
          });
        }
      }
      for (const [root, files] of workspaceAgentInstructionFilesByRoot) {
        if (files.length > 0) {
          result.push({
            uri: root,
            type: "agentInstruction" /* AgentInstruction */,
            files,
            name: "",
            writable: false
          });
        }
      }
      if (userAgentInstructionFiles.length > 0) {
        result.push({
          uri: this._userHome,
          type: "agentInstruction" /* AgentInstruction */,
          files: userAgentInstructionFiles,
          name: "",
          writable: false
        });
      }
      for (const skillPath of skillDiscovery?.paths ?? []) {
        throwIfCancelled(token);
        result.push({
          uri: this._pathToUri(skillPath.path),
          type: "skill" /* Skill */,
          files: [],
          name: basename(skillPath.path),
          writable: true
        });
      }
    } catch (err) {
      if (err instanceof CancellationError) {
        throw err;
      }
      this._logService.debug(`[SessionCustomizationDiscovery] Error getting discovery paths: ${err instanceof Error ? err.message : String(err)}`);
    }
    return result.sort(compareDiscoveredDirectory);
  }
  getHooksDiscoveryPaths() {
    const byUri = new ResourceMap();
    const add = (uri, name) => {
      if (!byUri.has(uri)) {
        byUri.set(uri, { uri, type: "hook" /* Hook */, files: [], name, writable: true });
      }
    };
    for (const root of searchRoots.workspace) {
      if (root.type === "hook" /* Hook */) {
        for (const workingDirectory of this._hookWorkingDirectories) {
          add(joinPath(workingDirectory, ...root.path), root.name);
        }
      }
    }
    for (const root of searchRoots.user) {
      if (root.type === "hook" /* Hook */) {
        add(joinPath(this._userHome, ...root.path), root.name);
      }
    }
    for (const root of fixedDiscoveryFiles.workspace) {
      if (root.type === "hook" /* Hook */) {
        for (const workingDirectory of this._hookWorkingDirectories) {
          add(joinPath(workingDirectory, ...root.path), basename(joinPath(workingDirectory, ...root.path).path));
        }
      }
    }
    for (const root of fixedDiscoveryFiles.user) {
      if (root.type === "hook" /* Hook */) {
        add(joinPath(this._userHome, ...root.path), basename(joinPath(this._userHome, ...root.path).path));
      }
    }
    return [...byUri.values()];
  }
  async _updateWatchers(discoveredDirectories, token) {
    const nextWatchRootUris = new ResourceMap();
    const toResolve = new ResourceSet();
    const recursiveByDirectory = new ResourceMap();
    for (const discoveredDir of discoveredDirectories) {
      throwIfCancelled(token);
      const dirUri = discoveredDir.uri;
      const recursive = discoveredDir.type === "skill" /* Skill */ || discoveredDir.type === "instruction" /* Instruction */ || discoveredDir.type === "hook" /* Hook */;
      recursiveByDirectory.set(dirUri, recursive);
      toResolve.add(dirUri);
      let current = dirUri;
      while (!this._isDiscoveryBoundary(current)) {
        const parent = uriDirname(current);
        if (extUriBiasedIgnorePathCase.isEqual(parent, current)) {
          break;
        }
        toResolve.add(parent);
        current = parent;
      }
      for (const file of discoveredDir.files) {
        throwIfCancelled(token);
        let currentFilePath = file.uri;
        while (!this._isDiscoveryBoundary(currentFilePath)) {
          const parent = uriDirname(currentFilePath);
          if (extUriBiasedIgnorePathCase.isEqual(parent, currentFilePath)) {
            break;
          }
          toResolve.add(parent);
          currentFilePath = parent;
        }
      }
    }
    throwIfCancelled(token);
    const toResolveArray = [...toResolve];
    const statResults = await this._fileService.resolveAll(toResolveArray.map((resource) => ({ resource })));
    const existingDirectories = new ResourceSet();
    for (let i = 0; i < statResults.length; i++) {
      const result = statResults[i];
      if (result.success && result.stat?.isDirectory) {
        existingDirectories.add(toResolveArray[i]);
      }
    }
    for (const discoveredDir of discoveredDirectories) {
      throwIfCancelled(token);
      const dirUri = discoveredDir.uri;
      const recursive = recursiveByDirectory.get(dirUri) ?? false;
      if (existingDirectories.has(dirUri)) {
        addWatch(nextWatchRootUris, dirUri, recursive, dirUri);
      }
      let current = dirUri;
      while (!this._isDiscoveryBoundary(current)) {
        const parent = uriDirname(current);
        if (extUriBiasedIgnorePathCase.isEqual(parent, current)) {
          break;
        }
        if (existingDirectories.has(parent)) {
          addWatch(nextWatchRootUris, parent, false, current);
        }
        current = parent;
      }
      for (const file of discoveredDir.files) {
        throwIfCancelled(token);
        let currentFilePath = file.uri;
        while (!this._isDiscoveryBoundary(currentFilePath)) {
          const parent = uriDirname(currentFilePath);
          if (extUriBiasedIgnorePathCase.isEqual(parent, currentFilePath)) {
            break;
          }
          if (existingDirectories.has(parent)) {
            addWatch(nextWatchRootUris, parent, false, currentFilePath);
          }
          currentFilePath = parent;
        }
      }
    }
    this._reconcileWatchers(nextWatchRootUris);
  }
  async discover(client, token) {
    await this.writeCustomizationDiscoveryDebugLog({
      method: "discover",
      workingDirectories: this._workingDirectories.map((d) => d.toString()),
      userHome: this._userHome.toString()
    });
    if (!this._discoveredDirectories) {
      this._discoveredDirectories = await this.getDiscoveredDirectories(client, token);
    }
    throwIfCancelled(token);
    const p = { projectPaths: this._workingDirectories.map((uri) => uri.fsPath) };
    try {
      const [agents, rules, skills, hooks] = await Promise.all([
        this.discoverAgents(p, client, token),
        this.discoverRules(p, client, token),
        this.discoverSkills(p, client, token),
        this.discoverHooks(token),
        this._updateWatchers(this._discoveredDirectories, token)
      ]);
      throwIfCancelled(token);
      const result = [];
      await this.toDirectoryCustomizations(CustomizationType.Agent, agents, this._discoveredDirectories, result);
      await this.toDirectoryCustomizations(CustomizationType.Rule, rules, this._discoveredDirectories, result);
      await this.toDirectoryCustomizations(CustomizationType.Skill, skills, this._discoveredDirectories, result);
      await this.toDirectoryCustomizations(CustomizationType.Hook, hooks, this._discoveredDirectories, result);
      const sortedResult = result.sort(compareDirectoryCustomization);
      await this.writeCustomizationDiscoveryDebugLog({
        method: "discover",
        result: sortedResult.map((customization) => ({
          contents: customization.contents,
          uri: customization.uri,
          children: (customization.children ?? []).map((child) => ({ type: child.type, uri: child.uri, name: child.name }))
        }))
      });
      return sortedResult;
    } catch (err) {
      this._logService.error(`[SessionCustomizationDiscovery] Error during discovery: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
  async discoverAgents(discoveryRequest, client, token) {
    const agents = [];
    const agentDiscovery = await raceCancellationError(client.rpc.agents.discover(discoveryRequest), token);
    for (const agent of agentDiscovery.agents) {
      if (agent.path) {
        const uri = this._pathToUri(agent.path);
        agents.push({ type: CustomizationType.Agent, uri: uri.toString(), id: agent.id, name: agent.name, description: agent.description, _meta: toAgentCustomizationMeta({ userInvocable: agent.userInvocable }) });
      }
    }
    return agents;
  }
  async discoverRules(discoveryRequest, client, token) {
    const rules = [];
    const seenRuleUris = /* @__PURE__ */ new Set();
    const instructionDiscovery = await raceCancellationError(client.rpc.instructions.discover(discoveryRequest), token);
    await this.writeCustomizationDiscoveryDebugLog({
      method: "discoverRules.instructions.discover",
      sources: instructionDiscovery.sources.map((source) => ({
        id: source.id,
        label: source.label,
        sourcePath: source.sourcePath,
        applyTo: source.applyTo,
        type: source.type
      }))
    });
    for (const instruction of instructionDiscovery.sources) {
      let uri;
      if (isAbsolute(instruction.sourcePath)) {
        uri = this._pathToUri(instruction.sourcePath);
      } else {
        const anchor = this._rootForProjectPath(instruction.projectPath) ?? this._workingDirectories[0];
        uri = joinPath(anchor, instruction.sourcePath);
      }
      const uriString = uri.toString();
      rules.push({
        type: CustomizationType.Rule,
        uri: uriString,
        id: instruction.id,
        name: instruction.label,
        description: instruction.description,
        globs: instruction.applyTo ? [...instruction.applyTo] : void 0,
        alwaysApply: this._isAgentInstructionSource(instruction)
      });
      seenRuleUris.add(uriString);
    }
    for (const directory of this._discoveredDirectories ?? []) {
      if (directory.type !== "agentInstruction" /* AgentInstruction */) {
        continue;
      }
      for (const file of directory.files) {
        const uri = file.uri.toString();
        if (seenRuleUris.has(uri)) {
          continue;
        }
        rules.push({
          type: CustomizationType.Rule,
          uri,
          id: customizationId(uri),
          name: basename(file.uri.path),
          alwaysApply: true
        });
        seenRuleUris.add(uri);
      }
    }
    return rules;
  }
  _isAgentInstructionSource(instruction) {
    if (instruction.type === "home" || instruction.type === "repo" || instruction.type === "model") {
      return true;
    }
    const filename = basename(instruction.sourcePath).toLowerCase();
    return AGENT_INSTRUCTION_FILENAMES.has(filename);
  }
  async discoverSkills(discoveryRequest, client, token) {
    const skills = [];
    const skillDiscovery = await raceCancellationError(client.rpc.skills.discover(discoveryRequest), token);
    for (const skill of skillDiscovery.skills) {
      if (skill.path) {
        const uri = this._pathToUri(skill.path);
        skills.push({ type: CustomizationType.Skill, uri: uri.toString(), id: skill.path, name: skill.name, description: skill.description });
      }
    }
    return skills;
  }
  async discoverHooks(token) {
    const seen = new ResourceSet();
    const discoveredDirectories = [];
    const hookRootsWorkspace = searchRoots.workspace.filter((root) => root.type === "hook" /* Hook */);
    const hookRootsUser = searchRoots.user.filter((root) => root.type === "hook" /* Hook */);
    const fixedHookFilesWorkspace = fixedDiscoveryFiles.workspace.filter((root) => root.type === "hook" /* Hook */);
    const fixedHookFilesUser = fixedDiscoveryFiles.user.filter((root) => root.type === "hook" /* Hook */);
    await Promise.all([
      // Hooks: primary working directory only (Copilot limitation — see _hookWorkingDirectories).
      ...this._hookWorkingDirectories.flatMap((workingDirectory) => hookRootsWorkspace.map((root) => this._discoverHookRoot(workingDirectory, root, seen, discoveredDirectories, token))),
      ...hookRootsUser.map((root) => this._discoverHookRoot(this._userHome, root, seen, discoveredDirectories, token)),
      ...this._hookWorkingDirectories.map((workingDirectory) => this._discoverFixedHookFiles(workingDirectory, fixedHookFilesWorkspace, seen, discoveredDirectories, token)),
      this._discoverFixedHookFiles(this._userHome, fixedHookFilesUser, seen, discoveredDirectories, token)
    ]);
    const hooks = [];
    for (const directory of discoveredDirectories) {
      for (const file of directory.files) {
        const uri = file.uri.toString();
        hooks.push({
          type: CustomizationType.Hook,
          id: customizationId(uri),
          uri,
          name: basename(file.uri.path)
        });
      }
    }
    hooks.sort((a, b) => compareStrings(a.uri, b.uri));
    return hooks;
  }
  async _discoverHookRoot(base, root, seen, result, token) {
    const rootUri = joinPath(base, ...root.path);
    let stat = void 0;
    try {
      stat = await this._fileService.resolve(rootUri, { resolveMetadata: true });
    } catch {
    }
    await this._scanForHooks(root, rootUri, stat, seen, result, token);
  }
  async _discoverFixedHookFiles(base, roots, seen, result, token) {
    for (const root of roots) {
      throwIfCancelled(token);
      const rootUri = joinPath(base, ...root.path);
      const files = [];
      let stat = void 0;
      try {
        stat = await this._fileService.resolve(rootUri, { resolveMetadata: true });
      } catch {
      }
      for (const child of stat?.children ?? []) {
        throwIfCancelled(token);
        if (child.isFile && root.filenames.includes(child.name)) {
          if (!seen.has(child.resource)) {
            seen.add(child.resource);
            files.push({ uri: child.resource, etag: child.etag });
          }
        }
      }
      if (files.length > 0) {
        result.push({ uri: rootUri, type: "hook" /* Hook */, files: files.sort(compareDiscoveredFile), name: basename(rootUri.path), writable: true });
      }
    }
  }
  async toDirectoryCustomizations(type, customizations, allDiscoveredDirectories, result) {
    const discoveredDirectories = allDiscoveredDirectories.filter((d) => {
      if (type === CustomizationType.Agent) {
        return d.type === "agent" /* Agent */;
      }
      if (type === CustomizationType.Rule) {
        return d.type === "instruction" /* Instruction */ || d.type === "agentInstruction" /* AgentInstruction */;
      }
      if (type === CustomizationType.Hook) {
        return d.type === "hook" /* Hook */;
      }
      return d.type === "skill" /* Skill */;
    });
    const candidateOutputDirectories = type === CustomizationType.Rule ? discoveredDirectories.filter((d) => d.type !== "agentInstruction" /* AgentInstruction */ || this._isDiscoveryBoundary(d.uri)) : discoveredDirectories;
    const outputDirectories = type === CustomizationType.Skill ? candidateOutputDirectories.filter((directory) => !candidateOutputDirectories.some(
      (candidate) => !extUriBiasedIgnorePathCase.isEqual(directory.uri, candidate.uri) && extUriBiasedIgnorePathCase.isEqualOrParent(directory.uri, candidate.uri)
    )) : candidateOutputDirectories;
    const byParent = new ResourceMap();
    for (const discoveredDirectory of outputDirectories) {
      byParent.set(discoveredDirectory.uri, {
        uri: discoveredDirectory.uri,
        name: discoveredDirectory.name || basename(discoveredDirectory.uri.path),
        writable: discoveredDirectory.writable,
        children: []
      });
    }
    const fixedHookDirectoryUris = type === CustomizationType.Hook ? new ResourceSet([
      // Hooks: primary working directory only (Copilot limitation).
      ...this._hookWorkingDirectories.flatMap((workingDirectory) => fixedDiscoveryFiles.workspace.filter((root) => root.type === "hook" /* Hook */).map((root) => joinPath(workingDirectory, ...root.path))),
      ...fixedDiscoveryFiles.user.filter((root) => root.type === "hook" /* Hook */).map((root) => joinPath(this._userHome, ...root.path))
    ]) : void 0;
    const agentInstructionDirectoryUris = new ResourceSet(
      outputDirectories.filter((directory) => directory.type === "agentInstruction" /* AgentInstruction */).map((directory) => directory.uri)
    );
    for (const customization of customizations) {
      if (customization.type !== type) {
        continue;
      }
      const childUri = URI.parse(customization.uri);
      let bestParent = outputDirectories.find((d) => extUriBiasedIgnorePathCase.isEqualOrParent(childUri, d.uri));
      if (!bestParent && customization.type === CustomizationType.Rule && customization.alwaysApply && customization.name.match(/\.md$/i)) {
        bestParent = outputDirectories.find(
          (d) => d.type === "agentInstruction" /* AgentInstruction */ && extUriBiasedIgnorePathCase.isEqualOrParent(childUri, d.uri)
        ) ?? outputDirectories.find((d) => d.type === "agentInstruction" /* AgentInstruction */);
      }
      if (bestParent) {
        for (const candidate of outputDirectories) {
          if (extUriBiasedIgnorePathCase.isEqualOrParent(childUri, candidate.uri) && candidate.uri.path.length > bestParent.uri.path.length) {
            bestParent = candidate;
          }
        }
      }
      const parentUri = bestParent?.uri ?? uriDirname(childUri);
      let entry = byParent.get(parentUri);
      if (!entry) {
        this._logService.error(`[SessionCustomizationDiscovery] BUG: customization '${customization.uri}' of type '${customization.type}' is outside discovered directories; creating fallback directory '${parentUri.toString()}'.`);
        entry = {
          uri: parentUri,
          name: basename(parentUri.path),
          writable: true,
          children: []
        };
        byParent.set(parentUri, entry);
      }
      entry.children.push(customization);
    }
    for (const { uri, name, writable, children } of byParent.values()) {
      if (type === CustomizationType.Hook && fixedHookDirectoryUris?.has(uri) && children.length === 0) {
        continue;
      }
      if (type === CustomizationType.Rule && agentInstructionDirectoryUris.has(uri)) {
        const existingChildren = [];
        for (const child of children) {
          const childUri = URI.parse(child.uri);
          try {
            const stat = await this._fileService.resolve(childUri, { resolveMetadata: true });
            if (stat.isFile) {
              existingChildren.push(child);
            }
          } catch {
          }
        }
        if (existingChildren.length === 0) {
          continue;
        }
        children.length = 0;
        children.push(...existingChildren);
      }
      children.sort((a, b) => compareStrings(a.uri, b.uri));
      result.push({
        type: CustomizationType.Directory,
        id: customizationId(uri.toString()),
        uri: uri.toString(),
        name,
        enabled: true,
        contents: type,
        writable,
        load: { kind: CustomizationLoadStatus.Loaded },
        children
      });
    }
  }
  /**
   * Returns the list of discovered customization directories and files in a sorted way.
   * Also sets up watchers for all discovered root directories (recursively if specified by the root or if already watching recursively).
   * Each call performs a fresh scan scoped to the provided cancellation token.
   */
  async scan(token) {
    await this.writeCustomizationDiscoveryDebugLog({
      method: "scan",
      workingDirectories: this._workingDirectories.map((d) => d.toString()),
      userHome: this._userHome.toString()
    });
    throwIfCancelled(token);
    const nextWatchRootUris = new ResourceMap();
    const seen = new ResourceSet();
    const result = [];
    const workspaceFixedHook = fixedDiscoveryFiles.workspace.filter((root) => root.type === "hook" /* Hook */);
    const workspaceFixedNonHook = fixedDiscoveryFiles.workspace.filter((root) => root.type !== "hook" /* Hook */);
    await Promise.all([
      ...searchRoots.workspace.flatMap((root) => (root.type === "hook" /* Hook */ ? this._hookWorkingDirectories : this._workingDirectories).map((workingDirectory) => this._scanRoot(workingDirectory, root, seen, result, nextWatchRootUris, token))),
      ...searchRoots.user.map((root) => this._scanRoot(this._userHome, root, seen, result, nextWatchRootUris, token)),
      ...this._workingDirectories.map((workingDirectory) => this._scanFixedDiscoveryFiles(workingDirectory, workspaceFixedNonHook, seen, result, nextWatchRootUris, token)),
      ...this._hookWorkingDirectories.map((workingDirectory) => this._scanFixedDiscoveryFiles(workingDirectory, workspaceFixedHook, seen, result, nextWatchRootUris, token)),
      this._scanFixedDiscoveryFiles(this._userHome, fixedDiscoveryFiles.user, seen, result, nextWatchRootUris, token)
    ]);
    throwIfCancelled(token);
    this._reconcileWatchers(nextWatchRootUris);
    const sortedResult = result.sort(compareDiscoveredDirectory);
    await this.writeCustomizationDiscoveryDebugLog({
      method: "scan",
      result: sortedResult.map((directory) => ({
        type: directory.type,
        uri: directory.uri.toString(),
        files: directory.files.map((file) => file.uri.toString())
      }))
    });
    return sortedResult;
  }
  /**
   * Walk the ancestor chain of `path` from `base`. For every ancestor
   * directory that exists, register a non-recursive watcher whose trigger
   * URI is the next path segment, so the handler fires when an intermediate
   * directory (e.g. `.github`, `.github/agents`, `.copilot`) is created and
   * a re-scan is needed to pick up newly-discoverable content.
   *
   * Returns true when every ancestor exists as a directory (i.e. the leaf
   * may exist). Returns false when an ancestor is missing or not a directory,
   * in which case the caller can short-circuit.
   */
  async _watchAncestors(base, path, watchRootUris, token) {
    let current = base;
    for (const segment of path) {
      const parent = current;
      const child = joinPath(parent, segment);
      if (!watchRootUris.has(parent)) {
        throwIfCancelled(token);
        try {
          const stat = await this._fileService.resolve(parent);
          if (!stat.isDirectory) {
            return false;
          }
        } catch {
          return false;
        }
      }
      addWatch(watchRootUris, parent, false, child);
      current = child;
    }
    return true;
  }
  _reconcileWatchers(nextWatchRootUris) {
    for (const [rootUri, watcher] of this._watchers.entries()) {
      const next = nextWatchRootUris.get(rootUri);
      if (!next || next.recursive !== watcher.recursive) {
        watcher.disposable.dispose();
        this._watchers.delete(rootUri);
      }
    }
    for (const [rootUri, next] of nextWatchRootUris.entries()) {
      const existing = this._watchers.get(rootUri);
      if (existing) {
        existing.resourcesToWatch.clear();
        for (const uri of next.resourcesToWatch) {
          existing.resourcesToWatch.add(uri);
        }
        continue;
      }
      try {
        const disposable = this._fileService.watch(rootUri, { recursive: next.recursive, excludes: [] });
        this._watchers.set(rootUri, { recursive: next.recursive, resourcesToWatch: next.resourcesToWatch, disposable });
      } catch (err) {
        this._logService.warn(`[SessionCustomizationDiscovery] Failed to watch '${rootUri.toString()}': ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  _disposeAllWatchers() {
    for (const watcher of this._watchers.values()) {
      watcher.disposable.dispose();
    }
    this._watchers.clear();
  }
  /**
   * For fixed discovery files (e.g. AGENTS.md, copilot-instructions.md,
   * settings.json), create one discovered directory per type at the base.
   */
  async _scanFixedDiscoveryFiles(base, roots, seen, result, watchRootUris, token) {
    const filesByType = /* @__PURE__ */ new Map();
    await Promise.all(roots.map(async (root) => {
      throwIfCancelled(token);
      if (!await this._watchAncestors(base, root.path, watchRootUris, token)) {
        return;
      }
      const rootUri = joinPath(base, ...root.path);
      let stat;
      try {
        stat = await this._fileService.resolve(rootUri, { resolveMetadata: true });
      } catch {
        return;
      }
      if (!stat.isDirectory || !stat.children) {
        return;
      }
      for (const filename of root.filenames) {
        addWatch(watchRootUris, rootUri, false, joinPath(rootUri, filename));
      }
      for (const entry of stat.children) {
        throwIfCancelled(token);
        if (entry.isFile && root.filenames.includes(entry.name)) {
          const uri = joinPath(rootUri, entry.name);
          if (!seen.has(uri)) {
            seen.add(uri);
            const files = filesByType.get(root.type) ?? [];
            files.push({ uri, etag: entry.etag });
            filesByType.set(root.type, files);
          }
        }
      }
    }));
    for (const [type, files] of filesByType.entries()) {
      if (files.length > 0) {
        result.push({ uri: base, type, files: files.sort(compareDiscoveredFile), name: "", writable: false });
      }
    }
  }
  async _scanRoot(base, root, seen, result, watchRootUris, token) {
    throwIfCancelled(token);
    const rootUri = joinPath(base, ...root.path);
    let stat = void 0;
    let children = [];
    try {
      stat = await this._fileService.resolve(rootUri, { resolveMetadata: true });
      children = stat.children ?? [];
    } catch {
    }
    await this._watchAncestors(base, root.path, watchRootUris, token);
    addWatch(watchRootUris, rootUri, root.recursive ?? false, rootUri);
    if (root.type === "skill" /* Skill */) {
      const files = [];
      await Promise.all(children.map(async (child) => {
        throwIfCancelled(token);
        if (child.isDirectory) {
          const skillFile = joinPath(child.resource, SKILL_FILENAME);
          try {
            const skillStat = await this._fileService.resolve(skillFile, { resolveMetadata: true });
            if (skillStat.isFile && !seen.has(skillFile)) {
              seen.add(skillFile);
              files.push({ uri: skillFile, etag: skillStat.etag });
            }
          } catch {
          }
        }
      }));
      result.push({ uri: rootUri, type: root.type, files: files.sort(compareDiscoveredFile), name: root.name, writable: true });
    } else if (root.type === "agent" /* Agent */) {
      const files = [];
      for (const child of children) {
        throwIfCancelled(token);
        if (child.isFile) {
          const filename = child.name;
          if (filename.endsWith(MARKDOWN_SUFFIX) && filename !== README_FILENAME && !seen.has(child.resource)) {
            seen.add(child.resource);
            files.push({ uri: child.resource, etag: child.etag });
          }
        }
      }
      result.push({ uri: rootUri, type: root.type, files: files.sort(compareDiscoveredFile), name: root.name, writable: true });
    } else if (root.type === "instruction" /* Instruction */) {
      const files = [];
      const findInstructions = async (stat2, recursionLevel) => {
        throwIfCancelled(token);
        for (const child of stat2.children ?? []) {
          throwIfCancelled(token);
          if (child.isFile) {
            const name = child.name.toLowerCase();
            if (name.endsWith(INSTRUCTION_FILE_SUFFIX) && !seen.has(child.resource)) {
              seen.add(child.resource);
              files.push({ uri: child.resource, etag: child.etag });
            }
          } else if (child.isDirectory && recursionLevel < MAX_INSTRUCTIONS_RECURSION_DEPTH) {
            let childStat = void 0;
            try {
              childStat = await this._fileService.resolve(child.resource, { resolveMetadata: true });
            } catch {
            }
            if (childStat) {
              await findInstructions(childStat, recursionLevel + 1);
            }
          }
        }
      };
      if (stat) {
        await findInstructions(stat, 0);
      }
      result.push({ uri: rootUri, type: root.type, files: files.sort(compareDiscoveredFile), name: root.name, writable: true });
    } else if (root.type === "hook" /* Hook */) {
      await this._scanForHooks(root, rootUri, stat, seen, result, token);
    } else {
      this._logService.warn(`[SessionCustomizationDiscovery] Unrecognized root type '${root.type}' for root '${rootUri.toString()}'`);
    }
  }
  async _scanForHooks(root, rootUri, stat, seen, result, token) {
    const files = [];
    const findHooks = async (directoryStat, recursionLevel) => {
      throwIfCancelled(token);
      for (const child of directoryStat.children ?? []) {
        throwIfCancelled(token);
        if (child.isFile) {
          const name = child.name.toLowerCase();
          if (name.endsWith(HOOK_FILE_SUFFIX) && !seen.has(child.resource)) {
            seen.add(child.resource);
            files.push({ uri: child.resource, etag: child.etag });
          }
        } else if (child.isDirectory && recursionLevel < MAX_HOOKS_RECURSION_DEPTH) {
          let childStat = void 0;
          try {
            childStat = await this._fileService.resolve(child.resource, { resolveMetadata: true });
          } catch {
          }
          if (childStat) {
            await findHooks(childStat, recursionLevel + 1);
          }
        }
      }
    };
    if (stat) {
      await findHooks(stat, 0);
    }
    result.push({ uri: rootUri, type: root.type, files: files.sort(compareDiscoveredFile), name: root.name, writable: true });
  }
};
SessionCustomizationDiscovery = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService)
], SessionCustomizationDiscovery);
const _internal = {
  AGENT_FILE_SUFFIX,
  INSTRUCTION_FILE_SUFFIX,
  SKILL_FILENAME,
  searchRoots,
  fixedDiscoveryFiles,
  agentInstructions
};
export {
  DiscoveredType,
  SessionCustomizationDiscovery,
  _internal,
  areDiscoveredDirectoriesEqual
};
