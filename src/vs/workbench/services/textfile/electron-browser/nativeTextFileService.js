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
import { AbstractTextFileService } from "../browser/textFileService.js";
import { ITextFileService, TextFileEditorModelState } from "../common/textfiles.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IUntitledTextEditorService } from "../../untitled/common/untitledTextEditorService.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IWorkingCopyFileService } from "../../workingCopy/common/workingCopyFileService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Promises } from "../../../../base/common/async.js";
import { IDecorationsService } from "../../decorations/common/decorations.js";
let NativeTextFileService = class extends AbstractTextFileService {
  constructor(fileService, untitledTextEditorService, lifecycleService, instantiationService, modelService, environmentService, dialogService, fileDialogService, textResourceConfigurationService, filesConfigurationService, codeEditorService, pathService, workingCopyFileService, uriIdentityService, languageService, elevatedFileService, logService, decorationsService) {
    super(fileService, untitledTextEditorService, lifecycleService, instantiationService, modelService, environmentService, dialogService, fileDialogService, textResourceConfigurationService, filesConfigurationService, codeEditorService, pathService, workingCopyFileService, uriIdentityService, languageService, logService, elevatedFileService, decorationsService);
    this.environmentService = environmentService;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.lifecycleService.onWillShutdown((event) => event.join(this.onWillShutdown(), { id: "join.textFiles", label: localize("join.textFiles", "Saving text files") })));
  }
  async onWillShutdown() {
    let modelsPendingToSave;
    while ((modelsPendingToSave = this.files.models.filter((model) => model.hasState(TextFileEditorModelState.PENDING_SAVE))).length > 0) {
      await Promises.settled(modelsPendingToSave.map((model) => model.joinState(TextFileEditorModelState.PENDING_SAVE)));
    }
  }
  async read(resource, options) {
    options = this.ensureLimits(options);
    return super.read(resource, options);
  }
  async readStream(resource, options) {
    options = this.ensureLimits(options);
    return super.readStream(resource, options);
  }
  ensureLimits(options) {
    let ensuredOptions;
    if (!options) {
      ensuredOptions = /* @__PURE__ */ Object.create(null);
    } else {
      ensuredOptions = options;
    }
    let ensuredLimits;
    if (!ensuredOptions.limits) {
      ensuredLimits = /* @__PURE__ */ Object.create(null);
      ensuredOptions = {
        ...ensuredOptions,
        limits: ensuredLimits
      };
    } else {
      ensuredLimits = ensuredOptions.limits;
    }
    return ensuredOptions;
  }
};
NativeTextFileService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUntitledTextEditorService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IModelService),
  __decorateParam(5, INativeWorkbenchEnvironmentService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, ICodeEditorService),
  __decorateParam(11, IPathService),
  __decorateParam(12, IWorkingCopyFileService),
  __decorateParam(13, IUriIdentityService),
  __decorateParam(14, ILanguageService),
  __decorateParam(15, IElevatedFileService),
  __decorateParam(16, ILogService),
  __decorateParam(17, IDecorationsService)
], NativeTextFileService);
registerSingleton(ITextFileService, NativeTextFileService, InstantiationType.Eager);
export {
  NativeTextFileService
};
