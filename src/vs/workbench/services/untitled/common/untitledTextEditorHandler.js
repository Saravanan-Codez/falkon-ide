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
import { Schemas } from "../../../../base/common/network.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ITextEditorService } from "../../textfile/common/textEditorService.js";
import { isEqual, toLocalResource } from "../../../../base/common/resources.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IPathService } from "../../path/common/pathService.js";
import { NO_TYPE_ID } from "../../workingCopy/common/workingCopy.js";
import { IWorkingCopyEditorService } from "../../workingCopy/common/workingCopyEditorService.js";
import { IUntitledTextEditorService } from "./untitledTextEditorService.js";
let UntitledTextEditorInputSerializer = class {
  constructor(filesConfigurationService, environmentService, pathService) {
    this.filesConfigurationService = filesConfigurationService;
    this.environmentService = environmentService;
    this.pathService = pathService;
  }
  canSerialize(editorInput) {
    return this.filesConfigurationService.isHotExitEnabled && !editorInput.isDisposed();
  }
  serialize(editorInput) {
    if (!this.canSerialize(editorInput)) {
      return void 0;
    }
    const untitledTextEditorInput = editorInput;
    let resource = untitledTextEditorInput.resource;
    if (untitledTextEditorInput.hasAssociatedFilePath) {
      resource = toLocalResource(resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
    }
    let languageId;
    const languageIdCandidate = untitledTextEditorInput.getLanguageId();
    if (languageIdCandidate !== PLAINTEXT_LANGUAGE_ID) {
      languageId = languageIdCandidate;
    } else if (untitledTextEditorInput.hasLanguageSetExplicitly) {
      languageId = languageIdCandidate;
    }
    const serialized = {
      resourceJSON: resource.toJSON(),
      modeId: languageId,
      encoding: untitledTextEditorInput.getEncoding()
    };
    return JSON.stringify(serialized);
  }
  deserialize(instantiationService, serializedEditorInput) {
    return instantiationService.invokeFunction((accessor) => {
      const deserialized = JSON.parse(serializedEditorInput);
      const resource = URI.revive(deserialized.resourceJSON);
      const languageId = deserialized.modeId;
      const encoding = deserialized.encoding;
      return accessor.get(ITextEditorService).createTextEditor({ resource, languageId, encoding, forceUntitled: true });
    });
  }
};
UntitledTextEditorInputSerializer = __decorateClass([
  __decorateParam(0, IFilesConfigurationService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IPathService)
], UntitledTextEditorInputSerializer);
let UntitledTextEditorWorkingCopyEditorHandler = class extends Disposable {
  constructor(workingCopyEditorService, environmentService, pathService, textEditorService, untitledTextEditorService) {
    super();
    this.environmentService = environmentService;
    this.pathService = pathService;
    this.textEditorService = textEditorService;
    this.untitledTextEditorService = untitledTextEditorService;
    this._register(workingCopyEditorService.registerHandler(this));
  }
  static {
    this.ID = "workbench.contrib.untitledTextEditorWorkingCopyEditorHandler";
  }
  handles(workingCopy) {
    return workingCopy.resource.scheme === Schemas.untitled && workingCopy.typeId === NO_TYPE_ID;
  }
  isOpen(workingCopy, editor) {
    if (!this.handles(workingCopy)) {
      return false;
    }
    return isEqual(workingCopy.resource, editor.resource);
  }
  createEditor(workingCopy) {
    let editorInputResource;
    if (this.untitledTextEditorService.isUntitledWithAssociatedResource(workingCopy.resource)) {
      editorInputResource = toLocalResource(workingCopy.resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
    } else {
      editorInputResource = workingCopy.resource;
    }
    return this.textEditorService.createTextEditor({ resource: editorInputResource, forceUntitled: true });
  }
};
UntitledTextEditorWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IWorkingCopyEditorService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IPathService),
  __decorateParam(3, ITextEditorService),
  __decorateParam(4, IUntitledTextEditorService)
], UntitledTextEditorWorkingCopyEditorHandler);
export {
  UntitledTextEditorInputSerializer,
  UntitledTextEditorWorkingCopyEditorHandler
};
