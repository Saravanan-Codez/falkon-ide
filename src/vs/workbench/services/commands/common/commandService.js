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
import { notCancellablePromise, raceCancellablePromises, timeout } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
let CommandService = class extends Disposable {
  constructor(_instantiationService, _extensionService, _logService) {
    super();
    this._instantiationService = _instantiationService;
    this._extensionService = _extensionService;
    this._logService = _logService;
    this._extensionHostIsReady = false;
    this._onWillExecuteCommand = this._register(new Emitter());
    this.onWillExecuteCommand = this._onWillExecuteCommand.event;
    this._onDidExecuteCommand = this._register(new Emitter());
    this.onDidExecuteCommand = this._onDidExecuteCommand.event;
    this._extensionService.whenInstalledExtensionsRegistered().then((value) => this._extensionHostIsReady = value);
    this._starActivation = null;
  }
  _activateStar() {
    if (!this._starActivation) {
      this._starActivation = raceCancellablePromises([
        this._extensionService.activateByEvent(`*`),
        timeout(3e4)
      ]);
    }
    return notCancellablePromise(this._starActivation);
  }
  async executeCommand(id, ...args) {
    this._logService.trace("CommandService#executeCommand", id);
    const activationEvent = `onCommand:${id}`;
    const commandIsRegistered = !!CommandsRegistry.getCommand(id);
    if (commandIsRegistered) {
      if (this._extensionService.activationEventIsDone(activationEvent)) {
        return this._tryExecuteCommand(id, args);
      }
      if (!this._extensionHostIsReady) {
        this._extensionService.activateByEvent(activationEvent);
        return this._tryExecuteCommand(id, args);
      }
      await this._extensionService.activateByEvent(activationEvent);
      return this._tryExecuteCommand(id, args);
    }
    await Promise.all([
      this._extensionService.activateByEvent(activationEvent),
      raceCancellablePromises([
        // race * activation against command registration
        this._activateStar(),
        Event.toPromise(Event.filter(CommandsRegistry.onDidRegisterCommand, (e) => e === id))
      ])
    ]);
    return this._tryExecuteCommand(id, args);
  }
  _tryExecuteCommand(id, args) {
    const command = CommandsRegistry.getCommand(id);
    if (!command) {
      return Promise.reject(new Error(`command '${id}' not found`));
    }
    try {
      this._onWillExecuteCommand.fire({ commandId: id, args });
      const result = this._instantiationService.invokeFunction(command.handler, ...args);
      this._onDidExecuteCommand.fire({ commandId: id, args });
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  dispose() {
    super.dispose();
    this._starActivation?.cancel();
  }
};
CommandService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, ILogService)
], CommandService);
registerSingleton(ICommandService, CommandService, InstantiationType.Delayed);
export {
  CommandService
};
