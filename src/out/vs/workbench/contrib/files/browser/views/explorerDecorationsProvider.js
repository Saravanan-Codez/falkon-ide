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
import { Emitter } from "../../../../../base/common/event.js";
import { localize } from "../../../../../nls.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { listInvalidItemForeground, listDeemphasizedForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { explorerRootErrorEmitter } from "./explorerViewer.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
function provideDecorations(fileStat) {
  if (fileStat.isRoot && fileStat.error) {
    return {
      tooltip: localize("canNotResolve", "Unable to resolve workspace folder ({0})", toErrorMessage(fileStat.error)),
      letter: "!",
      color: listInvalidItemForeground
    };
  }
  if (fileStat.isSymbolicLink) {
    return {
      tooltip: localize("symbolicLlink", "Symbolic Link"),
      letter: "\u2937"
    };
  }
  if (fileStat.isUnknown) {
    return {
      tooltip: localize("unknown", "Unknown File Type"),
      letter: "?"
    };
  }
  if (fileStat.isExcluded) {
    return {
      color: listDeemphasizedForeground
    };
  }
  return void 0;
}
let ExplorerDecorationsProvider = class {
  constructor(explorerService, contextService) {
    this.explorerService = explorerService;
    this.label = localize("label", "Explorer");
    this._onDidChange = new Emitter();
    this.toDispose = new DisposableStore();
    this.toDispose.add(this._onDidChange);
    this.toDispose.add(contextService.onDidChangeWorkspaceFolders((e) => {
      this._onDidChange.fire(e.changed.concat(e.added).map((wf) => wf.uri));
    }));
    this.toDispose.add(explorerRootErrorEmitter.event(((resource) => {
      this._onDidChange.fire([resource]);
    })));
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  async provideDecorations(resource) {
    const fileStat = this.explorerService.findClosest(resource);
    if (!fileStat) {
      throw new Error("ExplorerItem not found");
    }
    return provideDecorations(fileStat);
  }
  dispose() {
    this.toDispose.dispose();
  }
};
ExplorerDecorationsProvider = __decorateClass([
  __decorateParam(1, IWorkspaceContextService)
], ExplorerDecorationsProvider);
export {
  ExplorerDecorationsProvider,
  provideDecorations
};
