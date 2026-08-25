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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { AgentHostContribution } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostChatContribution.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionWorkingDirectoryResolver.js";
import { AgentHostTerminalContribution } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostTerminalContribution.js";
import { AgentHostAllowSignedOutWhenUsableContribution } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostAllowSignedOutWhenUsableContribution.js";
import { AgentHostDiscoveredConfigNotificationContribution } from "./agentHostDiscoveredConfigNotification.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { SessionStatus } from "../../../../services/sessions/common/session.js";
import { IAgentHostEnablementService } from "../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { LocalAgentHostSessionsProvider } from "./localAgentHostSessionsProvider.js";
import "./codexCustomizationSettings.contribution.js";
let LocalAgentHostContribution = class extends Disposable {
  constructor(_agentHostEnablementService, instantiationService, sessionsProvidersService, workingDirectoryResolver) {
    super();
    this._agentHostEnablementService = _agentHostEnablementService;
    const initialize = () => {
      const provider = this._register(instantiationService.createInstance(LocalAgentHostSessionsProvider));
      this._register(sessionsProvidersService.registerProvider(provider));
      const resolverRegistrations = this._register(new DisposableMap());
      const registerResolvers = () => {
        const sessionTypeIds = new Set(provider.sessionTypes.map((sessionType) => `agent-host-${sessionType.id}`));
        for (const [sessionTypeId] of resolverRegistrations) {
          if (!sessionTypeIds.has(sessionTypeId)) {
            resolverRegistrations.deleteAndDispose(sessionTypeId);
          }
        }
        for (const sessionType of provider.sessionTypes) {
          const resourceScheme = `agent-host-${sessionType.id}`;
          if (resolverRegistrations.has(resourceScheme)) {
            continue;
          }
          resolverRegistrations.set(resourceScheme, workingDirectoryResolver.registerResolver(resourceScheme, (sessionResource) => {
            return provider.getSessionByResource(sessionResource)?.workspace.get()?.folders[0]?.workingDirectory;
          }, (sessionResource) => {
            return provider.getSessionByResource(sessionResource)?.status.get() === SessionStatus.Untitled;
          }));
        }
      };
      registerResolvers();
      this._register(provider.onDidChangeSessionTypes(registerResolvers));
    };
    this._register(autorun((reader) => {
      if (this._agentHostEnablementService.enabled.read(reader)) {
        initialize();
      }
    }));
  }
  static {
    this.ID = "sessions.contrib.localAgentHostContribution";
  }
};
LocalAgentHostContribution = __decorateClass([
  __decorateParam(0, IAgentHostEnablementService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, IAgentHostSessionWorkingDirectoryResolver)
], LocalAgentHostContribution);
registerWorkbenchContribution2(AgentHostContribution.ID, AgentHostContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentHostTerminalContribution.ID, AgentHostTerminalContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentHostAllowSignedOutWhenUsableContribution.ID, AgentHostAllowSignedOutWhenUsableContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(AgentHostDiscoveredConfigNotificationContribution.ID, AgentHostDiscoveredConfigNotificationContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(LocalAgentHostContribution.ID, LocalAgentHostContribution, WorkbenchPhase.AfterRestored);
