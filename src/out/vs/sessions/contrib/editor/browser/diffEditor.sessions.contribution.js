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
import { URI } from "../../../../base/common/uri.js";
import { isEqual } from "../../../../base/common/resources.js";
import { isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { DiffEditorCommandsService, IDiffEditorCommandsService } from "../../../../workbench/browser/parts/editor/diffEditorCommandsService.js";
import { TextDiffEditor } from "../../../../workbench/browser/parts/editor/textDiffEditor.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { SessionChangesEditor } from "../../changes/browser/sessionChangesEditor.js";
let SessionsDiffEditorCommandsService = class extends DiffEditorCommandsService {
  constructor(editorService, sessionsTextResourceConfigurationService, contextKeyService, configurationService) {
    super(editorService, sessionsTextResourceConfigurationService, contextKeyService);
    this.sessionsTextResourceConfigurationService = sessionsTextResourceConfigurationService;
    this.configurationService = configurationService;
  }
  async toggleRenderSideBySide(args) {
    const resource = args[0] instanceof URI ? args[0] : void 0;
    if (resource || !(this.editorService.activeEditorPane instanceof SessionChangesEditor)) {
      for (const pane of [this.editorService.activeEditorPane, ...this.editorService.visibleEditorPanes]) {
        if (!(pane instanceof TextDiffEditor)) {
          continue;
        }
        const control = pane.getControl();
        if (!isDiffEditor(control)) {
          continue;
        }
        const modifiedResource = control.getModifiedEditor().getModel()?.uri;
        if (resource && (!modifiedResource || !isEqual(resource, modifiedResource))) {
          continue;
        }
        const renderSideBySide = !control.renderSideBySide;
        if (modifiedResource) {
          await this.sessionsTextResourceConfigurationService.updateValue(modifiedResource, "diffEditor.renderSideBySide", renderSideBySide);
        }
        control.updateOptions({ renderSideBySide, useInlineViewWhenSpaceIsLimited: false });
        return;
      }
    }
    if (this.editorService.activeEditorPane instanceof SessionChangesEditor) {
      const key = "diffEditor.renderSideBySide";
      const value = this.configurationService.getValue(key) ?? true;
      await this.configurationService.updateValue(key, !value, ConfigurationTarget.WORKSPACE);
      return;
    }
    if (resource) {
      const key = "diffEditor.renderSideBySide";
      const value = this.sessionsTextResourceConfigurationService.getValue(resource, key);
      await this.sessionsTextResourceConfigurationService.updateValue(resource, key, !value);
      return;
    }
    return super.toggleRenderSideBySide(args);
  }
};
SessionsDiffEditorCommandsService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ITextResourceConfigurationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IConfigurationService)
], SessionsDiffEditorCommandsService);
registerSingleton(IDiffEditorCommandsService, SessionsDiffEditorCommandsService, InstantiationType.Delayed);
export {
  SessionsDiffEditorCommandsService
};
