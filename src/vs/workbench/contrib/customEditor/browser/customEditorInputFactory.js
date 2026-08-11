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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { CustomEditorInput } from "./customEditorInput.js";
import { CustomEditorDiffInput, CustomEditorSideBySideDiffInput } from "./customEditorDiffInput.js";
import { ICustomEditorService } from "../common/customEditor.js";
import { NotebookEditorInput } from "../../notebook/common/notebookEditorInput.js";
import { IWebviewService, WebviewContentPurpose } from "../../webview/browser/webview.js";
import { restoreWebviewContentOptions, restoreWebviewOptions, reviveWebviewExtensionDescription, reviveWebviewIconPath, WebviewEditorInputSerializer } from "../../webviewPanel/browser/webviewEditorInputSerializer.js";
import { IWebviewWorkbenchService } from "../../webviewPanel/browser/webviewWorkbenchService.js";
import { IWorkingCopyBackupService } from "../../../services/workingCopy/common/workingCopyBackup.js";
import { IWorkingCopyEditorService } from "../../../services/workingCopy/common/workingCopyEditorService.js";
let CustomEditorInputSerializer = class extends WebviewEditorInputSerializer {
  constructor(webviewWorkbenchService, _instantiationService, _webviewService) {
    super(webviewWorkbenchService);
    this._instantiationService = _instantiationService;
    this._webviewService = _webviewService;
  }
  static {
    this.ID = CustomEditorInput.typeId;
  }
  serialize(input) {
    const dirty = input.isDirty();
    const data = {
      ...this.toJson(input),
      editorResource: input.resource.toJSON(),
      dirty,
      backupId: dirty ? input.backupId : void 0
    };
    try {
      return JSON.stringify(data);
    } catch {
      return void 0;
    }
  }
  fromJson(data) {
    return {
      ...super.fromJson(data),
      editorResource: URI.from(data.editorResource),
      dirty: data.dirty
    };
  }
  deserialize(_instantiationService, serializedEditorInput) {
    const data = this.fromJson(JSON.parse(serializedEditorInput));
    const webview = reviveWebview(this._webviewService, data);
    const customInput = this._instantiationService.createInstance(CustomEditorInput, {
      resource: data.editorResource,
      viewType: data.viewType,
      webviewTitle: data.title,
      preferredName: void 0,
      iconPath: data.iconPath
    }, webview, { startsDirty: data.dirty, backupId: data.backupId });
    if (typeof data.group === "number") {
      customInput.updateGroup(data.group);
    }
    return customInput;
  }
};
CustomEditorInputSerializer = __decorateClass([
  __decorateParam(0, IWebviewWorkbenchService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWebviewService)
], CustomEditorInputSerializer);
let CustomEditorDiffInputSerializer = class {
  constructor(_instantiationService) {
    this._instantiationService = _instantiationService;
  }
  static {
    this.ID = CustomEditorDiffInput.typeId;
  }
  canSerialize(input) {
    return input instanceof CustomEditorDiffInput;
  }
  serialize(input) {
    const data = {
      originalResource: input.originalResource.toJSON(),
      modifiedResource: input.modifiedResource.toJSON(),
      viewType: input.viewType,
      label: input.getName(),
      description: input.getDescription(),
      dirty: input.isDirty()
    };
    try {
      return JSON.stringify(data);
    } catch {
      return void 0;
    }
  }
  deserialize(_instantiationService, serializedEditorInput) {
    const data = JSON.parse(serializedEditorInput);
    return CustomEditorDiffInput.create(this._instantiationService, {
      originalResource: URI.revive(data.originalResource),
      modifiedResource: URI.revive(data.modifiedResource),
      viewType: data.viewType,
      label: data.label,
      description: data.description,
      iconPath: void 0
    }, void 0);
  }
};
CustomEditorDiffInputSerializer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], CustomEditorDiffInputSerializer);
let CustomEditorSideBySideDiffInputSerializer = class {
  constructor(_instantiationService) {
    this._instantiationService = _instantiationService;
  }
  static {
    this.ID = CustomEditorSideBySideDiffInput.typeId;
  }
  canSerialize(input) {
    return input instanceof CustomEditorSideBySideDiffInput;
  }
  serialize(input) {
    const data = {
      originalResource: input.originalResource.toJSON(),
      modifiedResource: input.modifiedResource.toJSON(),
      viewType: input.viewType,
      label: input.getName(),
      description: input.getDescription(),
      dirty: input.isDirty(),
      diffId: input.diffId,
      side: input.side
    };
    try {
      return JSON.stringify(data);
    } catch {
      return void 0;
    }
  }
  deserialize(_instantiationService, serializedEditorInput) {
    const data = JSON.parse(serializedEditorInput);
    return CustomEditorSideBySideDiffInput.create(this._instantiationService, {
      originalResource: URI.revive(data.originalResource),
      modifiedResource: URI.revive(data.modifiedResource),
      viewType: data.viewType,
      label: data.label,
      description: data.description,
      iconPath: void 0,
      diffId: data.diffId,
      side: data.side
    }, void 0);
  }
};
CustomEditorSideBySideDiffInputSerializer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], CustomEditorSideBySideDiffInputSerializer);
function reviveWebview(webviewService, data) {
  const webview = webviewService.createWebviewOverlay({
    providedViewType: data.viewType,
    origin: data.origin,
    title: data.title,
    options: {
      purpose: WebviewContentPurpose.CustomEditor,
      enableFindWidget: data.webviewOptions.enableFindWidget,
      retainContextWhenHidden: data.webviewOptions.retainContextWhenHidden
    },
    contentOptions: data.contentOptions,
    extension: data.extension
  });
  webview.state = data.state;
  return webview;
}
let ComplexCustomWorkingCopyEditorHandler = class extends Disposable {
  constructor(_instantiationService, _workingCopyEditorService, _workingCopyBackupService, _webviewService, _customEditorService) {
    super();
    this._instantiationService = _instantiationService;
    this._workingCopyBackupService = _workingCopyBackupService;
    this._webviewService = _webviewService;
    this._register(_workingCopyEditorService.registerHandler(this));
  }
  static {
    this.ID = "workbench.contrib.complexCustomWorkingCopyEditorHandler";
  }
  handles(workingCopy) {
    return workingCopy.resource.scheme === Schemas.vscodeCustomEditor;
  }
  isOpen(workingCopy, editor) {
    if (!this.handles(workingCopy)) {
      return false;
    }
    if (workingCopy.resource.authority === "jupyter-notebook-ipynb" && editor instanceof NotebookEditorInput) {
      try {
        const data = JSON.parse(workingCopy.resource.query);
        const workingCopyResource = URI.from(data);
        return isEqual(workingCopyResource, editor.resource);
      } catch {
        return false;
      }
    }
    if (!(editor instanceof CustomEditorInput)) {
      return false;
    }
    if (workingCopy.resource.authority !== editor.viewType.replace(/[^a-z0-9\-_]/gi, "-").toLowerCase()) {
      return false;
    }
    try {
      const data = JSON.parse(workingCopy.resource.query);
      const workingCopyResource = URI.from(data);
      return isEqual(workingCopyResource, editor.resource);
    } catch {
      return false;
    }
  }
  async createEditor(workingCopy) {
    const backup = await this._workingCopyBackupService.resolve(workingCopy);
    if (!backup?.meta) {
      throw new Error(`No backup found for custom editor: ${workingCopy.resource}`);
    }
    const backupData = backup.meta;
    const extension = reviveWebviewExtensionDescription(backupData.extension?.id, backupData.extension?.location);
    const webview = reviveWebview(this._webviewService, {
      viewType: backupData.viewType,
      origin: backupData.webview.origin,
      webviewOptions: restoreWebviewOptions(backupData.webview.options),
      contentOptions: restoreWebviewContentOptions(backupData.webview.options),
      state: backupData.webview.state,
      extension,
      title: backupData.customTitle
    });
    const editor = this._instantiationService.createInstance(CustomEditorInput, {
      resource: URI.revive(backupData.editorResource),
      viewType: backupData.viewType,
      webviewTitle: backupData.customTitle,
      preferredName: void 0,
      iconPath: reviveWebviewIconPath(backupData.iconPath)
    }, webview, { backupId: backupData.backupId });
    editor.updateGroup(0);
    return editor;
  }
};
ComplexCustomWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkingCopyEditorService),
  __decorateParam(2, IWorkingCopyBackupService),
  __decorateParam(3, IWebviewService),
  __decorateParam(4, ICustomEditorService)
], ComplexCustomWorkingCopyEditorHandler);
export {
  ComplexCustomWorkingCopyEditorHandler,
  CustomEditorDiffInputSerializer,
  CustomEditorInputSerializer,
  CustomEditorSideBySideDiffInputSerializer
};
