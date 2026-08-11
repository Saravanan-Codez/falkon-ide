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
import { localize } from "../../../../nls.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { AuxiliaryBarMaximizedContext } from "../../../common/contextkeys.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { AgentSessionsWelcomeInput } from "./agentSessionsWelcomeInput.js";
import { AgentSessionsWelcomePage, AgentSessionsWelcomeInputSerializer } from "./agentSessionsWelcome.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
const agentSessionsWelcomeInputTypeId = "workbench.editors.agentSessionsWelcomeInput";
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(agentSessionsWelcomeInputTypeId, AgentSessionsWelcomeInputSerializer);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    AgentSessionsWelcomePage,
    AgentSessionsWelcomePage.ID,
    localize("agentSessionsWelcome", "Agent Sessions Welcome")
  ),
  [
    new SyncDescriptor(AgentSessionsWelcomeInput)
  ]
);
const getWorkspaceKind = (workspaceContextService) => {
  const state = workspaceContextService.getWorkbenchState();
  switch (state) {
    case WorkbenchState.EMPTY:
      return "empty";
    case WorkbenchState.FOLDER:
      return "folder";
    case WorkbenchState.WORKSPACE:
      return "workspace";
    default:
      return "empty";
  }
};
let AgentSessionsWelcomeEditorResolverContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.agentSessionsWelcomeEditorResolver";
  }
  constructor(editorResolverService, instantiationService, workspaceContextService) {
    super();
    this._register(editorResolverService.registerEditor(
      `${AgentSessionsWelcomeInput.RESOURCE.scheme}:${AgentSessionsWelcomeInput.RESOURCE.authority}/**`,
      {
        id: AgentSessionsWelcomePage.ID,
        label: localize("agentSessionsWelcome.displayName", "Agent Sessions Welcome"),
        priority: RegisteredEditorPriority.builtin
      },
      {
        singlePerResource: true,
        canSupportResource: (resource) => resource.scheme === AgentSessionsWelcomeInput.RESOURCE.scheme && resource.authority === AgentSessionsWelcomeInput.RESOURCE.authority
      },
      {
        createEditorInput: () => {
          return {
            editor: instantiationService.createInstance(AgentSessionsWelcomeInput, { workspaceKind: getWorkspaceKind(workspaceContextService) })
          };
        }
      }
    ));
  }
};
AgentSessionsWelcomeEditorResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkspaceContextService)
], AgentSessionsWelcomeEditorResolverContribution);
registerAction2(class OpenAgentSessionsWelcomeAction extends Action2 {
  constructor() {
    super({
      id: AgentSessionsWelcomePage.COMMAND_ID,
      title: localize("openAgentSessionsWelcome", "Open Agent Sessions Welcome"),
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const input = instantiationService.createInstance(AgentSessionsWelcomeInput, { initiator: "command", workspaceKind: getWorkspaceKind(workspaceContextService) });
    await editorService.openEditor(input, { pinned: true });
  }
});
let AgentSessionsWelcomeRunnerContribution = class extends Disposable {
  constructor(configurationService, editorService, editorGroupsService, instantiationService, contextKeyService, storageService, workspaceContextService, chatEntitlementService) {
    super();
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.editorGroupsService = editorGroupsService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this.workspaceContextService = workspaceContextService;
    this.chatEntitlementService = chatEntitlementService;
    this.run();
  }
  static {
    this.ID = "workbench.contrib.agentSessionsWelcomeRunner";
  }
  async run() {
    if (this.chatEntitlementService.sentiment.hidden) {
      return;
    }
    const startupEditor = this.configurationService.getValue("workbench.startupEditor");
    if (startupEditor !== "agentSessionsWelcomePage") {
      return;
    }
    await this.editorGroupsService.whenReady;
    if (AuxiliaryBarMaximizedContext.getValue(this.contextKeyService)) {
      return;
    }
    const hasPrefillData = !!this.storageService.get("chat.welcomeViewPrefill", StorageScope.APPLICATION);
    if (this.editorService.activeEditor && !hasPrefillData) {
      return;
    }
    const input = this.instantiationService.createInstance(AgentSessionsWelcomeInput, { initiator: "startup", workspaceKind: getWorkspaceKind(this.workspaceContextService) });
    await this.editorService.openEditor(input, { pinned: false });
  }
};
AgentSessionsWelcomeRunnerContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IEditorGroupsService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IChatEntitlementService)
], AgentSessionsWelcomeRunnerContribution);
registerWorkbenchContribution2(AgentSessionsWelcomeEditorResolverContribution.ID, AgentSessionsWelcomeEditorResolverContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(AgentSessionsWelcomeRunnerContribution.ID, AgentSessionsWelcomeRunnerContribution, WorkbenchPhase.AfterRestored);
