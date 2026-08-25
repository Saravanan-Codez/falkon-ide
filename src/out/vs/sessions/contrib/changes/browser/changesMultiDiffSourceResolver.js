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
import { derivedObservableWithCache, derivedOpts, ValueWithChangeEventFromObservable } from "../../../../base/common/observable.js";
import { equals as arraysEqual } from "../../../../base/common/arrays.js";
import { isEqual } from "../../../../base/common/resources.js";
import { comparePaths } from "../../../../base/common/comparers.js";
import { isIChatSessionFileChange2 } from "../../../../workbench/contrib/chat/common/chatSessionsService.js";
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from "../../../../workbench/contrib/multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { ISessionChangesService } from "./sessionChangesService.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
const SessionChangesReviewedFilesContext = new RawContextKey("sessions.changesReviewedFiles", []);
const SessionChangesFileResourceContext = new RawContextKey("sessions.changesFileResource", void 0);
function compareChanges(a, b) {
  const aPath = isIChatSessionFileChange2(a) ? a.uri.fsPath : a.modifiedUri.fsPath;
  const bPath = isIChatSessionFileChange2(b) ? b.uri.fsPath : b.modifiedUri.fsPath;
  return comparePaths(aPath, bPath);
}
let ChangesMultiDiffSourceResolver = class extends Disposable {
  constructor(changesViewService, multiDiffSourceResolverService, _sessionChangesService) {
    super();
    this.changesViewService = changesViewService;
    this._sessionChangesService = _sessionChangesService;
    this._register(multiDiffSourceResolverService.registerResolver(this));
  }
  canHandleUri(uri) {
    return this._sessionChangesService.getSessionResource(uri) !== void 0;
  }
  async resolveDiffSource(uri) {
    const sessionResource = this._sessionChangesService.getSessionResource(uri);
    const changesObs = derivedObservableWithCache({
      owner: this
    }, (reader, lastValue) => {
      if (this.changesViewService.activeSessionLoadingObs.read(reader)) {
        return lastValue ?? [];
      }
      const activeSessionResource = this.changesViewService.activeSessionResourceObs.read(reader);
      if (!activeSessionResource || !isEqual(activeSessionResource, sessionResource)) {
        return lastValue ?? [];
      }
      return this.changesViewService.activeSessionChangesObs.read(reader);
    });
    const resourcesObs = derivedOpts({
      owner: this,
      equalsFn: (a, b) => arraysEqual(a, b, (x, y) => isEqual(x.originalUri, y.originalUri) && isEqual(x.modifiedUri, y.modifiedUri))
    }, (reader) => {
      const changes = changesObs.read(reader);
      return [...changes].sort(compareChanges).map((change) => new MultiDiffEditorItem(change.originalUri, change.modifiedUri, change.modifiedUri, void 0, {
        [SessionChangesFileResourceContext.key]: change.modifiedUri?.toString() ?? change.originalUri?.toString() ?? ""
      }));
    });
    return { resources: new ValueWithChangeEventFromObservable(resourcesObs) };
  }
};
ChangesMultiDiffSourceResolver = __decorateClass([
  __decorateParam(0, IChangesViewService),
  __decorateParam(1, IMultiDiffSourceResolverService),
  __decorateParam(2, ISessionChangesService)
], ChangesMultiDiffSourceResolver);
export {
  ChangesMultiDiffSourceResolver,
  SessionChangesFileResourceContext,
  SessionChangesReviewedFilesContext
};
