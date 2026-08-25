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
import * as dom from "../../../../base/browser/dom.js";
import * as paths from "../../../../base/common/path.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ResourceMarkers, Marker, RelatedInformation, MarkerTableItem } from "./markersModel.js";
import Messages from "./messages.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { dispose, Disposable, toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { QuickFixAction, QuickFixActionViewItem } from "./markersViewActions.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { basename, isEqual } from "../../../../base/common/resources.js";
import { TreeVisibility } from "../../../../base/browser/ui/tree/tree.js";
import { FilterOptions } from "./markersFilterOptions.js";
import { Emitter } from "../../../../base/common/event.js";
import { isUndefinedOrNull } from "../../../../base/common/types.js";
import { Action, toAction } from "../../../../base/common/actions.js";
import { localize } from "../../../../nls.js";
import { createCancelablePromise, Delayer } from "../../../../base/common/async.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { Range } from "../../../../editor/common/core/range.js";
import { applyCodeAction, ApplyCodeActionReason, getCodeActions } from "../../../../editor/contrib/codeAction/browser/codeAction.js";
import { CodeActionKind, CodeActionTriggerSource } from "../../../../editor/contrib/codeAction/common/types.js";
import { IEditorService, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { CodeActionTriggerType } from "../../../../editor/common/languages.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { MarkersContextKeys, MarkersViewMode } from "../common/markers.js";
import { unsupportedSchemas } from "../../../../platform/markers/common/markerService.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import Severity from "../../../../base/common/severity.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let MarkersWidgetAccessibilityProvider = class {
  constructor(labelService) {
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return localize("problemsView", "Problems View");
  }
  getAriaLabel(element) {
    if (element instanceof ResourceMarkers) {
      const path = this.labelService.getUriLabel(element.resource, { relative: true }) || element.resource.fsPath;
      return Messages.MARKERS_TREE_ARIA_LABEL_RESOURCE(element.markers.length, element.name, paths.dirname(path));
    }
    if (element instanceof Marker || element instanceof MarkerTableItem) {
      return Messages.MARKERS_TREE_ARIA_LABEL_MARKER(element);
    }
    if (element instanceof RelatedInformation) {
      return Messages.MARKERS_TREE_ARIA_LABEL_RELATED_INFORMATION(element.raw);
    }
    return null;
  }
};
MarkersWidgetAccessibilityProvider = __decorateClass([
  __decorateParam(0, ILabelService)
], MarkersWidgetAccessibilityProvider);
var TemplateId = /* @__PURE__ */ ((TemplateId2) => {
  TemplateId2["ResourceMarkers"] = "rm";
  TemplateId2["Marker"] = "m";
  TemplateId2["RelatedInformation"] = "ri";
  return TemplateId2;
})(TemplateId || {});
class VirtualDelegate {
  constructor(markersViewState) {
    this.markersViewState = markersViewState;
  }
  static {
    this.LINE_HEIGHT = 22;
  }
  getHeight(element) {
    if (element instanceof Marker) {
      const viewModel = this.markersViewState.getViewModel(element);
      const noOfLines = !viewModel || viewModel.multiline ? element.lines.length : 1;
      return noOfLines * VirtualDelegate.LINE_HEIGHT;
    }
    return VirtualDelegate.LINE_HEIGHT;
  }
  getTemplateId(element) {
    if (element instanceof ResourceMarkers) {
      return "rm" /* ResourceMarkers */;
    } else if (element instanceof Marker) {
      return "m" /* Marker */;
    } else {
      return "ri" /* RelatedInformation */;
    }
  }
}
var FilterDataType = /* @__PURE__ */ ((FilterDataType2) => {
  FilterDataType2[FilterDataType2["ResourceMarkers"] = 0] = "ResourceMarkers";
  FilterDataType2[FilterDataType2["Marker"] = 1] = "Marker";
  FilterDataType2[FilterDataType2["RelatedInformation"] = 2] = "RelatedInformation";
  return FilterDataType2;
})(FilterDataType || {});
class ResourceMarkersRenderer {
  constructor(labels, onDidChangeRenderNodeCount) {
    this.labels = labels;
    this.renderedNodes = /* @__PURE__ */ new Map();
    this.disposables = new DisposableStore();
    this.templateId = "rm" /* ResourceMarkers */;
    onDidChangeRenderNodeCount(this.onDidChangeRenderNodeCount, this, this.disposables);
  }
  renderTemplate(container) {
    const resourceLabelContainer = dom.append(container, dom.$(".resource-label-container"));
    const resourceLabel = this.labels.create(resourceLabelContainer, { supportHighlights: true });
    const badgeWrapper = dom.append(container, dom.$(".count-badge-wrapper"));
    const count = new CountBadge(badgeWrapper, {}, defaultCountBadgeStyles);
    return { count, resourceLabel };
  }
  renderElement(node, _, templateData) {
    const resourceMarkers = node.element;
    const uriMatches = node.filterData && node.filterData.uriMatches || [];
    templateData.resourceLabel.setFile(resourceMarkers.resource, { matches: uriMatches });
    this.updateCount(node, templateData);
    const nodeRenders = this.renderedNodes.get(resourceMarkers) ?? [];
    this.renderedNodes.set(resourceMarkers, [...nodeRenders, templateData]);
  }
  disposeElement(node, index, templateData) {
    const nodeRenders = this.renderedNodes.get(node.element) ?? [];
    const nodeRenderIndex = nodeRenders.findIndex((nodeRender) => templateData === nodeRender);
    if (nodeRenderIndex < 0) {
      throw new Error("Disposing unknown resource marker");
    }
    if (nodeRenders.length === 1) {
      this.renderedNodes.delete(node.element);
    } else {
      nodeRenders.splice(nodeRenderIndex, 1);
    }
  }
  disposeTemplate(templateData) {
    templateData.resourceLabel.dispose();
    templateData.count.dispose();
  }
  onDidChangeRenderNodeCount(node) {
    const nodeRenders = this.renderedNodes.get(node.element);
    if (!nodeRenders) {
      return;
    }
    nodeRenders.forEach((nodeRender) => this.updateCount(node, nodeRender));
  }
  updateCount(node, templateData) {
    templateData.count.setCount(node.children.reduce((r, n) => r + (n.visible ? 1 : 0), 0));
  }
  dispose() {
    this.disposables.dispose();
  }
}
class FileResourceMarkersRenderer extends ResourceMarkersRenderer {
}
let MarkerRenderer = class {
  constructor(markersViewState, hoverService, instantiationService, openerService) {
    this.markersViewState = markersViewState;
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.templateId = "m" /* Marker */;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.markerWidget = new MarkerWidget(container, this.markersViewState, this.hoverService, this.openerService, this.instantiationService);
    return data;
  }
  renderElement(node, _, templateData) {
    templateData.markerWidget.render(node.element, node.filterData);
  }
  disposeTemplate(templateData) {
    templateData.markerWidget.dispose();
  }
};
MarkerRenderer = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IOpenerService)
], MarkerRenderer);
const expandedIcon = registerIcon("markers-view-multi-line-expanded", Codicon.chevronUp, localize("expandedIcon", "Icon indicating that multiple lines are shown in the markers view."));
const collapsedIcon = registerIcon("markers-view-multi-line-collapsed", Codicon.chevronDown, localize("collapsedIcon", "Icon indicating that multiple lines are collapsed in the markers view."));
const toggleMultilineAction = "problems.action.toggleMultiline";
class ToggleMultilineActionViewItem extends ActionViewItem {
  render(container) {
    super.render(container);
    this.updateExpandedAttribute();
  }
  updateClass() {
    super.updateClass();
    this.updateExpandedAttribute();
  }
  updateExpandedAttribute() {
    this.element?.setAttribute("aria-expanded", `${this._action.class === ThemeIcon.asClassName(expandedIcon)}`);
  }
}
class MarkerWidget extends Disposable {
  constructor(parent, markersViewModel, _hoverService, _openerService, _instantiationService) {
    super();
    this.parent = parent;
    this.markersViewModel = markersViewModel;
    this._hoverService = _hoverService;
    this._openerService = _openerService;
    this.disposables = this._register(new DisposableStore());
    this.actionBar = this._register(new ActionBar(dom.append(parent, dom.$(".actions")), {
      actionViewItemProvider: (action, options) => action.id === QuickFixAction.ID ? _instantiationService.createInstance(QuickFixActionViewItem, action, options) : void 0
    }));
    this.iconContainer = dom.append(parent, dom.$(""));
    this.icon = dom.append(this.iconContainer, dom.$(""));
    this.messageAndDetailsContainer = dom.append(parent, dom.$(".marker-message-details-container"));
    this.messageAndDetailsContainerHover = this._register(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.messageAndDetailsContainer, ""));
  }
  render(element, filterData) {
    this.actionBar.clear();
    this.disposables.clear();
    dom.clearNode(this.messageAndDetailsContainer);
    this.iconContainer.className = `marker-icon ${Severity.toString(MarkerSeverity.toSeverity(element.marker.severity))}`;
    this.icon.className = `codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.severity))}`;
    this.renderQuickfixActionbar(element);
    this.renderMessageAndDetails(element, filterData);
    this.disposables.add(dom.addDisposableListener(this.parent, dom.EventType.MOUSE_OVER, () => this.markersViewModel.onMarkerMouseHover(element)));
    this.disposables.add(dom.addDisposableListener(this.parent, dom.EventType.MOUSE_LEAVE, () => this.markersViewModel.onMarkerMouseLeave(element)));
  }
  renderQuickfixActionbar(marker) {
    const viewModel = this.markersViewModel.getViewModel(marker);
    if (viewModel) {
      const quickFixAction = viewModel.quickFixAction;
      this.actionBar.push([quickFixAction], { icon: true, label: false });
      this.iconContainer.classList.toggle("quickFix", quickFixAction.enabled);
      quickFixAction.onDidChange(({ enabled }) => {
        if (!isUndefinedOrNull(enabled)) {
          this.iconContainer.classList.toggle("quickFix", enabled);
        }
      }, this, this.disposables);
      quickFixAction.onShowQuickFixes(() => {
        const quickFixActionViewItem = this.actionBar.viewItems[0];
        if (quickFixActionViewItem) {
          quickFixActionViewItem.showQuickFixes();
        }
      }, this, this.disposables);
    }
  }
  renderMultilineActionbar(marker, parent) {
    const multilineActionbar = this.disposables.add(new ActionBar(dom.append(parent, dom.$(".multiline-actions")), {
      actionViewItemProvider: (action2, options) => {
        if (action2.id === toggleMultilineAction) {
          return new ToggleMultilineActionViewItem(void 0, action2, { ...options, icon: true });
        }
        return void 0;
      }
    }));
    this.disposables.add(multilineActionbar);
    const viewModel = this.markersViewModel.getViewModel(marker);
    const multiline = viewModel && viewModel.multiline;
    const action = this.disposables.add(new Action(toggleMultilineAction));
    action.enabled = !!viewModel && marker.lines.length > 1;
    action.tooltip = multiline ? localize("single line", "Show message in single line") : localize("multi line", "Show message in multiple lines");
    action.class = ThemeIcon.asClassName(multiline ? expandedIcon : collapsedIcon);
    action.run = () => {
      if (viewModel) {
        viewModel.multiline = !viewModel.multiline;
      }
      return Promise.resolve();
    };
    multilineActionbar.push([action], { icon: true, label: false });
  }
  renderMessageAndDetails(element, filterData) {
    const { marker, lines } = element;
    const viewState = this.markersViewModel.getViewModel(element);
    const multiline = !viewState || viewState.multiline;
    const lineMatches = filterData && filterData.lineMatches || [];
    this.messageAndDetailsContainerHover.update(element.marker.message);
    const lineElements = [];
    for (let index = 0; index < (multiline ? lines.length : 1); index++) {
      const lineElement = dom.append(this.messageAndDetailsContainer, dom.$(".marker-message-line"));
      const messageElement = dom.append(lineElement, dom.$(".marker-message"));
      const highlightedLabel = this.disposables.add(new HighlightedLabel(messageElement));
      highlightedLabel.set(lines[index].length > 1e3 ? `${lines[index].substring(0, 1e3)}...` : lines[index], lineMatches[index]);
      if (lines[index] === "") {
        lineElement.style.height = `${VirtualDelegate.LINE_HEIGHT}px`;
      }
      lineElements.push(lineElement);
    }
    this.renderDetails(marker, filterData, lineElements[0]);
    this.renderMultilineActionbar(element, lineElements[0]);
  }
  renderDetails(marker, filterData, parent) {
    parent.classList.add("details-container");
    if (marker.source || marker.code) {
      const source = this.disposables.add(new HighlightedLabel(dom.append(parent, dom.$(".marker-source"))));
      const sourceMatches = filterData && filterData.sourceMatches || [];
      source.set(marker.source, sourceMatches);
      if (marker.code) {
        if (typeof marker.code === "string") {
          const code = this.disposables.add(new HighlightedLabel(dom.append(parent, dom.$(".marker-code"))));
          const codeMatches = filterData && filterData.codeMatches || [];
          code.set(marker.code, codeMatches);
        } else {
          const container = dom.$(".marker-code");
          const code = this.disposables.add(new HighlightedLabel(container));
          const link = marker.code.target.toString(true);
          this.disposables.add(new Link(parent, { href: link, label: container, title: link }, void 0, this._hoverService, this._openerService));
          const codeMatches = filterData && filterData.codeMatches || [];
          code.set(marker.code.value, codeMatches);
        }
      }
    }
    const lnCol = dom.append(parent, dom.$("span.marker-line"));
    lnCol.textContent = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(marker.startLineNumber, marker.startColumn);
  }
}
let RelatedInformationRenderer = class {
  constructor(labelService) {
    this.labelService = labelService;
    this.templateId = "ri" /* RelatedInformation */;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    dom.append(container, dom.$(".actions"));
    dom.append(container, dom.$(".icon"));
    data.resourceLabel = new HighlightedLabel(dom.append(container, dom.$(".related-info-resource")));
    data.lnCol = dom.append(container, dom.$("span.marker-line"));
    const separator = dom.append(container, dom.$("span.related-info-resource-separator"));
    separator.textContent = ":";
    separator.style.paddingRight = "4px";
    data.description = new HighlightedLabel(dom.append(container, dom.$(".marker-description")));
    return data;
  }
  renderElement(node, _, templateData) {
    const relatedInformation = node.element.raw;
    const uriMatches = node.filterData && node.filterData.uriMatches || [];
    const messageMatches = node.filterData && node.filterData.messageMatches || [];
    const resourceLabelTitle = this.labelService.getUriLabel(relatedInformation.resource, { relative: true });
    templateData.resourceLabel.set(basename(relatedInformation.resource), uriMatches, resourceLabelTitle);
    templateData.lnCol.textContent = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(relatedInformation.startLineNumber, relatedInformation.startColumn);
    templateData.description.set(relatedInformation.message, messageMatches, relatedInformation.message);
  }
  disposeTemplate(templateData) {
    templateData.resourceLabel.dispose();
    templateData.description.dispose();
  }
};
RelatedInformationRenderer = __decorateClass([
  __decorateParam(0, ILabelService)
], RelatedInformationRenderer);
class Filter {
  constructor(options) {
    this.options = options;
  }
  filter(element, parentVisibility) {
    if (element instanceof ResourceMarkers) {
      return this.filterResourceMarkers(element);
    } else if (element instanceof Marker) {
      return this.filterMarker(element, parentVisibility);
    } else {
      return this.filterRelatedInformation(element, parentVisibility);
    }
  }
  filterResourceMarkers(resourceMarkers) {
    if (unsupportedSchemas.has(resourceMarkers.resource.scheme)) {
      return false;
    }
    if (this.options.excludesMatcher.matches(resourceMarkers.resource)) {
      return false;
    }
    if (this.options.includesMatcher.matches(resourceMarkers.resource)) {
      return true;
    }
    if (this.options.textFilter.text && !this.options.textFilter.negate) {
      const uriMatches = FilterOptions._filter(this.options.textFilter.text, basename(resourceMarkers.resource));
      if (uriMatches) {
        return { visibility: true, data: { type: 0 /* ResourceMarkers */, uriMatches: uriMatches || [] } };
      }
    }
    return TreeVisibility.Recurse;
  }
  filterMarker(marker, parentVisibility) {
    const matchesSeverity = this.options.showErrors && MarkerSeverity.Error === marker.marker.severity || this.options.showWarnings && MarkerSeverity.Warning === marker.marker.severity || this.options.showInfos && MarkerSeverity.Info === marker.marker.severity;
    if (!matchesSeverity) {
      return false;
    }
    if (!this.options.matchesSourceFilters(marker.marker.source)) {
      return false;
    }
    if (!this.options.textFilter.text) {
      return true;
    }
    const lineMatches = [];
    for (const line of marker.lines) {
      const lineMatch = FilterOptions._messageFilter(this.options.textFilter.text, line);
      lineMatches.push(lineMatch || []);
    }
    const sourceMatches = marker.marker.source ? FilterOptions._filter(this.options.textFilter.text, marker.marker.source) : void 0;
    const codeMatches = marker.marker.code ? FilterOptions._filter(this.options.textFilter.text, typeof marker.marker.code === "string" ? marker.marker.code : marker.marker.code.value) : void 0;
    const matched = sourceMatches || codeMatches || lineMatches.some((lineMatch) => lineMatch.length > 0);
    if (matched && !this.options.textFilter.negate) {
      return { visibility: true, data: { type: 1 /* Marker */, lineMatches, sourceMatches: sourceMatches || [], codeMatches: codeMatches || [] } };
    }
    if (matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return false;
    }
    if (!matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return true;
    }
    return parentVisibility;
  }
  filterRelatedInformation(relatedInformation, parentVisibility) {
    if (!this.options.textFilter.text) {
      return true;
    }
    const uriMatches = FilterOptions._filter(this.options.textFilter.text, basename(relatedInformation.raw.resource));
    const messageMatches = FilterOptions._messageFilter(this.options.textFilter.text, paths.basename(relatedInformation.raw.message));
    const matched = uriMatches || messageMatches;
    if (matched && !this.options.textFilter.negate) {
      return { visibility: true, data: { type: 2 /* RelatedInformation */, uriMatches: uriMatches || [], messageMatches: messageMatches || [] } };
    }
    if (matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return false;
    }
    if (!matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return true;
    }
    return parentVisibility;
  }
}
let MarkerViewModel = class extends Disposable {
  constructor(marker, modelService, instantiationService, editorService, languageFeaturesService) {
    super();
    this.marker = marker;
    this.modelService = modelService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.languageFeaturesService = languageFeaturesService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.modelPromise = null;
    this.codeActionsPromise = null;
    this._multiline = true;
    this._quickFixAction = null;
    this._register(toDisposable(() => {
      if (this.modelPromise) {
        this.modelPromise.cancel();
      }
      if (this.codeActionsPromise) {
        this.codeActionsPromise.cancel();
      }
    }));
  }
  get multiline() {
    return this._multiline;
  }
  set multiline(value) {
    if (this._multiline !== value) {
      this._multiline = value;
      this._onDidChange.fire();
    }
  }
  get quickFixAction() {
    if (!this._quickFixAction) {
      this._quickFixAction = this._register(this.instantiationService.createInstance(QuickFixAction, this.marker));
    }
    return this._quickFixAction;
  }
  showLightBulb() {
    this.setQuickFixes(true);
  }
  async setQuickFixes(waitForModel) {
    const codeActions = await this.getCodeActions(waitForModel);
    this.quickFixAction.quickFixes = codeActions ? this.toActions(codeActions) : [];
    this.quickFixAction.autoFixable(!!codeActions && codeActions.hasAutoFix);
  }
  getCodeActions(waitForModel) {
    if (this.codeActionsPromise !== null) {
      return this.codeActionsPromise;
    }
    return this.getModel(waitForModel).then((model) => {
      if (model) {
        if (!this.codeActionsPromise) {
          this.codeActionsPromise = createCancelablePromise((cancellationToken) => {
            return getCodeActions(this.languageFeaturesService.codeActionProvider, model, new Range(this.marker.range.startLineNumber, this.marker.range.startColumn, this.marker.range.endLineNumber, this.marker.range.endColumn), {
              type: CodeActionTriggerType.Invoke,
              triggerAction: CodeActionTriggerSource.ProblemsView,
              filter: { include: CodeActionKind.QuickFix }
            }, Progress.None, cancellationToken).then((actions) => {
              return this._register(actions);
            });
          });
        }
        return this.codeActionsPromise;
      }
      return null;
    });
  }
  toActions(codeActions) {
    return codeActions.validActions.map((item) => toAction({
      id: item.action.command ? item.action.command.id : item.action.title,
      label: item.action.title,
      run: async () => {
        await this.openFileAtMarker(this.marker);
        return await this.instantiationService.invokeFunction(applyCodeAction, item, ApplyCodeActionReason.FromProblemsView);
      }
    }));
  }
  openFileAtMarker(element) {
    const { resource, selection } = { resource: element.resource, selection: element.range };
    return this.editorService.openEditor({
      resource,
      options: {
        selection,
        preserveFocus: true,
        pinned: false,
        revealIfVisible: true
      }
    }, ACTIVE_GROUP).then(() => void 0);
  }
  getModel(waitForModel) {
    const model = this.modelService.getModel(this.marker.resource);
    if (model) {
      return Promise.resolve(model);
    }
    if (waitForModel) {
      if (!this.modelPromise) {
        this.modelPromise = createCancelablePromise((cancellationToken) => {
          return new Promise((c) => {
            this._register(this.modelService.onModelAdded((model2) => {
              if (isEqual(model2.uri, this.marker.resource)) {
                c(model2);
              }
            }));
          });
        });
      }
      return this.modelPromise;
    }
    return Promise.resolve(null);
  }
};
MarkerViewModel = __decorateClass([
  __decorateParam(1, IModelService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ILanguageFeaturesService)
], MarkerViewModel);
let MarkersViewModel = class extends Disposable {
  constructor(multiline = true, viewMode = MarkersViewMode.Tree, contextKeyService, instantiationService) {
    super();
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeViewMode = this._register(new Emitter());
    this.onDidChangeViewMode = this._onDidChangeViewMode.event;
    this.markersViewStates = /* @__PURE__ */ new Map();
    this.markersPerResource = /* @__PURE__ */ new Map();
    this.bulkUpdate = false;
    this.hoveredMarker = null;
    this.hoverDelayer = this._register(new Delayer(300));
    this._multiline = true;
    this._viewMode = MarkersViewMode.Tree;
    this._multiline = multiline;
    this._viewMode = viewMode;
    this.viewModeContextKey = MarkersContextKeys.MarkersViewModeContextKey.bindTo(this.contextKeyService);
    this.viewModeContextKey.set(viewMode);
  }
  add(marker) {
    if (!this.markersViewStates.has(marker.id)) {
      const viewModel = this.instantiationService.createInstance(MarkerViewModel, marker);
      const disposables = [viewModel];
      viewModel.multiline = this.multiline;
      viewModel.onDidChange(() => {
        if (!this.bulkUpdate) {
          this._onDidChange.fire(marker);
        }
      }, this, disposables);
      this.markersViewStates.set(marker.id, { viewModel, disposables });
      const markers = this.markersPerResource.get(marker.resource.toString()) || [];
      markers.push(marker);
      this.markersPerResource.set(marker.resource.toString(), markers);
    }
  }
  remove(resource) {
    const markers = this.markersPerResource.get(resource.toString()) || [];
    for (const marker of markers) {
      const value = this.markersViewStates.get(marker.id);
      if (value) {
        dispose(value.disposables);
      }
      this.markersViewStates.delete(marker.id);
      if (this.hoveredMarker === marker) {
        this.hoveredMarker = null;
      }
    }
    this.markersPerResource.delete(resource.toString());
  }
  getViewModel(marker) {
    const value = this.markersViewStates.get(marker.id);
    return value ? value.viewModel : null;
  }
  onMarkerMouseHover(marker) {
    this.hoveredMarker = marker;
    this.hoverDelayer.trigger(() => {
      if (this.hoveredMarker) {
        const model = this.getViewModel(this.hoveredMarker);
        if (model) {
          model.showLightBulb();
        }
      }
    });
  }
  onMarkerMouseLeave(marker) {
    if (this.hoveredMarker === marker) {
      this.hoveredMarker = null;
    }
  }
  get multiline() {
    return this._multiline;
  }
  set multiline(value) {
    let changed = false;
    if (this._multiline !== value) {
      this._multiline = value;
      changed = true;
    }
    this.bulkUpdate = true;
    this.markersViewStates.forEach(({ viewModel }) => {
      if (viewModel.multiline !== value) {
        viewModel.multiline = value;
        changed = true;
      }
    });
    this.bulkUpdate = false;
    if (changed) {
      this._onDidChange.fire(void 0);
    }
  }
  get viewMode() {
    return this._viewMode;
  }
  set viewMode(value) {
    if (this._viewMode === value) {
      return;
    }
    this._viewMode = value;
    this._onDidChangeViewMode.fire(value);
    this.viewModeContextKey.set(value);
  }
  dispose() {
    this.markersViewStates.forEach(({ disposables }) => dispose(disposables));
    this.markersViewStates.clear();
    this.markersPerResource.clear();
    super.dispose();
  }
};
MarkersViewModel = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IInstantiationService)
], MarkersViewModel);
export {
  FileResourceMarkersRenderer,
  Filter,
  MarkerRenderer,
  MarkerViewModel,
  MarkersViewModel,
  MarkersWidgetAccessibilityProvider,
  RelatedInformationRenderer,
  ResourceMarkersRenderer,
  VirtualDelegate
};
