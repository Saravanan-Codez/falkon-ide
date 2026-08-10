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
import { $, append, reset } from "../../../../../base/browser/dom.js";
import { ActionsOrientation } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { BaseActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { ToolBar } from "../../../../../base/browser/ui/toolbar/toolbar.js";
import { Action, toAction } from "../../../../../base/common/actions.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { FileKind } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { AnimatedCounterWidget } from "../../../../browser/animatedCounterWidget.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../../browser/labels.js";
import { ChatConfiguration } from "../../common/constants.js";
import { getEditorOverrideForChatResource } from "./chatEditorAssociations.js";
import "../media/chatTurnPills.css";
const CHANGES_PILL_ACTION_ID = "chat.turnPills.changes";
const PREVIEW_PILL_ACTION_ID = "chat.turnPills.preview";
const TRANSPARENT_BUTTON_STYLES = {
  buttonBackground: void 0,
  buttonHoverBackground: void 0,
  buttonForeground: void 0,
  buttonSeparator: void 0,
  buttonSecondaryBackground: void 0,
  buttonSecondaryHoverBackground: void 0,
  buttonSecondaryForeground: void 0,
  buttonSecondaryBorder: void 0,
  buttonBorder: void 0
};
const EMPTY_DIFF_STATS = { files: 0, insertions: 0, deletions: 0 };
function previewKind(uri) {
  const path = uri.path.toLowerCase();
  if (path.endsWith(".md") || path.endsWith(".markdown")) {
    return "markdown";
  }
  return void 0;
}
function diffStatsEqual(a, b) {
  return a.files === b.files && a.insertions === b.insertions && a.deletions === b.deletions;
}
function previewFilesEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind || a[i].created !== b[i].created || !isEqual(a[i].uri, b[i].uri)) {
      return false;
    }
  }
  return true;
}
async function openChatTurnFile(file, openerService, configurationService) {
  await openerService.open(file.uri, {
    fromUserGesture: true,
    editorOptions: {
      override: getEditorOverrideForChatResource(file.uri, configurationService)
    }
  });
}
function isChatTurnStatusPillsEnabled(value) {
  return typeof value === "boolean" ? value : !!(value?.changes || value?.preview || value?.browser);
}
function observeTurnStatusPillsEnabled(configurationService) {
  const value = observableConfigValue(ChatConfiguration.TurnStatusPills, true, configurationService);
  return derived((reader) => isChatTurnStatusPillsEnabled(value.read(reader)));
}
class ChangesPillActionViewItem extends BaseActionViewItem {
  constructor(action, options, _statsObs, _instantiationService) {
    super(void 0, action, options);
    this._statsObs = _statsObs;
    this._instantiationService = _instantiationService;
  }
  render(container) {
    this.element = container;
    container.classList.add("chat-turn-pill-changes");
    const button = this._button = this._register(new Button(container, { secondary: true, small: true, ...defaultButtonStyles }));
    button.element.classList.add("monaco-text-button", "chat-turn-pill-changes-button");
    this._register(button.onDidClick(() => {
      if (this._action.enabled) {
        this.actionRunner.run(this._action, this._context);
      }
    }));
    this._filesLabel = $("span.chat-turn-pill-meta-label");
    reset(
      button.element,
      $(`span.chat-turn-pill-meta-icon${ThemeIcon.asCSSSelector(Codicon.diffMultiple)}`),
      this._filesLabel
    );
    this._register(this._instantiationService.createInstance(AnimatedCounterWidget, button.element, {
      prefix: "+",
      direction: "topToBottom",
      cssClassName: "chat-turn-pill-meta-added",
      count: derived(this, (reader) => this._statsObs.read(reader).insertions)
    }));
    this._register(this._instantiationService.createInstance(AnimatedCounterWidget, button.element, {
      prefix: "-",
      direction: "bottomToTop",
      cssClassName: "chat-turn-pill-meta-removed",
      count: derived(this, (reader) => this._statsObs.read(reader).deletions)
    }));
    this._register(autorun((reader) => {
      this._updateLabel(this._statsObs.read(reader));
    }));
  }
  _updateLabel(stats) {
    if (!this._button || !this._filesLabel) {
      return;
    }
    const { files, insertions, deletions } = stats;
    const filesLabel = files === 1 ? localize("chatTurnPills.changes.file", "{0} File", files) : localize("chatTurnPills.changes.files", "{0} Files", files);
    this._filesLabel.textContent = filesLabel;
    this._button.setTitle(localize("chatTurnPills.changes.tooltip", "View Current Turn Changes"));
    this._button.element.setAttribute("aria-label", localize("chatTurnPills.changes.ariaLabel", "View Current Turn Changes: {0}, +{1}, -{2}", filesLabel, insertions, deletions));
  }
  focus() {
    this._button?.focus();
  }
}
class PreviewPillActionViewItem extends BaseActionViewItem {
  constructor(action, options, _previewFilesObs, _resourceLabels, _openFile, _showAll) {
    super(void 0, action, options);
    this._previewFilesObs = _previewFilesObs;
    this._resourceLabels = _resourceLabels;
    this._openFile = _openFile;
    this._showAll = _showAll;
  }
  render(container) {
    this.element = container;
    container.classList.add("chat-turn-pill-preview");
    const primary = this._primary = this._register(new Button(container, { ...TRANSPARENT_BUTTON_STYLES }));
    primary.element.classList.add("chat-turn-pill-preview-primary");
    const label = this._register(this._resourceLabels.create(primary.element));
    this._register(primary.onDidClick(() => {
      const primaryFile = this._previewFilesObs.get().at(0);
      if (primaryFile) {
        this._openFile(primaryFile);
      }
    }));
    const separator = append(container, $(".chat-turn-pill-preview-separator"));
    const chevron = this._register(new Button(container, { ...TRANSPARENT_BUTTON_STYLES }));
    chevron.element.classList.add("chat-turn-pill-preview-chevron");
    append(chevron.element, $(`span${ThemeIcon.asCSSSelector(Codicon.chevronDown)}`));
    const moreLabel = localize("chatTurnPills.preview.more", "Show All Previewable Files");
    chevron.setTitle(moreLabel);
    chevron.setAriaLabel(moreLabel);
    this._register(chevron.onDidClick(() => this._showAll(chevron.element)));
    this._register(autorun((reader) => {
      const files = this._previewFilesObs.read(reader);
      const primaryFile = files.at(0);
      if (primaryFile) {
        label.setResource(
          { resource: primaryFile.uri, name: basename(primaryFile.uri) },
          { fileKind: FileKind.FILE }
        );
        const tooltip = localize("chatTurnPills.preview.tooltipOne", "Open Preview: {0}", basename(primaryFile.uri));
        primary.setTitle(tooltip);
        primary.setAriaLabel(tooltip);
      }
      const hasMultiple = files.length > 1;
      separator.classList.toggle("hidden", !hasMultiple);
      chevron.element.classList.toggle("hidden", !hasMultiple);
    }));
  }
  focus() {
    this._primary?.focus();
  }
}
let ChatTurnPillsWidget = class extends Disposable {
  constructor(_model, _contextMenuService, _instantiationService) {
    super();
    this._model = _model;
    this._contextMenuService = _contextMenuService;
    this._instantiationService = _instantiationService;
    this.element = $(".chat-turn-pills.show-file-icons.hidden");
    this._resourceLabels = this._register(this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
    this._changesAction = this._register(new Action(CHANGES_PILL_ACTION_ID, localize("chatTurnPills.changes.tooltip", "View Current Turn Changes"), void 0, true, async () => this._model.openChanges()));
    this._previewAction = this._register(new Action(PREVIEW_PILL_ACTION_ID, localize("chatTurnPills.preview.label", "Open Preview"), void 0, true, async () => this._openPrimaryFile()));
    this._toolbar = this._register(new ToolBar(this.element, this._contextMenuService, {
      orientation: ActionsOrientation.HORIZONTAL,
      ariaLabel: localize("chatTurnPills.ariaLabel", "Turn status"),
      actionViewItemProvider: (action, options) => {
        if (action.id === CHANGES_PILL_ACTION_ID) {
          return new ChangesPillActionViewItem(action, options, this._model.stats, this._instantiationService);
        }
        if (action.id === PREVIEW_PILL_ACTION_ID) {
          return new PreviewPillActionViewItem(action, options, this._model.previewFiles, this._resourceLabels, (file) => this._model.openFile(file), (anchor) => this._showAllFiles(anchor));
        }
        return void 0;
      }
    }));
    this.isVisible = derived(this, (reader) => this._showChanges(reader) || this._showPreview(reader));
    this._register(autorun((reader) => {
      this._updateVisibleActions(this._showChanges(reader), this._showPreview(reader));
    }));
  }
  _showChanges(reader) {
    return this._model.changesEnabled.read(reader) && this._model.stats.read(reader).files > 0;
  }
  _showPreview(reader) {
    return this._model.previewEnabled.read(reader) && this._model.previewFiles.read(reader).length > 0;
  }
  _updateVisibleActions(showChanges, showPreview) {
    const actions = [];
    if (showChanges) {
      actions.push(this._changesAction);
    }
    if (showPreview) {
      actions.push(this._previewAction);
    }
    const signature = actions.map((a) => a.id).join(",");
    if (signature !== this._visibleSignature) {
      this._visibleSignature = signature;
      this._toolbar.setActions(actions);
    }
    this.element.classList.toggle("hidden", actions.length === 0);
  }
  _openPrimaryFile() {
    const primaryFile = this._model.previewFiles.get().at(0);
    if (primaryFile) {
      this._model.openFile(primaryFile);
    }
  }
  _showAllFiles(anchor) {
    const files = this._model.previewFiles.get();
    if (files.length === 0) {
      return;
    }
    this._contextMenuService.showContextMenu({
      getAnchor: () => anchor,
      getActions: () => files.map((file) => toAction({
        id: `${PREVIEW_PILL_ACTION_ID}.${file.uri.toString()}`,
        label: basename(file.uri),
        class: ThemeIcon.asClassName(Codicon.goToFile),
        run: () => this._model.openFile(file)
      }))
    });
  }
};
ChatTurnPillsWidget = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IInstantiationService)
], ChatTurnPillsWidget);
export {
  ChatTurnPillsWidget,
  EMPTY_DIFF_STATS,
  diffStatsEqual,
  isChatTurnStatusPillsEnabled,
  observeTurnStatusPillsEnabled,
  openChatTurnFile,
  previewFilesEqual,
  previewKind
};
