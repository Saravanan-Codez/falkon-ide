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
import { dirname, extUriBiasedIgnorePathCase } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ChatExternalPathConfirmationContribution } from "../../common/tools/builtinTools/chatExternalPathConfirmation.js";
import { ChatUrlFetchingConfirmationContribution } from "../../common/tools/builtinTools/chatUrlFetchingConfirmation.js";
import { ILanguageModelToolsConfirmationService } from "../../common/tools/languageModelToolsConfirmationService.js";
import { ILanguageModelToolsService } from "../../common/tools/languageModelToolsService.js";
import { InternalFetchWebPageToolId } from "../../common/tools/builtinTools/tools.js";
import { FetchWebPageTool, FetchWebPageToolData } from "./fetchPageTool.js";
let NativeBuiltinToolsContribution = class extends Disposable {
  static {
    this.ID = "chat.nativeBuiltinTools";
  }
  constructor(toolsService, instantiationService, confirmationService, fileService, storageService, fileDialogService, labelService) {
    super();
    const editTool = instantiationService.createInstance(FetchWebPageTool);
    this._register(toolsService.registerTool(FetchWebPageToolData, editTool));
    this._register(confirmationService.registerConfirmationContribution(
      InternalFetchWebPageToolId,
      instantiationService.createInstance(
        ChatUrlFetchingConfirmationContribution,
        (params) => params.urls
      )
    ));
    const externalPathConfirmation = new ChatExternalPathConfirmationContribution(
      (ref) => {
        const params = ref.parameters;
        if (params?.filePath) {
          return { path: params.filePath, isDirectory: false };
        }
        if (params?.path) {
          return { path: params.path, isDirectory: true };
        }
        return void 0;
      },
      labelService,
      async (pathUri) => {
        let dir = dirname(pathUri);
        for (let i = 0; i < 100; i++) {
          try {
            if (await fileService.exists(URI.joinPath(dir, ".git"))) {
              return dir;
            }
          } catch {
          }
          const parent = dirname(dir);
          if (extUriBiasedIgnorePathCase.isEqual(parent, dir)) {
            return void 0;
          }
          dir = parent;
        }
        return void 0;
      },
      storageService,
      async () => {
        const result = await fileDialogService.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false
        });
        return result?.[0];
      }
    );
    this._register(externalPathConfirmation);
    this._register(confirmationService.registerConfirmationContribution(
      "copilot_readFile",
      externalPathConfirmation
    ));
    this._register(confirmationService.registerConfirmationContribution(
      "copilot_listDirectory",
      externalPathConfirmation
    ));
  }
};
NativeBuiltinToolsContribution = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILanguageModelToolsConfirmationService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IFileDialogService),
  __decorateParam(6, ILabelService)
], NativeBuiltinToolsContribution);
export {
  NativeBuiltinToolsContribution
};
