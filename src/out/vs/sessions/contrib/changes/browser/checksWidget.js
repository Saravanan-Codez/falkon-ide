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
import "./media/checksWidget.css";
import * as dom from "../../../../base/browser/dom.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Action } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../../workbench/browser/labels.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { GitHubCheckConclusion, GitHubCheckStatus } from "../../github/common/types.js";
import { parseWorkflowRunId } from "../../github/browser/models/githubPullRequestCIModel.js";
import { CICheckGroup, getCheckGroup, getCheckStateLabel } from "./checksActions.js";
const $ = dom.$;
class CICheckListDelegate {
  static {
    this.ITEM_HEIGHT = 28;
  }
  getHeight(_element) {
    return CICheckListDelegate.ITEM_HEIGHT;
  }
  getTemplateId(_element) {
    return CICheckListRenderer.TEMPLATE_ID;
  }
}
class CICheckListRenderer {
  constructor(_labels, _openerService, _getModel) {
    this._labels = _labels;
    this._openerService = _openerService;
    this._getModel = _getModel;
    this.templateId = CICheckListRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "ciCheck";
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const row = dom.append(container, $(".ci-status-widget-check"));
    const labelContainer = dom.append(row, $(".ci-status-widget-check-label"));
    const label = templateDisposables.add(this._labels.create(labelContainer, { supportIcons: true }));
    const actionBarContainer = dom.append(row, $(".ci-status-widget-check-actions"));
    const actionBar = templateDisposables.add(new ActionBar(actionBarContainer));
    return {
      row,
      label,
      actionBar,
      templateDisposables,
      elementDisposables: templateDisposables.add(new DisposableStore())
    };
  }
  renderElement(element, _index, templateData) {
    templateData.elementDisposables.clear();
    templateData.actionBar.clear();
    templateData.row.className = `ci-status-widget-check ${getCheckStatusClass(element.check)}`;
    const title = localize("ci.checkTitle", "{0}: {1}", element.check.name, getCheckStateLabel(element.check));
    templateData.label.setResource({
      name: element.check.name,
      resource: URI.from({ scheme: "github-check", path: `/${element.check.id}/${element.check.name}` })
    }, {
      icon: getCheckIcon(element.check),
      title
    });
    const actions = [];
    if (element.group === CICheckGroup.Failed && parseWorkflowRunId(element.check.detailsUrl) !== void 0) {
      actions.push(templateData.elementDisposables.add(new Action(
        "ci.rerunCheck",
        localize("ci.rerunCheck", "Rerun Check"),
        ThemeIcon.asClassName(Codicon.debugRerun),
        true,
        async () => {
          await this._getModel()?.rerunFailedCheck(element.check);
        }
      )));
    }
    if (element.check.detailsUrl) {
      actions.push(templateData.elementDisposables.add(new Action(
        "ci.openOnGitHub",
        localize("ci.openOnGitHub", "Open on GitHub"),
        ThemeIcon.asClassName(Codicon.linkExternal),
        true,
        async () => {
          await this._openerService.open(URI.parse(element.check.detailsUrl));
        }
      )));
    }
    templateData.actionBar.push(actions, { icon: true, label: false });
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposables.clear();
    templateData.actionBar.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
}
let CIStatusWidget = class extends Disposable {
  constructor(container, _openerService, _instantiationService) {
    super();
    this._openerService = _openerService;
    this._instantiationService = _instantiationService;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._onDidToggleCollapsed = this._register(new Emitter());
    this.onDidToggleCollapsed = this._onDidToggleCollapsed.event;
    this._checkCount = 0;
    this._collapsed = false;
    this._labels = this._register(this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
    this._domNode = dom.append(container, $(".ci-status-widget"));
    this._domNode.style.display = "none";
    this._headerNode = dom.append(this._domNode, $(".ci-status-widget-header"));
    this._titleNode = dom.append(this._headerNode, $(".ci-status-widget-title"));
    this._titleLabelNode = dom.append(this._titleNode, $(".ci-status-widget-title-label"));
    this._titleLabelNode.textContent = localize("ci.checksLabel", "Checks");
    this._countsNode = dom.append(this._titleNode, $(".ci-status-widget-counts"));
    this._chevronNode = dom.append(this._headerNode, $(".group-chevron"));
    this._chevronNode.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
    this._headerNode.setAttribute("role", "button");
    this._headerNode.setAttribute("aria-label", localize("ci.toggleChecks", "Toggle Checks"));
    this._headerNode.setAttribute("aria-expanded", "true");
    this._headerNode.tabIndex = 0;
    this._register(dom.addDisposableListener(this._headerNode, dom.EventType.CLICK, () => {
      this._toggleCollapsed();
    }));
    this._register(dom.addDisposableListener(this._headerNode, dom.EventType.KEY_DOWN, (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === this._headerNode) {
        e.preventDefault();
        this._toggleCollapsed();
      }
    }));
    const bodyId = "ci-status-widget-body";
    this._bodyNode = dom.append(this._domNode, $(`.${bodyId}`));
    this._bodyNode.id = bodyId;
    this._headerNode.setAttribute("aria-controls", bodyId);
    const listContainer = $(".ci-status-widget-list");
    this._list = this._register(this._instantiationService.createInstance(
      WorkbenchList,
      "CIStatusWidget",
      listContainer,
      new CICheckListDelegate(),
      [new CICheckListRenderer(this._labels, this._openerService, () => this._model)],
      {
        multipleSelectionSupport: false,
        openOnSingleClick: false,
        accessibilityProvider: {
          getWidgetAriaLabel: () => localize("ci.checksListAriaLabel", "Checks"),
          getAriaLabel: (item) => localize("ci.checkAriaLabel", "{0}, {1}", item.check.name, getCheckStateLabel(item.check))
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (item) => item.check.name
        }
      }
    ));
    this._bodyNode.appendChild(listContainer);
  }
  static {
    this.HEADER_HEIGHT = 34;
  }
  static {
    // 6px header margin-top + 8px header padding + 20px header min-height
    this.MIN_BODY_HEIGHT = 5 * CICheckListDelegate.ITEM_HEIGHT;
  }
  static {
    this.PREFERRED_BODY_HEIGHT = 5 * CICheckListDelegate.ITEM_HEIGHT;
  }
  static {
    this.MAX_BODY_HEIGHT = 240;
  }
  get element() {
    return this._domNode;
  }
  /** The full content height the widget would like (header + all checks). */
  get desiredHeight() {
    if (this._checkCount === 0) {
      return 0;
    }
    if (this._collapsed) {
      return CIStatusWidget.HEADER_HEIGHT;
    }
    return CIStatusWidget.HEADER_HEIGHT + this._checkCount * CICheckListDelegate.ITEM_HEIGHT;
  }
  /** Whether the widget is currently visible (has checks to show). */
  get visible() {
    return this._checkCount > 0;
  }
  /** Whether the body is collapsed (header-only). */
  get collapsed() {
    return this._collapsed;
  }
  setInput(input) {
    return autorun((reader) => {
      this._model = input.checksObs.read(reader);
      if (!this._model) {
        this._checkCount = 0;
        this._renderBody([]);
        this._domNode.style.display = "none";
        this._onDidChangeHeight.fire();
        return;
      }
      const checks = this._model.checks.read(reader);
      if (checks.length === 0) {
        this._checkCount = 0;
        this._renderBody([]);
        this._domNode.style.display = "none";
        this._onDidChangeHeight.fire();
        return;
      }
      const sorted = sortChecks(checks);
      const oldCount = this._checkCount;
      this._checkCount = sorted.length;
      this._domNode.style.display = "";
      this._renderHeader(checks);
      this._renderBody(sorted);
      if (this._checkCount !== oldCount) {
        this._onDidChangeHeight.fire();
      }
    });
  }
  _renderHeader(checks) {
    const counts = getCheckCounts(checks);
    dom.clearNode(this._countsNode);
    if (counts.running > 0) {
      const badge = dom.append(this._countsNode, $(".ci-status-widget-count-badge.ci-status-running"));
      badge.appendChild(renderIcon(Codicon.circleFilledCompact));
      dom.append(badge, $("span")).textContent = `${counts.running}`;
    }
    if (counts.failed > 0) {
      const badge = dom.append(this._countsNode, $(".ci-status-widget-count-badge.ci-status-failure"));
      badge.appendChild(renderIcon(Codicon.errorCompact));
      dom.append(badge, $("span")).textContent = `${counts.failed}`;
    }
    if (counts.pending > 0) {
      const badge = dom.append(this._countsNode, $(".ci-status-widget-count-badge.ci-status-pending"));
      badge.appendChild(renderIcon(Codicon.circleFilledCompact));
      dom.append(badge, $("span")).textContent = `${counts.pending}`;
    }
    if (counts.successful > 0) {
      const badge = dom.append(this._countsNode, $(".ci-status-widget-count-badge.ci-status-success"));
      badge.appendChild(renderIcon(Codicon.passFilledCompact));
      dom.append(badge, $("span")).textContent = `${counts.successful}`;
    }
  }
  /**
   * Layout the widget body list to the given height.
   * Called by the parent view after computing available space.
   */
  layout(height) {
    if (this._collapsed) {
      this._bodyNode.style.display = "none";
      return;
    }
    this._bodyNode.style.display = "";
    this._list.layout(height);
  }
  _toggleCollapsed() {
    this.setCollapsed(!this._collapsed);
  }
  /** Sets the collapsed state and notifies the SplitView layout. */
  setCollapsed(collapsed) {
    if (this._collapsed === collapsed) {
      return;
    }
    this._setCollapsed(collapsed);
    this._onDidToggleCollapsed.fire(collapsed);
    this._onDidChangeHeight.fire();
  }
  /**
   * Expand the body if it is currently collapsed, notifying listeners so the
   * parent pane restores its size. No-op when already expanded.
   */
  expand() {
    this.setCollapsed(false);
  }
  /**
   * Move keyboard focus into the checks list. Falls back to the header when
   * the body is collapsed or there is nothing to focus.
   */
  focus() {
    if (this._collapsed || this._checkCount === 0) {
      this._headerNode.focus();
      return;
    }
    this._list.domFocus();
    if (this._list.length > 0 && this._list.getFocus().length === 0) {
      this._list.setFocus([0]);
    }
  }
  _setCollapsed(collapsed) {
    this._collapsed = collapsed;
    this._updateChevron();
    this._headerNode.classList.toggle("collapsed", collapsed);
    this._headerNode.setAttribute("aria-expanded", String(!collapsed));
  }
  _updateChevron() {
    this._chevronNode.className = "group-chevron";
    this._chevronNode.classList.add(
      ...ThemeIcon.asClassNameArray(
        this._collapsed ? Codicon.chevronRight : Codicon.chevronDown
      )
    );
  }
  _renderBody(checks) {
    this._list.splice(0, this._list.length, checks);
  }
};
CIStatusWidget = __decorateClass([
  __decorateParam(1, IOpenerService),
  __decorateParam(2, IInstantiationService)
], CIStatusWidget);
function sortChecks(checks) {
  return [...checks].sort(compareChecks).map((check) => ({ check, group: getCheckGroup(check) }));
}
function compareChecks(a, b) {
  const groupDiff = getCheckGroup(a) - getCheckGroup(b);
  if (groupDiff !== 0) {
    return groupDiff;
  }
  return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
}
function getCheckCounts(checks) {
  let running = 0;
  let pending = 0;
  let failed = 0;
  let successful = 0;
  for (const check of checks) {
    switch (getCheckGroup(check)) {
      case CICheckGroup.Running:
        running++;
        break;
      case CICheckGroup.Pending:
        pending++;
        break;
      case CICheckGroup.Failed:
        failed++;
        break;
      case CICheckGroup.Successful:
        successful++;
        break;
    }
  }
  return { running, pending, failed, successful };
}
function getCheckIcon(check) {
  switch (check.status) {
    case GitHubCheckStatus.InProgress:
      return Codicon.syncCompact;
    case GitHubCheckStatus.Queued:
      return Codicon.circleFilledCompact;
    case GitHubCheckStatus.Completed:
      switch (check.conclusion) {
        case GitHubCheckConclusion.Success:
          return Codicon.passFilledCompact;
        case GitHubCheckConclusion.Failure:
        case GitHubCheckConclusion.TimedOut:
        case GitHubCheckConclusion.ActionRequired:
          return Codicon.errorCompact;
        case GitHubCheckConclusion.Cancelled:
          return Codicon.circleSlashCompact;
        case GitHubCheckConclusion.Skipped:
          return Codicon.debugStepOver;
        default:
          return Codicon.circleFilledCompact;
      }
    default:
      return Codicon.circleFilledCompact;
  }
}
function getCheckStatusClass(check) {
  switch (getCheckGroup(check)) {
    case CICheckGroup.Running:
      return "ci-status-running";
    case CICheckGroup.Pending:
      return "ci-status-pending";
    case CICheckGroup.Failed:
      return "ci-status-failure";
    case CICheckGroup.Successful:
      return "ci-status-success";
  }
}
export {
  CIStatusWidget
};
