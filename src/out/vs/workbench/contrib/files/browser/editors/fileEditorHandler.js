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
import { URI } from "../../../../../base/common/uri.js";
import { ITextEditorService } from "../../../../services/textfile/common/textEditorService.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { NO_TYPE_ID } from "../../../../services/workingCopy/common/workingCopy.js";
import { IWorkingCopyEditorService } from "../../../../services/workingCopy/common/workingCopyEditorService.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
class FileEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    const fileEditorInput = editorInput;
    const resource = fileEditorInput.resource;
    const preferredResource = fileEditorInput.preferredResource;
    const serializedFileEditorInput = {
      resourceJSON: resource.toJSON(),
      preferredResourceJSON: isEqual(resource, preferredResource) ? void 0 : preferredResource,
      // only storing preferredResource if it differs from the resource
      name: fileEditorInput.getPreferredName(),
      description: fileEditorInput.getPreferredDescription(),
      encoding: fileEditorInput.getEncoding(),
      modeId: fileEditorInput.getPreferredLanguageId()
      // only using the preferred user associated language here if available to not store redundant data
    };
    return JSON.stringify(serializedFileEditorInput);
  }
  deserialize(instantiationService, serializedEditorInput) {
    return instantiationService.invokeFunction((accessor) => {
      const serializedFileEditorInput = JSON.parse(serializedEditorInput);
      const resource = URI.revive(serializedFileEditorInput.resourceJSON);
      const preferredResource = URI.revive(serializedFileEditorInput.preferredResourceJSON);
      const name = serializedFileEditorInput.name;
      const description = serializedFileEditorInput.description;
      const encoding = serializedFileEditorInput.encoding;
      const languageId = serializedFileEditorInput.modeId;
      const fileEditorInput = accessor.get(ITextEditorService).createTextEditor({ resource, label: name, description, encoding, languageId, forceFile: true });
      if (preferredResource) {
        fileEditorInput.setPreferredResource(preferredResource);
      }
      return fileEditorInput;
    });
  }
}
let FileEditorWorkingCopyEditorHandler = class extends Disposable {
  constructor(workingCopyEditorService, textEditorService, fileService) {
    super();
    this.textEditorService = textEditorService;
    this.fileService = fileService;
    this._register(workingCopyEditorService.registerHandler(this));
  }
  static {
    this.ID = "workbench.contrib.fileEditorWorkingCopyEditorHandler";
  }
  handles(workingCopy) {
    return workingCopy.typeId === NO_TYPE_ID && this.fileService.canHandleResource(workingCopy.resource);
  }
  handlesSync(workingCopy) {
    return workingCopy.typeId === NO_TYPE_ID && this.fileService.hasProvider(workingCopy.resource);
  }
  isOpen(workingCopy, editor) {
    if (!this.handlesSync(workingCopy)) {
      return false;
    }
    return isEqual(workingCopy.resource, editor.resource);
  }
  createEditor(workingCopy) {
    return this.textEditorService.createTextEditor({ resource: workingCopy.resource, forceFile: true });
  }
};
FileEditorWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IWorkingCopyEditorService),
  __decorateParam(1, ITextEditorService),
  __decorateParam(2, IFileService)
], FileEditorWorkingCopyEditorHandler);
export {
  FileEditorInputSerializer,
  FileEditorWorkingCopyEditorHandler
};
