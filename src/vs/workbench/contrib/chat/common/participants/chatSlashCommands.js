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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { getChatSessionType } from "../model/chatUri.js";
import { matchesSessionType } from "../promptSyntax/service/promptsService.js";
const IChatSlashCommandService = createDecorator("chatSlashCommandService");
let ChatSlashCommandService = class extends Disposable {
  constructor(_extensionService) {
    super();
    this._extensionService = _extensionService;
    this._commands = /* @__PURE__ */ new Map();
    this._onDidChangeCommands = this._register(new Emitter());
    this.onDidChangeCommands = this._onDidChangeCommands.event;
  }
  dispose() {
    super.dispose();
    this._commands.clear();
  }
  getSessionScopedCommands(id) {
    return this._commands.get(id) ?? [];
  }
  commandsOverlap(dataA, dataB) {
    if (dataA.sessionTypes === void 0 || dataB.sessionTypes === void 0) {
      return true;
    }
    return dataA.sessionTypes.some((sessionType) => dataB.sessionTypes?.includes(sessionType));
  }
  getCommand(id, sessionType) {
    return this.getSessionScopedCommands(id).find((candidate) => matchesSessionType(candidate.data.sessionTypes, sessionType));
  }
  registerSlashCommand(data, command) {
    const commandsForId = this.getSessionScopedCommands(data.command);
    if (commandsForId.some((candidate) => this.commandsOverlap(candidate.data, data))) {
      throw new Error(`Already registered a command with id ${data.command}`);
    }
    const entry = { data, command };
    commandsForId.push(entry);
    this._commands.set(data.command, commandsForId);
    this._onDidChangeCommands.fire();
    return toDisposable(() => {
      const commandsForId2 = this._commands.get(data.command);
      if (!commandsForId2) {
        return;
      }
      const entryIndex = commandsForId2.indexOf(entry);
      if (entryIndex === -1) {
        return;
      }
      commandsForId2.splice(entryIndex, 1);
      if (commandsForId2.length === 0) {
        this._commands.delete(data.command);
      }
      this._onDidChangeCommands.fire();
    });
  }
  getCommands(location, mode) {
    return Array.from(this._commands.values()).flatMap((commands) => commands.map((v) => v.data)).filter((c) => c.locations.includes(location) && (!c.modes || c.modes.includes(mode)));
  }
  hasCommand(id, sessionType) {
    return !!this.getCommand(id, sessionType);
  }
  async executeCommand(id, prompt, progress, history, location, sessionResource, token, options) {
    const data = this.getCommand(id, getChatSessionType(sessionResource));
    if (!data) {
      throw new Error(`No command with id ${id} NOT registered`);
    }
    if (!data.command) {
      await this._extensionService.activateByEvent(`onSlash:${id}`);
    }
    if (!data.command) {
      throw new Error(`No command with id ${id} NOT resolved`);
    }
    return await data.command(prompt, progress, history, location, sessionResource, token, options);
  }
};
ChatSlashCommandService = __decorateClass([
  __decorateParam(0, IExtensionService)
], ChatSlashCommandService);
export {
  ChatSlashCommandService,
  IChatSlashCommandService
};
