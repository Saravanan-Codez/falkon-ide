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
import "./media/sessionChangesEditor.css";
import { $, append, Dimension } from "../../../../base/browser/dom.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derivedObservableWithCache, observableValue } from "../../../../base/common/observable.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { AbstractEditorWithViewState } from "../../../../workbench/browser/parts/editor/editorWithViewState.js";
import { ResourceLabel } from "../../../../workbench/browser/labels.js";
import { ChatContextKeys } from "../../../../workbench/contrib/chat/common/actions/chatContextKeys.js";
import { IEditorGroupsService } from "../../../../workbench/services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { MultiDiffEditorWidget } from "../../../../editor/browser/widget/multiDiffEditor/multiDiffEditorWidget.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { MultiDiffEditorItemLabelKind } from "../../../../editor/browser/widget/multiDiffEditor/workbenchUIElementFactory.js";
import { Menus } from "../../../browser/menus.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { ActiveSessionContextKeys } from "../common/changes.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { ChangesActionsBar } from "./changesView.js";
import { SessionChangesEditorInput } from "./sessionChangesEditorInput.js";
import { ISessionChangesService } from "./sessionChangesService.js";
import { isEqual } from "../../../../base/common/resources.js";
import { MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { CheckboxActionViewItem } from "../../../../base/browser/ui/toggle/toggle.js";
import { defaultCheckboxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { localize } from "../../../../nls.js";
import { getChangesEditorFileStats } from "./changesEditorLabels.js";
const HEADER_HEIGHT = 35;
const CHANGES_DIFF_EDITOR_OPTIONS = {
  hideOriginalLineNumbers: true,
  folding: false,
  lineNumbersMinChars: 3
};
let SessionChangesUIElementFactory = class {
  constructor(changesObs, commandService, changesViewService, instantiationService) {
    this.changesObs = changesObs;
    this.commandService = commandService;
    this.changesViewService = changesViewService;
    this.instantiationService = instantiationService;
    this.headerClickToCollapse = true;
  }
  createResourceLabel(element, kind) {
    const label = this.instantiationService.createInstance(ResourceLabel, element, {});
    const showDiffStats = kind === MultiDiffEditorItemLabelKind.Primary;
    return new SessionChangesResourceLabel(label, element, showDiffStats, this.changesObs);
  }
  handleHeaderMiddleClick(resource) {
    if (this.changesViewService.activeSessionChangesetObs.get()?.capabilities?.review !== true) {
      return false;
    }
    if (!getChangesEditorFileStats(resource, this.changesViewService.activeSessionChangesObs.get())) {
      return false;
    }
    void this.commandService.executeCommand(CHANGESET_REVIEW_ACTION_ID, resource);
    return true;
  }
  createToolbarActionViewItem(action, options) {
    if (action.id === CHANGESET_REVIEW_ACTION_ID && action instanceof MenuItemAction) {
      return this.instantiationService.createInstance(ChangesetReviewActionViewItem, action, options);
    }
    return void 0;
  }
};
SessionChangesUIElementFactory = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IChangesViewService),
  __decorateParam(3, IInstantiationService)
], SessionChangesUIElementFactory);
class SessionChangesResourceLabel extends Disposable {
  constructor(label, element, showDiffStats, changesObs) {
    super();
    this.label = label;
    this.resource = observableValue(this, void 0);
    this._register(label);
    if (showDiffStats) {
      const statsContainer = append(element, $(".session-changes-file-stats"));
      const added = append(statsContainer, $(".working-set-lines-added"));
      const removed = append(statsContainer, $(".working-set-lines-removed"));
      added.setAttribute("aria-hidden", "true");
      removed.setAttribute("aria-hidden", "true");
      this._register(autorun((reader) => {
        const resource = this.resource.read(reader);
        const stats = resource ? getChangesEditorFileStats(resource, changesObs.read(reader)) : void 0;
        statsContainer.style.display = stats ? "" : "none";
        if (stats) {
          added.textContent = `+${stats.insertions}`;
          removed.textContent = `-${stats.deletions}`;
          statsContainer.setAttribute("aria-label", localize("sessionChangesEditor.fileCounts", "{0} lines added, {1} lines removed", stats.insertions, stats.deletions));
        } else {
          added.textContent = "";
          removed.textContent = "";
          statsContainer.removeAttribute("aria-label");
        }
      }));
    }
  }
  setUri(uri, options = {}) {
    if (!uri) {
      this.label.element.clear();
    } else {
      this.label.element.setFile(uri, { strikethrough: options.strikethrough });
    }
    this.resource.set(uri, void 0);
  }
}
let SessionChangesEditor = class extends AbstractEditorWithViewState {
  constructor(group, telemetryService, themeService, storageService, instantiationService, textResourceConfigurationService, editorService, editorGroupService, contextKeyService, changesViewService, configurationService, layoutService, sessionChangesService) {
    super(
      SessionChangesEditor.ID,
      group,
      "sessionChangesEditorViewState",
      telemetryService,
      instantiationService,
      storageService,
      textResourceConfigurationService,
      themeService,
      editorService,
      editorGroupService
    );
    this.contextKeyService = contextKeyService;
    this.changesViewService = changesViewService;
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.sessionChangesService = sessionChangesService;
    this._singlePane = false;
    /** Session whose changes this editor is currently showing (from its input). */
    this._inputSessionResource = observableValue(this, void 0);
    /**
     * Changes for this editor's own session, scoped so a stale row does not pick
     * up the counts of a different (globally active) session during a switch.
     */
    this._scopedChangesObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const editorSession = this._inputSessionResource.read(reader);
      const activeSession = this.changesViewService.activeSessionResourceObs.read(reader);
      if (!editorSession || !activeSession || !isEqual(editorSession, activeSession)) {
        return lastValue ?? [];
      }
      return this.changesViewService.activeSessionChangesObs.read(reader);
    });
    /** Deferred focus request awaiting the active diff editor to be rendered. */
    this._pendingFocus = this._register(new MutableDisposable());
  }
  static {
    this.ID = SessionChangesEditorInput.EDITOR_ID;
  }
  createEditor(parent) {
    const root = append(parent, $(".session-changes-editor"));
    const scopedContextKeyService = this._register(this.contextKeyService.createScoped(root));
    this._register(bindContextKey(ActiveSessionContextKeys.HasGitRepository, scopedContextKeyService, (reader) => this.changesViewService.activeSessionHasGitRepositoryObs.read(reader)));
    this._register(bindContextKey(ChatContextKeys.hasAgentSessionChanges, scopedContextKeyService, (reader) => this.changesViewService.activeSessionChangesObs.read(reader).length > 0));
    const scopedInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([IContextKeyService, scopedContextKeyService])
    ));
    this._scopedInstantiationService = scopedInstantiationService;
    this._singlePane = this.layoutService.isSinglePaneLayoutEnabled;
    if (!this._singlePane) {
      const header = append(root, $(".session-changes-editor-header"));
      const left = append(header, $(".session-changes-editor-header-left"));
      const right = append(header, $(".session-changes-editor-header-right"));
      this._register(this._buildHeaderToolbars(left, right, scopedInstantiationService));
    }
    this.bodyContainer = append(root, $(".session-changes-editor-body"));
    const paneInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([IContextKeyService, this.contextKeyService])
    ));
    this.widget = this._register(paneInstantiationService.createInstance(
      MultiDiffEditorWidget,
      this.bodyContainer,
      paneInstantiationService.createInstance(SessionChangesUIElementFactory, this._scopedChangesObs),
      CHANGES_DIFF_EDITOR_OPTIONS
    ));
    this._applyRenderSideBySide();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("diffEditor.renderSideBySide")) {
        this._applyRenderSideBySide();
      }
    }));
  }
  _applyRenderSideBySide() {
    this.widget?.setRenderSideBySide(this.configurationService.getValue("diffEditor.renderSideBySide") ?? true);
  }
  /**
   * Resolves the diff editor and code editor showing the given file, mirroring
   * {@link MultiDiffEditor.tryGetCodeEditor} so file-toolbar actions can operate
   * on this editor and the plain multi-diff editor uniformly.
   */
  tryGetCodeEditor(resource) {
    return this.widget?.tryGetCodeEditor(resource);
  }
  /** Creates the classic (non-single-pane) internal header toolbars. */
  _buildHeaderToolbars(left, right, instantiationService) {
    const store = new DisposableStore();
    store.add(instantiationService.createInstance(MenuWorkbenchToolBar, left, Menus.SessionsEditorHeaderPrimary, {
      menuOptions: { shouldForwardArgs: true }
    }));
    store.add(instantiationService.createInstance(ChangesActionsBar, right));
    return store;
  }
  get scopedInstantiationService() {
    return this._singlePane ? this._scopedInstantiationService : void 0;
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this._inputSessionResource.set(this.sessionChangesService.getSessionResource(input.multiDiffSource), void 0);
    const viewModel = await input.getViewModel();
    if (token.isCancellationRequested) {
      return;
    }
    this.viewModel = viewModel;
    const viewState = this.loadEditorViewState(input, context);
    this.widget?.setViewModel(viewModel, { preserveFocus: options?.preserveFocus, viewState });
    this._applyOptions(options);
  }
  setEditorVisible(visible) {
    if (!visible) {
      this._pendingFocus.clear();
      this.saveCurrentEditorViewState();
    }
    super.setEditorVisible(visible);
  }
  computeEditorViewState(_resource) {
    if (!this.viewModel) {
      return void 0;
    }
    return this.widget?.getViewState();
  }
  tracksEditorViewState(input) {
    return input instanceof SessionChangesEditorInput;
  }
  tracksDisposedEditorViewState() {
    return true;
  }
  toEditorViewStateResource(input) {
    return input instanceof SessionChangesEditorInput ? input.multiDiffSource : void 0;
  }
  collapseAllDiffs() {
    this.viewModel?.collapseAll();
  }
  expandAllDiffs() {
    this.viewModel?.expandAll();
  }
  collapse(resource) {
    const item = this.viewModel?.items.read(void 0).find((i) => isEqual(i.modifiedUri, resource) || isEqual(i.originalUri, resource));
    if (!item) {
      return;
    }
    this.viewModel?.collapse(item);
  }
  expand(resource) {
    const item = this.viewModel?.items.read(void 0).find((i) => isEqual(i.modifiedUri, resource) || isEqual(i.originalUri, resource));
    if (!item) {
      return;
    }
    this.viewModel?.expand(item);
  }
  setOptions(options) {
    this._applyOptions(options);
  }
  _applyOptions(options) {
    const revealData = options?.viewState?.revealData;
    if (!revealData) {
      return;
    }
    this.widget?.reveal(revealData.resource, {
      range: revealData.range ? Range.lift(revealData.range) : void 0,
      highlight: true
    });
  }
  clearInput() {
    const input = this.input;
    this._pendingFocus.clear();
    super.clearInput();
    this.viewModel = void 0;
    this.widget?.setViewModel(void 0);
    if (input instanceof SessionChangesEditorInput) {
      input.clear();
    }
  }
  focus() {
    super.focus();
    this._pendingFocus.clear();
    const widget = this.widget;
    if (!widget) {
      return;
    }
    const control = widget.getActiveControl();
    if (control) {
      control.focus();
      return;
    }
    this._pendingFocus.value = widget.onDidChangeActiveControl(() => {
      const activeControl = widget.getActiveControl();
      if (activeControl) {
        this._pendingFocus.clear();
        activeControl.focus();
      }
    });
  }
  layout(dimension) {
    const bodyHeight = this._singlePane ? dimension.height : Math.max(0, dimension.height - HEADER_HEIGHT);
    this.widget?.layout(new Dimension(dimension.width, bodyHeight));
  }
};
SessionChangesEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ITextResourceConfigurationService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IChangesViewService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IAgentWorkbenchLayoutService),
  __decorateParam(12, ISessionChangesService)
], SessionChangesEditor);
const CHANGESET_REVIEW_ACTION_ID = "changeset.review";
class ChangesetReviewActionViewItem extends CheckboxActionViewItem {
  constructor(action, options) {
    super(void 0, action, { ...options, label: true, checkboxStyles: { ...defaultCheckboxStyles, size: 14 } });
  }
  render(container) {
    super.render(container);
    container.classList.add("changeset-review-action");
  }
  updateChecked() {
    super.updateChecked();
    this.updateAriaLabel();
    this.updateTooltip();
  }
  getTooltip() {
    return this.action.checked ? localize("changeset.viewed.tooltip", "Mark as Not Viewed") : localize("changeset.notViewed.tooltip", "Mark as Viewed");
  }
}
export {
  CHANGESET_REVIEW_ACTION_ID,
  SessionChangesEditor
};
