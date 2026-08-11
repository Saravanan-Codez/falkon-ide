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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IEditorService } from "../../../../../workbench/services/editor/common/editorService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../workbench/common/contributions.js";
import { SessionProviderIdContext } from "../../../../common/contextkeys.js";
import { SessionItemContextMenuId } from "../../../sessions/browser/views/sessionsList.js";
import { agentSessionSettingsUri, AGENT_SESSION_SETTINGS_SCHEME, AgentSessionSettingsFileSystemProvider, AgentSessionSettingsSchemaRegistrar } from "./agentSessionSettingsFileSystemProvider.js";
import { ANY_AGENT_HOST_PROVIDER_RE } from "../../../../common/agentHostSessionsProvider.js";
let AgentSessionSettingsContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.agentSessionSettingsContribution";
  }
  constructor(fileService, instantiationService, labelService) {
    super();
    const schemaRegistrar = this._register(instantiationService.createInstance(AgentSessionSettingsSchemaRegistrar));
    const provider = this._register(instantiationService.createInstance(AgentSessionSettingsFileSystemProvider, schemaRegistrar));
    this._register(fileService.registerProvider(AGENT_SESSION_SETTINGS_SCHEME, provider));
    this._register(labelService.registerFormatter({
      scheme: AGENT_SESSION_SETTINGS_SCHEME,
      formatting: {
        label: localize("agentSessionSettings.label", "Session Settings"),
        separator: "/"
      }
    }));
  }
};
AgentSessionSettingsContribution = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService)
], AgentSessionSettingsContribution);
registerWorkbenchContribution2(AgentSessionSettingsContribution.ID, AgentSessionSettingsContribution, WorkbenchPhase.AfterRestored);
registerAction2(class OpenSessionSettingsAction extends Action2 {
  constructor() {
    super({
      id: "sessionsViewPane.openSessionSettings",
      title: localize2("openSessionSettings", "Open Session Settings"),
      menu: [{
        id: SessionItemContextMenuId,
        group: "2_settings",
        order: 1,
        when: ContextKeyExpr.regex(SessionProviderIdContext.key, ANY_AGENT_HOST_PROVIDER_RE)
      }]
    });
  }
  async run(accessor, context) {
    const session = Array.isArray(context) ? context[0] : context;
    if (!session) {
      return;
    }
    const editorService = accessor.get(IEditorService);
    const resource = agentSessionSettingsUri(session);
    await editorService.openEditor({ resource, options: { pinned: true } });
  }
});
