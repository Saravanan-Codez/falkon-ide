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
import * as nls from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { SetLogLevelAction } from "./logsActions.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IOutputService, Extensions, isMultiSourceOutputChannelDescriptor, isSingleSourceOutputChannelDescriptor } from "../../../services/output/common/output.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { CONTEXT_LOG_LEVEL, ILoggerService, LogLevelToString, isLogLevel } from "../../../../platform/log/common/log.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Event } from "../../../../base/common/event.js";
import { windowLogId, showWindowLogActionId } from "../../../services/log/common/logConstants.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { CounterSet } from "../../../../base/common/map.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { Schemas } from "../../../../base/common/network.js";
import { IDefaultLogLevelsService } from "../../../services/log/common/defaultLogLevels.js";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SetLogLevelAction.ID,
      title: SetLogLevelAction.TITLE,
      category: Categories.Developer,
      f1: true
    });
  }
  run(servicesAccessor) {
    const action = servicesAccessor.get(IInstantiationService).createInstance(SetLogLevelAction, SetLogLevelAction.ID, SetLogLevelAction.TITLE.value);
    return action.run().finally(() => action.dispose());
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.setDefaultLogLevel",
      title: nls.localize2("setDefaultLogLevel", "Set Default Log Level"),
      category: Categories.Developer
    });
  }
  run(servicesAccessor, logLevel, extensionId) {
    return servicesAccessor.get(IDefaultLogLevelsService).setDefaultLogLevel(logLevel, extensionId);
  }
});
let LogOutputChannels = class extends Disposable {
  constructor(loggerService, contextKeyService, uriIdentityService) {
    super();
    this.loggerService = loggerService;
    this.contextKeyService = contextKeyService;
    this.uriIdentityService = uriIdentityService;
    this.contextKeys = new CounterSet();
    this.outputChannelRegistry = Registry.as(Extensions.OutputChannels);
    const contextKey = CONTEXT_LOG_LEVEL.bindTo(contextKeyService);
    contextKey.set(LogLevelToString(loggerService.getLogLevel()));
    this._register(loggerService.onDidChangeLogLevel((e) => {
      if (isLogLevel(e)) {
        contextKey.set(LogLevelToString(loggerService.getLogLevel()));
      }
    }));
    this.onDidAddLoggers(loggerService.getRegisteredLoggers());
    this._register(loggerService.onDidChangeLoggers(({ added, removed }) => {
      this.onDidAddLoggers(added);
      this.onDidRemoveLoggers(removed);
    }));
    this._register(loggerService.onDidChangeVisibility(([resource, visibility]) => {
      const logger = loggerService.getRegisteredLogger(resource);
      if (logger) {
        if (visibility) {
          this.registerLogChannel(logger);
        } else {
          this.deregisterLogChannel(logger);
        }
      }
    }));
    this.registerShowWindowLogAction();
    this._register(Event.filter(contextKeyService.onDidChangeContext, (e) => e.affectsSome(this.contextKeys))(() => this.onDidChangeContext()));
  }
  onDidAddLoggers(loggers) {
    for (const logger of loggers) {
      if (logger.when) {
        const contextKeyExpr = ContextKeyExpr.deserialize(logger.when);
        if (contextKeyExpr) {
          for (const key of contextKeyExpr.keys()) {
            this.contextKeys.add(key);
          }
          if (!this.contextKeyService.contextMatchesRules(contextKeyExpr)) {
            continue;
          }
        }
      }
      if (logger.hidden) {
        continue;
      }
      this.registerLogChannel(logger);
    }
  }
  onDidChangeContext() {
    for (const logger of this.loggerService.getRegisteredLoggers()) {
      if (logger.when) {
        if (this.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(logger.when))) {
          this.registerLogChannel(logger);
        } else {
          this.deregisterLogChannel(logger);
        }
      }
    }
  }
  onDidRemoveLoggers(loggers) {
    for (const logger of loggers) {
      if (logger.when) {
        const contextKeyExpr = ContextKeyExpr.deserialize(logger.when);
        if (contextKeyExpr) {
          for (const key of contextKeyExpr.keys()) {
            this.contextKeys.delete(key);
          }
        }
      }
      this.deregisterLogChannel(logger);
    }
  }
  registerLogChannel(logger) {
    if (logger.group) {
      this.registerCompoundLogChannel(logger.group.id, logger.group.name, logger);
      return;
    }
    const channel = this.outputChannelRegistry.getChannel(logger.id);
    if (channel && isSingleSourceOutputChannelDescriptor(channel) && this.uriIdentityService.extUri.isEqual(channel.source.resource, logger.resource)) {
      return;
    }
    const existingChannel = this.outputChannelRegistry.getChannel(logger.id);
    const remoteLogger = existingChannel && isSingleSourceOutputChannelDescriptor(existingChannel) && existingChannel.source.resource.scheme === Schemas.vscodeRemote ? this.loggerService.getRegisteredLogger(existingChannel.source.resource) : void 0;
    if (remoteLogger) {
      this.deregisterLogChannel(remoteLogger);
    }
    const hasToAppendRemote = existingChannel && logger.resource.scheme === Schemas.vscodeRemote;
    const id = hasToAppendRemote ? `${logger.id}.remote` : logger.id;
    const label = hasToAppendRemote ? nls.localize("remote name", "{0} (Remote)", logger.name ?? logger.id) : logger.name ?? logger.id;
    this.outputChannelRegistry.registerChannel({ id, label, source: { resource: logger.resource }, log: true, extensionId: logger.extensionId });
  }
  registerCompoundLogChannel(id, name, logger) {
    const channel = this.outputChannelRegistry.getChannel(id);
    const source = { resource: logger.resource, name: logger.name ?? logger.id };
    if (channel) {
      if (isMultiSourceOutputChannelDescriptor(channel) && !channel.source.some(({ resource }) => this.uriIdentityService.extUri.isEqual(resource, logger.resource))) {
        this.outputChannelRegistry.updateChannelSources(id, [...channel.source, source]);
      }
    } else {
      this.outputChannelRegistry.registerChannel({ id, label: name, log: true, source: [source] });
    }
  }
  deregisterLogChannel(logger) {
    if (logger.group) {
      const channel = this.outputChannelRegistry.getChannel(logger.group.id);
      if (channel && isMultiSourceOutputChannelDescriptor(channel)) {
        this.outputChannelRegistry.updateChannelSources(logger.group.id, channel.source.filter(({ resource }) => !this.uriIdentityService.extUri.isEqual(resource, logger.resource)));
      }
    } else {
      this.outputChannelRegistry.removeChannel(logger.id);
    }
  }
  registerShowWindowLogAction() {
    this._register(registerAction2(class ShowWindowLogAction extends Action2 {
      constructor() {
        super({
          id: showWindowLogActionId,
          title: nls.localize2("show window log", "Show Window Log"),
          category: Categories.Developer,
          f1: true
        });
      }
      async run(servicesAccessor) {
        const outputService = servicesAccessor.get(IOutputService);
        outputService.showChannel(windowLogId);
      }
    }));
  }
};
LogOutputChannels = __decorateClass([
  __decorateParam(0, ILoggerService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IUriIdentityService)
], LogOutputChannels);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(LogOutputChannels, LifecyclePhase.Restored);
