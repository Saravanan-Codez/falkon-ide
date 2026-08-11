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
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { autorun, derivedOpts } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { reset } from "../../../../base/browser/dom.js";
import { ISCMService } from "../../../../workbench/contrib/scm/common/scm.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
let SyncChangesActionViewItem = class extends ActionViewItem {
  constructor(action, options, scmService, contextService) {
    super(void 0, action, { ...options, icon: false, label: true });
    this.scmService = scmService;
    this.contextService = contextService;
    this._labelUpdateDisposable = this._register(new MutableDisposable());
  }
  getTooltip() {
    return this._tooltip ?? super.getTooltip();
  }
  updateLabel() {
    this._labelUpdateDisposable.clear();
    if (!this.label) {
      return;
    }
    this.label.classList.add("sync-changes-action-view-item");
    const workspaceFolder = this.contextService.getWorkspace().folders[0];
    const repository = workspaceFolder ? Iterable.find(this.scmService.repositories, (repo) => isEqual(repo.provider.rootUri, workspaceFolder.uri)) : void 0;
    const syncActionDetailsObs = derivedOpts(
      { equalsFn: structuralEquals },
      (reader) => {
        const commands = repository?.provider.statusBarCommands.read(reader);
        const syncCommand = commands?.find((c) => c.title.startsWith("$(sync)") || c.title.startsWith("$(sync~spin)"));
        return syncCommand ? {
          title: syncCommand.title,
          tooltip: syncCommand.tooltip
        } : void 0;
      }
    );
    this._labelUpdateDisposable.value = autorun((reader) => {
      const syncActionDetails = syncActionDetailsObs.read(reader);
      reset(this.label, ...syncActionDetails ? renderLabelWithIcons(syncActionDetails.title) : []);
      this._tooltip = syncActionDetails?.tooltip;
      this.updateTooltip();
    });
  }
};
SyncChangesActionViewItem = __decorateClass([
  __decorateParam(2, ISCMService),
  __decorateParam(3, IWorkspaceContextService)
], SyncChangesActionViewItem);
export {
  SyncChangesActionViewItem
};
