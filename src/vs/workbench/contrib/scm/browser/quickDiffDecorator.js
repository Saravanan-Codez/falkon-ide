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
import * as nls from "../../../../nls.js";
import "./media/dirtydiffDecorator.css";
import { Disposable, DisposableStore, DisposableMap } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { OverviewRulerLane, MinimapPosition } from "../../../../editor/common/model.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ChangeType, getChangeType, IQuickDiffService, minimapGutterAddedBackground, minimapGutterDeletedBackground, minimapGutterModifiedBackground, overviewRulerAddedForeground, overviewRulerDeletedForeground, overviewRulerModifiedForeground } from "../common/quickDiff.js";
import { IQuickDiffModelService } from "./quickDiffModel.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ContextKeyTrueExpr, ContextKeyFalseExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { autorun, observableFromEvent } from "../../../../base/common/observable.js";
import { registerAction2, Action2, MenuId } from "../../../../platform/actions/common/actions.js";
const quickDiffDecorationCount = new RawContextKey("quickDiffDecorationCount", 0);
let QuickDiffDecorator = class extends Disposable {
  constructor(codeEditor, quickDiffModelRef, configurationService, quickDiffService) {
    super();
    this.codeEditor = codeEditor;
    this.quickDiffModelRef = quickDiffModelRef;
    this.configurationService = configurationService;
    this.quickDiffService = quickDiffService;
    const decorations = configurationService.getValue("scm.diffDecorations");
    const gutter = decorations === "all" || decorations === "gutter";
    const overview = decorations === "all" || decorations === "overview";
    const minimap = decorations === "all" || decorations === "minimap";
    const diffAdded = nls.localize("diffAdded", "Added lines");
    const diffAddedOptions = {
      gutter,
      overview: { active: overview, color: overviewRulerAddedForeground },
      minimap: { active: minimap, color: minimapGutterAddedBackground },
      isWholeLine: true
    };
    this.addedOptions = QuickDiffDecorator.createDecoration("dirty-diff-added primary", diffAdded, diffAddedOptions);
    this.addedPatternOptions = QuickDiffDecorator.createDecoration("dirty-diff-added primary pattern", diffAdded, diffAddedOptions);
    this.addedSecondaryOptions = QuickDiffDecorator.createDecoration("dirty-diff-added secondary", diffAdded, diffAddedOptions);
    this.addedSecondaryPatternOptions = QuickDiffDecorator.createDecoration("dirty-diff-added secondary pattern", diffAdded, diffAddedOptions);
    const diffModified = nls.localize("diffModified", "Changed lines");
    const diffModifiedOptions = {
      gutter,
      overview: { active: overview, color: overviewRulerModifiedForeground },
      minimap: { active: minimap, color: minimapGutterModifiedBackground },
      isWholeLine: true
    };
    this.modifiedOptions = QuickDiffDecorator.createDecoration("dirty-diff-modified primary", diffModified, diffModifiedOptions);
    this.modifiedPatternOptions = QuickDiffDecorator.createDecoration("dirty-diff-modified primary pattern", diffModified, diffModifiedOptions);
    this.modifiedSecondaryOptions = QuickDiffDecorator.createDecoration("dirty-diff-modified secondary", diffModified, diffModifiedOptions);
    this.modifiedSecondaryPatternOptions = QuickDiffDecorator.createDecoration("dirty-diff-modified secondary pattern", diffModified, diffModifiedOptions);
    const diffDeleted = nls.localize("diffDeleted", "Removed lines");
    const diffDeletedOptions = {
      gutter,
      overview: { active: overview, color: overviewRulerDeletedForeground },
      minimap: { active: minimap, color: minimapGutterDeletedBackground },
      isWholeLine: false
    };
    this.deletedOptions = QuickDiffDecorator.createDecoration("dirty-diff-deleted primary", diffDeleted, diffDeletedOptions);
    this.deletedSecondaryOptions = QuickDiffDecorator.createDecoration("dirty-diff-deleted secondary", diffDeleted, diffDeletedOptions);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("scm.diffDecorationsGutterPattern")) {
        this.onDidChange();
      }
    }));
    this._register(Event.runAndSubscribe(this.quickDiffModelRef.object.onDidChange, () => this.onDidChange()));
  }
  static createDecoration(className, tooltip, options) {
    const decorationOptions = {
      description: "dirty-diff-decoration",
      isWholeLine: options.isWholeLine
    };
    if (options.gutter) {
      decorationOptions.linesDecorationsClassName = `dirty-diff-glyph ${className}`;
      decorationOptions.linesDecorationsTooltip = tooltip;
    }
    if (options.overview.active) {
      decorationOptions.overviewRuler = {
        color: themeColorFromId(options.overview.color),
        position: OverviewRulerLane.Left
      };
    }
    if (options.minimap.active) {
      decorationOptions.minimap = {
        color: themeColorFromId(options.minimap.color),
        position: MinimapPosition.Gutter
      };
    }
    return ModelDecorationOptions.createDynamic(decorationOptions);
  }
  onDidChange() {
    if (!this.codeEditor.hasModel()) {
      return;
    }
    const pattern = this.configurationService.getValue("scm.diffDecorationsGutterPattern");
    const primaryQuickDiff = this.quickDiffModelRef.object.quickDiffs.find((quickDiff) => quickDiff.kind === "primary");
    const primaryQuickDiffChanges = this.quickDiffModelRef.object.changes.filter((change) => change.providerId === primaryQuickDiff?.id);
    const decorations = [];
    for (const change of this.quickDiffModelRef.object.changes) {
      const quickDiff = this.quickDiffModelRef.object.quickDiffs.find((quickDiff2) => quickDiff2.id === change.providerId);
      if (!quickDiff || !this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id)) {
        continue;
      }
      if (quickDiff.kind !== "primary" && primaryQuickDiffChanges.some((c) => c.change2.modified.intersectsOrTouches(change.change2.modified))) {
        continue;
      }
      const changeType = getChangeType(change.change);
      const startLineNumber = change.change.modifiedStartLineNumber;
      const endLineNumber = change.change.modifiedEndLineNumber || startLineNumber;
      switch (changeType) {
        case ChangeType.Add:
          decorations.push({
            range: {
              startLineNumber,
              startColumn: 1,
              endLineNumber,
              endColumn: 1
            },
            options: quickDiff.kind === "primary" || quickDiff.kind === "contributed" ? pattern.added ? this.addedPatternOptions : this.addedOptions : pattern.added ? this.addedSecondaryPatternOptions : this.addedSecondaryOptions
          });
          break;
        case ChangeType.Delete:
          decorations.push({
            range: {
              startLineNumber,
              startColumn: Number.MAX_VALUE,
              endLineNumber: startLineNumber,
              endColumn: Number.MAX_VALUE
            },
            options: quickDiff.kind === "primary" || quickDiff.kind === "contributed" ? this.deletedOptions : this.deletedSecondaryOptions
          });
          break;
        case ChangeType.Modify:
          decorations.push({
            range: {
              startLineNumber,
              startColumn: 1,
              endLineNumber,
              endColumn: 1
            },
            options: quickDiff.kind === "primary" || quickDiff.kind === "contributed" ? pattern.modified ? this.modifiedPatternOptions : this.modifiedOptions : pattern.modified ? this.modifiedSecondaryPatternOptions : this.modifiedSecondaryOptions
          });
          break;
      }
    }
    if (!this.decorationsCollection) {
      this.decorationsCollection = this.codeEditor.createDecorationsCollection(decorations);
    } else {
      this.decorationsCollection.set(decorations);
    }
  }
  dispose() {
    if (this.decorationsCollection) {
      this.decorationsCollection.clear();
    }
    this.decorationsCollection = void 0;
    this.quickDiffModelRef.dispose();
    super.dispose();
  }
};
QuickDiffDecorator = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickDiffService)
], QuickDiffDecorator);
let QuickDiffWorkbenchController = class extends Disposable {
  constructor(editorService, configurationService, quickDiffModelService, quickDiffService, uriIdentityService, contextKeyService) {
    super();
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.quickDiffModelService = quickDiffModelService;
    this.quickDiffService = quickDiffService;
    this.uriIdentityService = uriIdentityService;
    this.enabled = false;
    // Resource URI -> Code Editor Id -> Decoration (Disposable)
    this.decorators = new ResourceMap();
    this.viewState = { width: 3, visibility: "always" };
    this.transientDisposables = this._register(new DisposableStore());
    this.stylesheet = domStylesheetsJs.createStyleSheet(void 0, void 0, this._store);
    this.quickDiffDecorationCount = quickDiffDecorationCount.bindTo(contextKeyService);
    this.activeEditor = observableFromEvent(
      this,
      this.editorService.onDidActiveEditorChange,
      () => this.editorService.activeEditor
    );
    this.quickDiffProviders = observableFromEvent(
      this,
      this.quickDiffService.onDidChangeQuickDiffProviders,
      () => this.quickDiffService.providers
    );
    const onDidChangeConfiguration = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorations"));
    this._register(onDidChangeConfiguration(this.onDidChangeConfiguration, this));
    this.onDidChangeConfiguration();
    const onDidChangeDiffWidthConfiguration = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorationsGutterWidth"));
    this._register(onDidChangeDiffWidthConfiguration(this.onDidChangeDiffWidthConfiguration, this));
    this.onDidChangeDiffWidthConfiguration();
    const onDidChangeDiffVisibilityConfiguration = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorationsGutterVisibility"));
    this._register(onDidChangeDiffVisibilityConfiguration(this.onDidChangeDiffVisibilityConfiguration, this));
    this.onDidChangeDiffVisibilityConfiguration();
  }
  onDidChangeConfiguration() {
    const enabled = this.configurationService.getValue("scm.diffDecorations") !== "none";
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
  onDidChangeDiffWidthConfiguration() {
    let width = this.configurationService.getValue("scm.diffDecorationsGutterWidth");
    if (isNaN(width) || width <= 0 || width > 5) {
      width = 3;
    }
    this.setViewState({ ...this.viewState, width });
  }
  onDidChangeDiffVisibilityConfiguration() {
    const visibility = this.configurationService.getValue("scm.diffDecorationsGutterVisibility");
    this.setViewState({ ...this.viewState, visibility });
  }
  setViewState(state) {
    this.viewState = state;
    this.stylesheet.textContent = `
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-modified {
				border-left-width:${state.width}px;
			}
			.monaco-editor .dirty-diff-added.pattern,
			.monaco-editor .dirty-diff-added.pattern:before,
			.monaco-editor .dirty-diff-modified.pattern,
			.monaco-editor .dirty-diff-modified.pattern:before {
				background-size: ${state.width}px ${state.width}px;
			}
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-modified,
			.monaco-editor .dirty-diff-deleted {
				opacity: ${state.visibility === "always" ? 1 : 0};
			}
		`;
  }
  enable() {
    if (this.enabled) {
      this.disable();
    }
    this.transientDisposables.add(Event.any(this.editorService.onDidCloseEditor, this.editorService.onDidVisibleEditorsChange)(() => this.onEditorsChanged()));
    this.onEditorsChanged();
    this.onDidActiveEditorChange();
    this.onDidChangeQuickDiffProviders();
    this.enabled = true;
  }
  disable() {
    if (!this.enabled) {
      return;
    }
    this.transientDisposables.clear();
    this.quickDiffDecorationCount.set(0);
    for (const [uri, decoratorMap] of this.decorators.entries()) {
      decoratorMap.dispose();
      this.decorators.delete(uri);
    }
    this.enabled = false;
  }
  onDidActiveEditorChange() {
    this.transientDisposables.add(autorun((reader) => {
      const activeEditor = this.activeEditor.read(reader);
      const activeTextEditorControl = this.editorService.activeTextEditorControl;
      if (!isCodeEditor(activeTextEditorControl) || !activeEditor?.resource) {
        this.quickDiffDecorationCount.set(0);
        return;
      }
      const quickDiffModelRef = this.quickDiffModelService.createQuickDiffModelReference(activeEditor.resource);
      if (!quickDiffModelRef) {
        this.quickDiffDecorationCount.set(0);
        return;
      }
      reader.store.add(quickDiffModelRef);
      const visibleDecorationCount = observableFromEvent(
        this,
        quickDiffModelRef.object.onDidChange,
        () => {
          const visibleQuickDiffs = quickDiffModelRef.object.quickDiffs.filter((quickDiff) => this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id));
          return quickDiffModelRef.object.changes.filter((change) => visibleQuickDiffs.some((quickDiff) => quickDiff.id === change.providerId)).length;
        }
      );
      reader.store.add(autorun((reader2) => {
        const count = visibleDecorationCount.read(reader2);
        this.quickDiffDecorationCount.set(count);
      }));
    }));
  }
  onDidChangeQuickDiffProviders() {
    this.transientDisposables.add(autorun((reader) => {
      const providers = this.quickDiffProviders.read(reader);
      const labels = [];
      for (let index = 0; index < providers.length; index++) {
        const provider = providers[index];
        if (labels.includes(provider.label)) {
          continue;
        }
        const visible = this.quickDiffService.isQuickDiffProviderVisible(provider.id);
        const group = provider.kind !== "contributed" ? "0_scm" : "1_contributed";
        const order = index + 1;
        reader.store.add(registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.scm.action.toggleQuickDiffVisibility.${provider.id}`,
              title: provider.label,
              toggled: visible ? ContextKeyTrueExpr.INSTANCE : ContextKeyFalseExpr.INSTANCE,
              menu: {
                id: MenuId.SCMQuickDiffDecorations,
                group,
                order
              },
              f1: false
            });
          }
          run(accessor) {
            const quickDiffService = accessor.get(IQuickDiffService);
            quickDiffService.toggleQuickDiffProviderVisibility(provider.id);
          }
        }));
        labels.push(provider.label);
      }
    }));
  }
  onEditorsChanged() {
    for (const editor of this.editorService.visibleTextEditorControls) {
      if (!isCodeEditor(editor)) {
        continue;
      }
      const textModel = editor.getModel();
      if (!textModel) {
        continue;
      }
      const editorId = editor.getId();
      if (this.decorators.get(textModel.uri)?.has(editorId)) {
        continue;
      }
      const quickDiffModelRef = this.quickDiffModelService.createQuickDiffModelReference(textModel.uri);
      if (!quickDiffModelRef) {
        continue;
      }
      if (!this.decorators.has(textModel.uri)) {
        this.decorators.set(textModel.uri, new DisposableMap());
      }
      this.decorators.get(textModel.uri).set(editorId, new QuickDiffDecorator(editor, quickDiffModelRef, this.configurationService, this.quickDiffService));
    }
    for (const [uri, decoratorMap] of this.decorators.entries()) {
      for (const editorId of decoratorMap.keys()) {
        const codeEditor = this.editorService.visibleTextEditorControls.find((editor) => isCodeEditor(editor) && editor.getId() === editorId && this.uriIdentityService.extUri.isEqual(editor.getModel()?.uri, uri));
        if (!codeEditor) {
          decoratorMap.deleteAndDispose(editorId);
        }
      }
      if (decoratorMap.size === 0) {
        decoratorMap.dispose();
        this.decorators.delete(uri);
      }
    }
  }
  dispose() {
    this.disable();
    super.dispose();
  }
};
QuickDiffWorkbenchController = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IQuickDiffModelService),
  __decorateParam(3, IQuickDiffService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IContextKeyService)
], QuickDiffWorkbenchController);
export {
  QuickDiffWorkbenchController,
  quickDiffDecorationCount
};
