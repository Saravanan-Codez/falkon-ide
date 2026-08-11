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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from "../../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { ContextKeyExpr } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../common/contributions.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { agentHostSettingsUri, AGENT_HOST_SETTINGS_SCHEME, AgentHostSettingsFileSystemProvider, AgentHostSettingsSchemaRegistrar } from "./agentHostSettingsFileSystemProvider.js";
let AgentHostSettingsContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.chat.agentHostSettingsEditor";
  }
  constructor(fileService, instantiationService, labelService) {
    super();
    const schemaRegistrar = this._register(instantiationService.createInstance(AgentHostSettingsSchemaRegistrar));
    const provider = this._register(instantiationService.createInstance(AgentHostSettingsFileSystemProvider, schemaRegistrar));
    this._register(fileService.registerProvider(AGENT_HOST_SETTINGS_SCHEME, provider));
    this._register(labelService.registerFormatter({
      scheme: AGENT_HOST_SETTINGS_SCHEME,
      formatting: {
        label: localize("agentHostSettings.label", "Host Settings"),
        separator: "/"
      }
    }));
  }
};
AgentHostSettingsContribution = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService)
], AgentHostSettingsContribution);
registerWorkbenchContribution2(AgentHostSettingsContribution.ID, AgentHostSettingsContribution, WorkbenchPhase.AfterRestored);
const LOCAL_AGENT_HOST_SESSION_TYPE_RE = /^agent-host-/;
const agentHostSettingsPrecondition = ContextKeyExpr.and(
  ChatContextKeys.enabled,
  AGENT_HOST_ENABLED_CONTEXT_KEY
);
registerAction2(class OpenAgentHostSettingsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.openAgentHostSettings",
      title: localize2("openAgentHostSettings", "Open Host Settings"),
      f1: true,
      precondition: agentHostSettingsPrecondition,
      menu: [{
        id: MenuId.AgentSessionsContext,
        group: "3_settings",
        order: 1,
        when: ContextKeyExpr.and(
          agentHostSettingsPrecondition,
          ContextKeyExpr.regex(ChatContextKeys.agentSessionType.key, LOCAL_AGENT_HOST_SESSION_TYPE_RE)
        )
      }]
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({ resource: agentHostSettingsUri(), options: { pinned: true } });
  }
});
