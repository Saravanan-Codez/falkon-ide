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
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue, transaction } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { AgentHostPty } from "./agentHostPty.js";
import { AgentHostOutputChannel } from "./agentHostOutputChannel.js";
import { AhpTerminalCommandSource } from "./ahpTerminalCommandSource.js";
import { ITerminalChatService, ITerminalService } from "./terminal.js";
import { ITerminalProfileService } from "../common/terminal.js";
const AGENT_HOST_PROFILE_EXT_ID = "vscode.agent-host-terminal";
const IAgentHostTerminalService = createDecorator("agentHostTerminalService");
let AgentHostTerminalService = class extends Disposable {
  constructor(_terminalService, _terminalChatService, _terminalProfileService, _quickInputService) {
    super();
    this._terminalService = _terminalService;
    this._terminalChatService = _terminalChatService;
    this._terminalProfileService = _terminalProfileService;
    this._quickInputService = _quickInputService;
    this._entries = [];
    this._usedHosts = /* @__PURE__ */ new Set();
    this._profileRegistrations = this._register(new DisposableMap());
    this._profiles = observableValue("agentHostTerminalProfiles", []);
    this.profiles = this._profiles;
    /** Revived terminal instances, keyed by terminal URI string. */
    this._revivedInstances = /* @__PURE__ */ new Map();
    /**
     * Active AgentHostPty instances with their owning connection clientId,
     * keyed by terminal URI string. Used for reconnection scoping.
     */
    this._activePtys = /* @__PURE__ */ new Map();
    this._pendingRevives = /* @__PURE__ */ new Map();
  }
  // #region Profile management
  registerEntry(entry) {
    this._entries.push(entry);
    this._reconcile();
    return toDisposable(() => {
      const idx = this._entries.indexOf(entry);
      if (idx >= 0) {
        this._entries.splice(idx, 1);
        this._reconcile();
      }
    });
  }
  getProfileForConnection(address) {
    const entry = this._entries.find((e) => e.address === address);
    if (!entry) {
      return void 0;
    }
    if (!this._profileRegistrations.has(address)) {
      this._usedHosts.add(address);
      this._reconcile();
    }
    return this._profiles.get().find((p) => p.address === address);
  }
  setDefaultCwd(cwd) {
    this._defaultCwd = cwd;
  }
  _reconcile() {
    const entries = this._entries;
    const desiredProfiles = /* @__PURE__ */ new Map();
    if (entries.length === 0) {
    } else if (entries.length === 1) {
      desiredProfiles.set(entries[0].address, entries[0]);
    } else {
      let displaying = 0;
      for (const address of this._usedHosts) {
        const entry = entries.find((e) => e.address === address);
        if (entry) {
          displaying++;
          desiredProfiles.set(entry.address, entry);
        }
      }
      if (displaying === entries.length - 1) {
        const missing = entries.find((e) => !this._usedHosts.has(e.address));
        if (missing) {
          desiredProfiles.set(missing.address, missing);
        }
      } else if (displaying < entries.length) {
        desiredProfiles.set("__quickpick__", {
          name: localize("agentHostTerminal.pick", "Agent Host\u2026"),
          address: "__quickpick__",
          getConnection: () => void 0
        });
      }
    }
    for (const [key, entry] of desiredProfiles) {
      if (!this._profileRegistrations.has(key)) {
        this._registerProfile(key, entry, entries);
      }
    }
    for (const key of this._profileRegistrations.keys()) {
      if (!desiredProfiles.has(key)) {
        this._profileRegistrations.deleteAndDispose(key);
      }
    }
    const infos = [];
    for (const [key] of desiredProfiles) {
      infos.push({
        extensionIdentifier: AGENT_HOST_PROFILE_EXT_ID,
        profileId: key,
        title: key === "__quickpick__" ? localize("agentHostTerminal.pick", "Agent Host\u2026") : localize("agentHostTerminal.profileName", "Agent Host ({0})", desiredProfiles.get(key).name),
        address: key
      });
    }
    transaction((tx) => {
      this._profiles.set(infos, tx);
    });
  }
  _registerProfile(key, entry, allEntries) {
    const provider = {
      createContributedTerminalProfile: async (options) => {
        let connection;
        let displayName = entry.name;
        if (key === "__quickpick__") {
          const picks = allEntries.map((e) => ({
            label: localize("agentHostTerminal.profileName", "Agent Host ({0})", e.name),
            address: e.address,
            hostName: e.name
          }));
          const pick = await this._quickInputService.pick(picks, {
            placeHolder: localize("agentHostTerminal.pickHost", "Select an agent host to open a terminal on")
          });
          if (!pick) {
            return;
          }
          this._usedHosts.add(pick.address);
          this._reconcile();
          displayName = pick.hostName;
          connection = allEntries.find((e) => e.address === pick.address)?.getConnection();
        } else {
          connection = entry.getConnection();
        }
        if (!connection) {
          return;
        }
        await this.createTerminal(connection, {
          name: localize("agentHostTerminal.profileName", "Agent Host ({0})", displayName),
          cwd: options.cwd ? typeof options.cwd === "string" ? URI.file(options.cwd) : options.cwd : this._defaultCwd,
          location: options.location
        });
      }
    };
    const title = key === "__quickpick__" ? localize("agentHostTerminal.pick", "Agent Host\u2026") : localize("agentHostTerminal.profileName", "Agent Host ({0})", entry.name);
    const store = new DisposableStore();
    store.add(this._terminalProfileService.registerTerminalProfileProvider(
      AGENT_HOST_PROFILE_EXT_ID,
      key,
      provider
    ));
    store.add(this._terminalProfileService.registerInternalContributedProfile({
      extensionIdentifier: AGENT_HOST_PROFILE_EXT_ID,
      id: key,
      title,
      icon: "remote"
    }));
    this._profileRegistrations.set(key, store);
  }
  // #endregion
  async createTerminalForEntry(address, options) {
    const entry = this._entries.find((e) => e.address === address);
    if (!entry) {
      return void 0;
    }
    const connection = entry.getConnection();
    if (!connection) {
      return void 0;
    }
    return this.createTerminal(connection, options);
  }
  async createTerminal(connection, options) {
    const terminalUri = URI.from({ scheme: "agenthost-terminal", path: `/${generateUuid()}` });
    const name = options?.name ?? localize("agentHostTerminal.default", "Agent Host Terminal");
    const key = terminalUri.toString();
    const instance = await this._terminalService.createTerminal({
      config: {
        customPtyImplementation: (id, cols, rows) => {
          const pty = new AgentHostPty(id, connection, terminalUri, {
            name,
            cwd: options?.cwd
          });
          if (cols > 0 && rows > 0) {
            pty.resize(cols, rows);
          }
          this._activePtys.set(key, { pty, clientId: connection.clientId });
          return pty;
        },
        name,
        icon: { id: "remote" },
        isFeatureTerminal: false
      },
      location: options?.location
    });
    this._register(instance.onDisposed(() => {
      this._activePtys.delete(key);
    }));
    return instance;
  }
  async reviveTerminal(connection, terminalUri, terminalToolSessionId) {
    const key = terminalUri.toString();
    const pending = this._pendingRevives.get(key);
    if (pending) {
      return pending;
    }
    const revive = this._doReviveTerminal(connection, terminalUri, terminalToolSessionId, key).finally(() => {
      if (this._pendingRevives.get(key) === revive) {
        this._pendingRevives.delete(key);
      }
    });
    this._pendingRevives.set(key, revive);
    return revive;
  }
  attachOutputTerminal(connection, terminalUri, terminalToolSessionId) {
    const store = new DisposableStore();
    const source = store.add(new AgentHostOutputChannel(connection, terminalUri));
    store.add(this._terminalChatService.registerOutputSource(terminalToolSessionId, source));
    return store;
  }
  async _doReviveTerminal(connection, terminalUri, terminalToolSessionId, key) {
    const existing = this._revivedInstances.get(key);
    if (existing) {
      return existing;
    }
    const store = new DisposableStore();
    const commandSource = store.add(new AhpTerminalCommandSource());
    const instancePromise = Promise.resolve().then(() => this._terminalService.createTerminal({
      config: {
        customPtyImplementation: (id, cols, rows) => {
          const pty = new AgentHostPty(id, connection, terminalUri, {
            attachOnly: true
          });
          if (cols > 0 && rows > 0) {
            pty.resize(cols, rows);
          }
          if (!store.isDisposed) {
            commandSource.connect(instance, pty);
          }
          this._activePtys.set(key, { pty, clientId: connection.clientId });
          return pty;
        },
        name: localize("agentHostTerminal.tool", "Agent Host Terminal"),
        isFeatureTerminal: true,
        hideFromUser: true
      }
    }));
    store.add(this._terminalChatService.registerAhpCommandSource(terminalToolSessionId, commandSource, instancePromise));
    let instance;
    try {
      instance = await instancePromise;
    } catch (error) {
      store.dispose();
      throw error;
    }
    this._terminalChatService.registerTerminalInstanceWithToolSession(terminalToolSessionId, instance);
    this._revivedInstances.set(key, instance);
    instance.store.add(store);
    this._register(instance.onDisposed(() => {
      this._revivedInstances.delete(key);
      this._activePtys.delete(key);
    }));
    return instance;
  }
  async reconnectTerminals(newConnection, oldClientId) {
    const entries = [...this._activePtys.entries()].filter(
      ([, entry]) => entry.clientId === oldClientId
    );
    const total = entries.length;
    let recovered = 0;
    const promises = [];
    for (const [key, entry] of entries) {
      promises.push(
        entry.pty.reconnect(newConnection).then((success) => {
          if (success) {
            recovered++;
            entry.clientId = newConnection.clientId;
          } else {
            console.warn(`[AgentHostTerminalService] Failed to reconnect terminal: ${key}`);
          }
        })
      );
    }
    await Promise.all(promises);
    return { recovered, total };
  }
};
AgentHostTerminalService = __decorateClass([
  __decorateParam(0, ITerminalService),
  __decorateParam(1, ITerminalChatService),
  __decorateParam(2, ITerminalProfileService),
  __decorateParam(3, IQuickInputService)
], AgentHostTerminalService);
export {
  AgentHostTerminalService,
  IAgentHostTerminalService
};
