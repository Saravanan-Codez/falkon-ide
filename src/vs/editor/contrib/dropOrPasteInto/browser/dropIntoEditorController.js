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
import { coalesce } from "../../../../base/common/arrays.js";
import { createCancelablePromise, raceCancellation } from "../../../../base/common/async.js";
import { VSDataTransfer } from "../../../../base/common/dataTransfer.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { toExternalVSDataTransfer } from "../../../browser/dataTransfer.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { DraggedTreeItemsIdentifier } from "../../../common/services/treeViewsDnd.js";
import { ITreeViewsDnDService } from "../../../common/services/treeViewsDndService.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { InlineProgressManager } from "../../inlineProgress/browser/inlineProgress.js";
import { sortEditsByYieldTo } from "./edit.js";
import { PostEditWidgetManager } from "./postEditWidget.js";
const dropAsPreferenceConfig = "editor.dropIntoEditor.preferences";
const changeDropTypeCommandId = "editor.changeDropType";
const dropWidgetVisibleCtx = new RawContextKey("dropWidgetVisible", false, localize("dropWidgetVisible", "Whether the drop widget is showing"));
let DropIntoEditorController = class extends Disposable {
  constructor(editor, instantiationService, _configService, _languageFeaturesService, _treeViewsDragAndDropService) {
    super();
    this._configService = _configService;
    this._languageFeaturesService = _languageFeaturesService;
    this._treeViewsDragAndDropService = _treeViewsDragAndDropService;
    this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
    this._dropProgressManager = this._register(instantiationService.createInstance(InlineProgressManager, "dropIntoEditor", editor));
    this._postDropWidgetManager = this._register(instantiationService.createInstance(
      PostEditWidgetManager,
      "dropIntoEditor",
      editor,
      dropWidgetVisibleCtx,
      { id: changeDropTypeCommandId, label: localize("postDropWidgetTitle", "Show drop options...") },
      () => DropIntoEditorController._configureDefaultAction ? [DropIntoEditorController._configureDefaultAction] : []
    ));
    this._register(editor.onDropIntoEditor((e) => this.onDropIntoEditor(editor, e.position, e.event)));
  }
  static {
    this.ID = "editor.contrib.dropIntoEditorController";
  }
  static get(editor) {
    return editor.getContribution(DropIntoEditorController.ID);
  }
  static setConfigureDefaultAction(action) {
    this._configureDefaultAction = action;
  }
  clearWidgets() {
    this._postDropWidgetManager.clear();
  }
  changeDropType() {
    this._postDropWidgetManager.tryShowSelector();
  }
  async onDropIntoEditor(editor, position, dragEvent) {
    if (!dragEvent.dataTransfer || !editor.hasModel()) {
      return;
    }
    DropIntoEditorController._currentDropOperation?.cancel();
    editor.focus();
    editor.setPosition(position);
    const p = createCancelablePromise(async (token) => {
      const disposables = new DisposableStore();
      const tokenSource = disposables.add(new EditorStateCancellationTokenSource(editor, CodeEditorStateFlag.Value, void 0, token));
      try {
        const ourDataTransfer = await this.extractDataTransferData(dragEvent);
        if (ourDataTransfer.size === 0 || tokenSource.token.isCancellationRequested) {
          return;
        }
        const model = editor.getModel();
        if (!model) {
          return;
        }
        const providers = this._languageFeaturesService.documentDropEditProvider.ordered(model).filter((provider) => {
          if (!provider.dropMimeTypes) {
            return true;
          }
          return provider.dropMimeTypes.some((mime) => ourDataTransfer.matches(mime));
        });
        const editSession = disposables.add(await this.getDropEdits(providers, model, position, ourDataTransfer, tokenSource.token));
        if (tokenSource.token.isCancellationRequested) {
          return;
        }
        if (editSession.edits.length) {
          const activeEditIndex = this.getInitialActiveEditIndex(model, editSession.edits);
          const canShowWidget = editor.getOption(EditorOption.dropIntoEditor).showDropSelector === "afterDrop";
          await this._postDropWidgetManager.applyEditAndShowIfNeeded([Range.fromPositions(position)], { activeEditIndex, allEdits: editSession.edits }, canShowWidget, async (edit) => edit, token);
        }
      } finally {
        disposables.dispose();
        if (DropIntoEditorController._currentDropOperation === p) {
          DropIntoEditorController._currentDropOperation = void 0;
        }
      }
    });
    this._dropProgressManager.showWhile(position, localize("dropIntoEditorProgress", "Running drop handlers. Click to cancel"), p, { cancel: () => p.cancel() });
    DropIntoEditorController._currentDropOperation = p;
  }
  async getDropEdits(providers, model, position, dataTransfer, token) {
    const disposables = new DisposableStore();
    const results = await raceCancellation(Promise.all(providers.map(async (provider) => {
      try {
        const edits2 = await provider.provideDocumentDropEdits(model, position, dataTransfer, token);
        if (edits2) {
          disposables.add(edits2);
        }
        return edits2?.edits.map((edit) => ({ ...edit, providerId: provider.id }));
      } catch (err) {
        if (!isCancellationError(err)) {
          console.error(err);
        }
        console.error(err);
      }
      return void 0;
    })), token);
    const edits = coalesce(results ?? []).flat();
    return {
      edits: sortEditsByYieldTo(edits),
      dispose: () => disposables.dispose()
    };
  }
  getInitialActiveEditIndex(model, edits) {
    const preferredProviders = this._configService.getValue(dropAsPreferenceConfig, { resource: model.uri });
    for (const config of Array.isArray(preferredProviders) ? preferredProviders : []) {
      const desiredKind = new HierarchicalKind(config);
      const editIndex = edits.findIndex((edit) => edit.kind && desiredKind.contains(edit.kind));
      if (editIndex >= 0) {
        return editIndex;
      }
    }
    return 0;
  }
  async extractDataTransferData(dragEvent) {
    if (!dragEvent.dataTransfer) {
      return new VSDataTransfer();
    }
    const dataTransfer = toExternalVSDataTransfer(dragEvent.dataTransfer);
    if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
      const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
      if (Array.isArray(data)) {
        for (const id of data) {
          const treeDataTransfer = await this._treeViewsDragAndDropService.removeDragOperationTransfer(id.identifier);
          if (treeDataTransfer) {
            for (const [type, value] of treeDataTransfer) {
              dataTransfer.replace(type, value);
            }
          }
        }
      }
    }
    return dataTransfer;
  }
};
DropIntoEditorController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ITreeViewsDnDService)
], DropIntoEditorController);
export {
  DropIntoEditorController,
  changeDropTypeCommandId,
  dropAsPreferenceConfig,
  dropWidgetVisibleCtx
};
