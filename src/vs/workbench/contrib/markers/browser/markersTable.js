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
import { localize } from "../../../../nls.js";
import * as DOM from "../../../../base/browser/dom.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { compareMarkersByUri, Marker, MarkerTableItem } from "./markersModel.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { FilterOptions } from "./markersFilterOptions.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { QuickFixAction, QuickFixActionViewItem } from "./markersViewActions.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import Messages from "./messages.js";
import { isUndefinedOrNull } from "../../../../base/common/types.js";
import { Range } from "../../../../editor/common/core/range.js";
import { unsupportedSchemas } from "../../../../platform/markers/common/markerService.js";
import Severity from "../../../../base/common/severity.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const $ = DOM.$;
let MarkerSeverityColumnRenderer = class {
  constructor(markersViewModel, instantiationService) {
    this.markersViewModel = markersViewModel;
    this.instantiationService = instantiationService;
    this.templateId = MarkerSeverityColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "severity";
  }
  renderTemplate(container) {
    const severityColumn = DOM.append(container, $(".severity"));
    const icon = DOM.append(severityColumn, $(""));
    const actionBarColumn = DOM.append(container, $(".actions"));
    const actionBar = new ActionBar(actionBarColumn, {
      actionViewItemProvider: (action, options) => action.id === QuickFixAction.ID ? this.instantiationService.createInstance(QuickFixActionViewItem, action, options) : void 0
    });
    return { actionBar, icon, elementDisposables: new DisposableStore() };
  }
  renderElement(element, index, templateData) {
    templateData.elementDisposables.clear();
    const toggleQuickFix = (enabled) => {
      if (!isUndefinedOrNull(enabled)) {
        const container = DOM.findParentWithClass(templateData.icon, "monaco-table-td");
        container.classList.toggle("quickFix", enabled);
      }
    };
    templateData.icon.title = MarkerSeverity.toString(element.marker.severity);
    templateData.icon.className = `marker-icon ${Severity.toString(MarkerSeverity.toSeverity(element.marker.severity))} codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.severity))}`;
    templateData.actionBar.clear();
    const viewModel = this.markersViewModel.getViewModel(element);
    if (viewModel) {
      const quickFixAction = viewModel.quickFixAction;
      templateData.actionBar.push([quickFixAction], { icon: true, label: false });
      toggleQuickFix(viewModel.quickFixAction.enabled);
      templateData.elementDisposables.add(quickFixAction.onDidChange(({ enabled }) => toggleQuickFix(enabled)));
      templateData.elementDisposables.add(quickFixAction.onShowQuickFixes(() => {
        const quickFixActionViewItem = templateData.actionBar.viewItems[0];
        if (quickFixActionViewItem) {
          quickFixActionViewItem.showQuickFixes();
        }
      }));
    }
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.actionBar.dispose();
  }
};
MarkerSeverityColumnRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService)
], MarkerSeverityColumnRenderer);
let MarkerCodeColumnRenderer = class {
  constructor(hoverService, openerService) {
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.templateId = MarkerCodeColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "code";
  }
  renderTemplate(container) {
    const templateDisposable = new DisposableStore();
    const codeColumn = DOM.append(container, $(".code"));
    const sourceLabel = templateDisposable.add(new HighlightedLabel(codeColumn));
    sourceLabel.element.classList.add("source-label");
    const codeLabel = templateDisposable.add(new HighlightedLabel(codeColumn));
    codeLabel.element.classList.add("code-label");
    const codeLink = templateDisposable.add(new Link(codeColumn, { href: "", label: "" }, {}, this.hoverService, this.openerService));
    return { codeColumn, sourceLabel, codeLabel, codeLink, templateDisposable };
  }
  renderElement(element, index, templateData) {
    templateData.codeColumn.classList.remove("code-label");
    templateData.codeColumn.classList.remove("code-link");
    if (element.marker.source && element.marker.code) {
      if (typeof element.marker.code === "string") {
        templateData.codeColumn.classList.add("code-label");
        templateData.codeColumn.title = `${element.marker.source} (${element.marker.code})`;
        templateData.sourceLabel.set(element.marker.source, element.sourceMatches);
        templateData.codeLabel.set(element.marker.code, element.codeMatches);
      } else {
        templateData.codeColumn.classList.add("code-link");
        templateData.codeColumn.title = `${element.marker.source} (${element.marker.code.value})`;
        templateData.sourceLabel.set(element.marker.source, element.sourceMatches);
        const codeLinkLabel = templateData.templateDisposable.add(new HighlightedLabel($(".code-link-label")));
        codeLinkLabel.set(element.marker.code.value, element.codeMatches);
        templateData.codeLink.link = {
          href: element.marker.code.target.toString(true),
          title: element.marker.code.target.toString(true),
          label: codeLinkLabel.element
        };
      }
    } else {
      templateData.codeColumn.title = "";
      templateData.sourceLabel.set("-");
    }
  }
  disposeTemplate(templateData) {
    templateData.templateDisposable.dispose();
  }
};
MarkerCodeColumnRenderer = __decorateClass([
  __decorateParam(0, IHoverService),
  __decorateParam(1, IOpenerService)
], MarkerCodeColumnRenderer);
class MarkerMessageColumnRenderer {
  constructor() {
    this.templateId = MarkerMessageColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "message";
  }
  renderTemplate(container) {
    const columnElement = DOM.append(container, $(".message"));
    const highlightedLabel = new HighlightedLabel(columnElement);
    return { columnElement, highlightedLabel };
  }
  renderElement(element, index, templateData) {
    templateData.columnElement.title = element.marker.message;
    templateData.highlightedLabel.set(element.marker.message, element.messageMatches);
  }
  disposeTemplate(templateData) {
    templateData.highlightedLabel.dispose();
  }
}
let MarkerFileColumnRenderer = class {
  constructor(labelService) {
    this.labelService = labelService;
    this.templateId = MarkerFileColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "file";
  }
  renderTemplate(container) {
    const columnElement = DOM.append(container, $(".file"));
    const fileLabel = new HighlightedLabel(columnElement);
    fileLabel.element.classList.add("file-label");
    const positionLabel = new HighlightedLabel(columnElement);
    positionLabel.element.classList.add("file-position");
    return { columnElement, fileLabel, positionLabel };
  }
  renderElement(element, index, templateData) {
    const positionLabel = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(element.marker.startLineNumber, element.marker.startColumn);
    templateData.columnElement.title = `${this.labelService.getUriLabel(element.marker.resource, { relative: false })} ${positionLabel}`;
    templateData.fileLabel.set(this.labelService.getUriLabel(element.marker.resource, { relative: true }), element.fileMatches);
    templateData.positionLabel.set(positionLabel, void 0);
  }
  disposeTemplate(templateData) {
    templateData.fileLabel.dispose();
    templateData.positionLabel.dispose();
  }
};
MarkerFileColumnRenderer = __decorateClass([
  __decorateParam(0, ILabelService)
], MarkerFileColumnRenderer);
class MarkerSourceColumnRenderer {
  constructor() {
    this.templateId = MarkerSourceColumnRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "source";
  }
  renderTemplate(container) {
    const columnElement = DOM.append(container, $(".source"));
    const highlightedLabel = new HighlightedLabel(columnElement);
    return { columnElement, highlightedLabel };
  }
  renderElement(element, index, templateData) {
    templateData.columnElement.title = element.marker.source ?? "";
    templateData.highlightedLabel.set(element.marker.source ?? "", element.sourceMatches);
  }
  disposeTemplate(templateData) {
    templateData.highlightedLabel.dispose();
  }
}
class MarkersTableVirtualDelegate {
  constructor() {
    this.headerRowHeight = MarkersTableVirtualDelegate.HEADER_ROW_HEIGHT;
  }
  static {
    this.HEADER_ROW_HEIGHT = 24;
  }
  static {
    this.ROW_HEIGHT = 24;
  }
  getHeight(item) {
    return MarkersTableVirtualDelegate.ROW_HEIGHT;
  }
}
let MarkersTable = class extends Disposable {
  constructor(container, markersViewModel, resourceMarkers, filterOptions, options, instantiationService, labelService) {
    super();
    this.container = container;
    this.markersViewModel = markersViewModel;
    this.resourceMarkers = resourceMarkers;
    this.filterOptions = filterOptions;
    this.instantiationService = instantiationService;
    this.labelService = labelService;
    this._itemCount = 0;
    this.table = this.instantiationService.createInstance(
      WorkbenchTable,
      "Markers",
      this.container,
      new MarkersTableVirtualDelegate(),
      [
        {
          label: "",
          tooltip: "",
          weight: 0,
          minimumWidth: 36,
          maximumWidth: 36,
          templateId: MarkerSeverityColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("codeColumnLabel", "Code"),
          tooltip: "",
          weight: 1,
          minimumWidth: 100,
          maximumWidth: 300,
          templateId: MarkerCodeColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("messageColumnLabel", "Message"),
          tooltip: "",
          weight: 4,
          templateId: MarkerMessageColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("fileColumnLabel", "File"),
          tooltip: "",
          weight: 2,
          templateId: MarkerFileColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("sourceColumnLabel", "Source"),
          tooltip: "",
          weight: 1,
          minimumWidth: 100,
          maximumWidth: 300,
          templateId: MarkerSourceColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        }
      ],
      [
        this.instantiationService.createInstance(MarkerSeverityColumnRenderer, this.markersViewModel),
        this.instantiationService.createInstance(MarkerCodeColumnRenderer),
        this.instantiationService.createInstance(MarkerMessageColumnRenderer),
        this.instantiationService.createInstance(MarkerFileColumnRenderer),
        this.instantiationService.createInstance(MarkerSourceColumnRenderer)
      ],
      options
    );
    const list = this.table.domNode.querySelector(".monaco-list-rows");
    const onRowHover = Event.chain(
      this._register(new DomEmitter(list, "mouseover")).event,
      ($2) => $2.map((e) => DOM.findParentWithClass(e.target, "monaco-list-row", "monaco-list-rows")).filter((e) => !!e).map((e) => parseInt(e.getAttribute("data-index")))
    );
    const onListLeave = Event.map(this._register(new DomEmitter(list, "mouseleave")).event, () => -1);
    const onRowHoverOrLeave = Event.latch(Event.any(onRowHover, onListLeave));
    const onRowPermanentHover = Event.debounce(onRowHoverOrLeave, (_, e) => e, 500);
    this._register(onRowPermanentHover((e) => {
      if (e !== -1 && this.table.row(e)) {
        this.markersViewModel.onMarkerMouseHover(this.table.row(e));
      }
    }));
  }
  get contextKeyService() {
    return this.table.contextKeyService;
  }
  get onContextMenu() {
    return this.table.onContextMenu;
  }
  get onDidOpen() {
    return this.table.onDidOpen;
  }
  get onDidChangeFocus() {
    return this.table.onDidChangeFocus;
  }
  get onDidChangeSelection() {
    return this.table.onDidChangeSelection;
  }
  collapseMarkers() {
  }
  domFocus() {
    this.table.domFocus();
  }
  filterMarkers(resourceMarkers, filterOptions) {
    this.filterOptions = filterOptions;
    this.reset(resourceMarkers);
  }
  getFocus() {
    const focus = this.table.getFocus();
    return focus.length > 0 ? [...focus.map((f) => this.table.row(f))] : [];
  }
  getHTMLElement() {
    return this.table.getHTMLElement();
  }
  getRelativeTop(marker) {
    return marker ? this.table.getRelativeTop(this.table.indexOf(marker)) : null;
  }
  getSelection() {
    const selection = this.table.getSelection();
    return selection.length > 0 ? [...selection.map((i) => this.table.row(i))] : [];
  }
  getVisibleItemCount() {
    return this._itemCount;
  }
  isVisible() {
    return !this.container.classList.contains("hidden");
  }
  layout(height, width) {
    this.container.style.height = `${height}px`;
    this.table.layout(height, width);
  }
  reset(resourceMarkers) {
    this.resourceMarkers = resourceMarkers;
    const items = [];
    for (const resourceMarker of this.resourceMarkers) {
      for (const marker of resourceMarker.markers) {
        if (unsupportedSchemas.has(marker.resource.scheme)) {
          continue;
        }
        if (this.filterOptions.excludesMatcher.matches(marker.resource)) {
          continue;
        }
        if (this.filterOptions.includesMatcher.matches(marker.resource)) {
          items.push(new MarkerTableItem(marker));
          continue;
        }
        const matchesSeverity = this.filterOptions.showErrors && MarkerSeverity.Error === marker.marker.severity || this.filterOptions.showWarnings && MarkerSeverity.Warning === marker.marker.severity || this.filterOptions.showInfos && MarkerSeverity.Info === marker.marker.severity;
        if (!matchesSeverity) {
          continue;
        }
        if (!this.filterOptions.matchesSourceFilters(marker.marker.source)) {
          continue;
        }
        if (this.filterOptions.textFilter.text) {
          const sourceMatches = marker.marker.source ? FilterOptions._filter(this.filterOptions.textFilter.text, marker.marker.source) ?? void 0 : void 0;
          const codeMatches = marker.marker.code ? FilterOptions._filter(this.filterOptions.textFilter.text, typeof marker.marker.code === "string" ? marker.marker.code : marker.marker.code.value) ?? void 0 : void 0;
          const messageMatches = FilterOptions._messageFilter(this.filterOptions.textFilter.text, marker.marker.message) ?? void 0;
          const fileMatches = FilterOptions._messageFilter(this.filterOptions.textFilter.text, this.labelService.getUriLabel(marker.resource, { relative: true })) ?? void 0;
          const matched = sourceMatches || codeMatches || messageMatches || fileMatches;
          if (matched && !this.filterOptions.textFilter.negate || !matched && this.filterOptions.textFilter.negate) {
            items.push(new MarkerTableItem(marker, sourceMatches, codeMatches, messageMatches, fileMatches));
          }
          continue;
        }
        items.push(new MarkerTableItem(marker));
      }
    }
    this._itemCount = items.length;
    this.table.splice(0, Number.POSITIVE_INFINITY, items.sort((a, b) => {
      let result = MarkerSeverity.compare(a.marker.severity, b.marker.severity);
      if (result === 0) {
        result = compareMarkersByUri(a.marker, b.marker);
      }
      if (result === 0) {
        result = Range.compareRangesUsingStarts(a.marker, b.marker);
      }
      return result;
    }));
  }
  revealMarkers(activeResource, focus, lastSelectedRelativeTop) {
    if (activeResource) {
      const activeResourceIndex = this.resourceMarkers.indexOf(activeResource);
      if (activeResourceIndex !== -1) {
        if (this.hasSelectedMarkerFor(activeResource)) {
          const tableSelection = this.table.getSelection();
          this.table.reveal(tableSelection[0], lastSelectedRelativeTop);
          if (focus) {
            this.table.setFocus(tableSelection);
          }
        } else {
          this.table.reveal(activeResourceIndex, 0);
          if (focus) {
            this.table.setFocus([activeResourceIndex]);
            this.table.setSelection([activeResourceIndex]);
          }
        }
      }
    } else if (focus) {
      this.table.setSelection([]);
      this.table.focusFirst();
    }
  }
  setAriaLabel(label) {
    this.table.domNode.ariaLabel = label;
  }
  setMarkerSelection(selection, focus) {
    if (this.isVisible()) {
      if (selection && selection.length > 0) {
        this.table.setSelection(selection.map((m) => this.findMarkerIndex(m)));
        if (focus && focus.length > 0) {
          this.table.setFocus(focus.map((f) => this.findMarkerIndex(f)));
        } else {
          this.table.setFocus([this.findMarkerIndex(selection[0])]);
        }
        this.table.reveal(this.findMarkerIndex(selection[0]));
      } else if (this.getSelection().length === 0 && this.getVisibleItemCount() > 0) {
        this.table.setSelection([0]);
        this.table.setFocus([0]);
        this.table.reveal(0);
      }
    }
  }
  toggleVisibility(hide) {
    this.container.classList.toggle("hidden", hide);
  }
  update(resourceMarkers) {
    for (const resourceMarker of resourceMarkers) {
      const index = this.resourceMarkers.indexOf(resourceMarker);
      this.resourceMarkers.splice(index, 1, resourceMarker);
    }
    this.reset(this.resourceMarkers);
  }
  updateMarker(marker) {
    this.table.rerender();
  }
  findMarkerIndex(marker) {
    for (let index = 0; index < this.table.length; index++) {
      if (this.table.row(index).marker === marker.marker) {
        return index;
      }
    }
    return -1;
  }
  hasSelectedMarkerFor(resource) {
    const selectedElement = this.getSelection();
    if (selectedElement && selectedElement.length > 0) {
      if (selectedElement[0] instanceof Marker) {
        if (resource.has(selectedElement[0].marker.resource)) {
          return true;
        }
      }
    }
    return false;
  }
};
MarkersTable = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILabelService)
], MarkersTable);
export {
  MarkersTable
};
