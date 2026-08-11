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
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { ReferencesController } from "../../../../editor/contrib/gotoSymbol/browser/peek/referencesController.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let WorkbenchReferencesController = class extends ReferencesController {
  constructor(editor, contextKeyService, editorService, notificationService, instantiationService, storageService, configurationService) {
    super(
      false,
      editor,
      contextKeyService,
      editorService,
      notificationService,
      instantiationService,
      storageService,
      configurationService
    );
  }
};
WorkbenchReferencesController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IConfigurationService)
], WorkbenchReferencesController);
registerEditorContribution(ReferencesController.ID, WorkbenchReferencesController, EditorContributionInstantiation.Lazy);
export {
  WorkbenchReferencesController
};
