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
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { SessionProviderIdContext } from "../../../../common/contextkeys.js";
import { SessionItemContextMenuId } from "../../../sessions/browser/views/sessionsList.js";
import { agentHostSettingsUri, AGENT_HOST_SETTINGS_SCHEME, AgentHostSettingsFileSystemProvider, AgentHostSettingsSchemaRegistrar } from "./agentHostSettingsFileSystemProvider.js";
import { ANY_AGENT_HOST_PROVIDER_RE } from "../../../../common/agentHostSessionsProvider.js";
let AgentHostSettingsContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.agentHostSettingsContribution";
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
registerAction2(class OpenHostSettingsAction extends Action2 {
  constructor() {
    super({
      id: "sessionsViewPane.openHostSettings",
      title: localize2("openHostSettings", "Open Host Settings"),
      menu: [{
        id: SessionItemContextMenuId,
        group: "2_settings",
        order: 2,
        when: ContextKeyExpr.regex(SessionProviderIdContext.key, ANY_AGENT_HOST_PROVIDER_RE)
      }],
      precondition: ContextKeyExpr.regex(SessionProviderIdContext.key, ANY_AGENT_HOST_PROVIDER_RE),
      f1: true
    });
  }
  async run(accessor, context) {
    const sessionsService = accessor.get(ISessionsService);
    const session = (Array.isArray(context) ? context[0] : context) ?? sessionsService.activeSession.get();
    if (!session) {
      return;
    }
    const editorService = accessor.get(IEditorService);
    const resource = agentHostSettingsUri(session.providerId);
    await editorService.openEditor({ resource, options: { pinned: true } });
  }
});
