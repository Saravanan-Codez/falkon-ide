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
import { EditorModel } from "./editorModel.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { Mimes } from "../../../base/common/mime.js";
let BinaryEditorModel = class extends EditorModel {
  constructor(resource, name, fileService) {
    super();
    this.resource = resource;
    this.name = name;
    this.fileService = fileService;
    this.mime = Mimes.binary;
  }
  /**
   * The name of the binary resource.
   */
  getName() {
    return this.name;
  }
  /**
   * The size of the binary resource if known.
   */
  getSize() {
    return this.size;
  }
  /**
   * The mime of the binary resource if known.
   */
  getMime() {
    return this.mime;
  }
  /**
   * The etag of the binary resource if known.
   */
  getETag() {
    return this.etag;
  }
  async resolve() {
    if (this.fileService.hasProvider(this.resource)) {
      const stat = await this.fileService.stat(this.resource);
      this.etag = stat.etag;
      if (typeof stat.size === "number") {
        this.size = stat.size;
      }
    }
    return super.resolve();
  }
};
BinaryEditorModel = __decorateClass([
  __decorateParam(2, IFileService)
], BinaryEditorModel);
export {
  BinaryEditorModel
};
