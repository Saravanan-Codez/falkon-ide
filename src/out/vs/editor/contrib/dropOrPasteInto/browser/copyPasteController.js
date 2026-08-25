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
import { createCancelablePromise, DeferredPromise, raceCancellation } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { createStringDataTransferItem, matchesMimeType, UriList, VSDataTransfer } from "../../../../base/common/dataTransfer.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../base/common/mime.js";
import { upcast } from "../../../../base/common/types.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IBulkEditService } from "../../../browser/services/bulkEditService.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Handler } from "../../../common/editorCommon.js";
import { DocumentPasteTriggerKind } from "../../../common/languages.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { CodeEditorStateFlag, EditorStateCancellationTokenSource } from "../../editorState/browser/editorState.js";
import { InlineProgressManager } from "../../inlineProgress/browser/inlineProgress.js";
import { MessageController } from "../../message/browser/messageController.js";
import { DefaultTextPasteOrDropEditProvider } from "./defaultProviders.js";
import { createCombinedWorkspaceEdit, sortEditsByYieldTo } from "./edit.js";
import { PostEditWidgetManager } from "./postEditWidget.js";
const changePasteTypeCommandId = "editor.changePasteType";
const pasteAsPreferenceConfig = "editor.pasteAs.preferences";
const pasteWidgetVisibleCtx = new RawContextKey("pasteWidgetVisible", false, localize("pasteWidgetVisible", "Whether the paste widget is showing"));
const vscodeClipboardMime = "application/vnd.code.copymetadata";
let CopyPasteController = class extends Disposable {
  constructor(editor, instantiationService, _logService, _bulkEditService, _clipboardService, _commandService, _configService, _languageFeaturesService, _quickInputService, _progressService) {
    super();
    this._logService = _logService;
    this._bulkEditService = _bulkEditService;
    this._clipboardService = _clipboardService;
    this._commandService = _commandService;
    this._configService = _configService;
    this._languageFeaturesService = _languageFeaturesService;
    this._quickInputService = _quickInputService;
    this._progressService = _progressService;
    this._editor = editor;
    this._register(editor.onWillCopy((e) => this.handleCopy(e)));
    this._register(editor.onWillCut((e) => this.handleCopy(e)));
    this._register(editor.onWillPaste((e) => this.handlePaste(e)));
    this._pasteProgressManager = this._register(new InlineProgressManager("pasteIntoEditor", editor, instantiationService));
    this._postPasteWidgetManager = this._register(instantiationService.createInstance(
      PostEditWidgetManager,
      "pasteIntoEditor",
      editor,
      pasteWidgetVisibleCtx,
      { id: changePasteTypeCommandId, label: localize("postPasteWidgetTitle", "Show paste options...") },
      () => CopyPasteController._configureDefaultAction ? [CopyPasteController._configureDefaultAction] : []
    ));
  }
  static {
    this.ID = "editor.contrib.copyPasteActionController";
  }
  static get(editor) {
    return editor.getContribution(CopyPasteController.ID);
  }
  static setConfigureDefaultAction(action) {
    CopyPasteController._configureDefaultAction = action;
  }
  changePasteType() {
    this._postPasteWidgetManager.tryShowSelector();
  }
  async pasteAs(preferred) {
    this._logService.trace("CopyPasteController.pasteAs");
    this._editor.focus();
    try {
      this._logService.trace("Before calling editor.action.clipboardPasteAction");
      this._pasteAsActionContext = { preferred };
      await this._commandService.executeCommand("editor.action.clipboardPasteAction");
    } finally {
      this._pasteAsActionContext = void 0;
    }
  }
  clearWidgets() {
    this._postPasteWidgetManager.clear();
  }
  isPasteAsEnabled() {
    return this._editor.getOption(EditorOption.pasteAs).enabled;
  }
  async finishedPaste() {
    await this._currentPasteOperation;
  }
  handleCopy(e) {
    this._logService.trace("CopyPasteController#handleCopy");
    if (!this._editor.hasTextFocus()) {
      return;
    }
    this._clipboardService.clearInternalState?.();
    if (!this.isPasteAsEnabled()) {
      return;
    }
    const model = this._editor.getModel();
    const viewModel = this._editor._getViewModel();
    const selections = this._editor.getSelections();
    if (!model || !viewModel || !selections?.length) {
      return;
    }
    const defaultPastePayload = {
      multicursorText: e.dataToCopy.multicursorText ?? null,
      pasteOnNewLine: e.dataToCopy.isFromEmptySelection,
      mode: null
    };
    const providers = this._languageFeaturesService.documentPasteEditProvider.ordered(model).filter((x) => !!x.prepareDocumentPaste);
    if (!providers.length) {
      this.setCopyMetadata(e.clipboardData, { defaultPastePayload });
      return;
    }
    const dataTransfer = new VSDataTransfer();
    const providerCopyMimeTypes = providers.flatMap((x) => x.copyMimeTypes ?? []);
    const handle = generateUuid();
    this.setCopyMetadata(e.clipboardData, {
      id: handle,
      providerCopyMimeTypes,
      defaultPastePayload
    });
    const operations = providers.map((provider) => {
      return {
        providerMimeTypes: provider.copyMimeTypes,
        operation: createCancelablePromise((token) => provider.prepareDocumentPaste(model, e.dataToCopy.sourceRanges, dataTransfer, token).catch((err) => {
          console.error(err);
          return void 0;
        }))
      };
    });
    CopyPasteController._currentCopyOperation?.operations.forEach((entry) => entry.operation.cancel());
    CopyPasteController._currentCopyOperation = { handle, operations };
  }
  async handlePaste(e) {
    this._logService.trace("CopyPasteController#handlePaste for id : ", e.metadata?.id);
    if (!this._editor.hasTextFocus()) {
      return;
    }
    const dataTransfer = e.toExternalVSDataTransfer();
    if (!dataTransfer) {
      return;
    }
    dataTransfer.delete(vscodeClipboardMime);
    MessageController.get(this._editor)?.closeMessage();
    this._currentPasteOperation?.cancel();
    this._currentPasteOperation = void 0;
    const model = this._editor.getModel();
    const selections = this._editor.getSelections();
    if (!selections?.length || !model) {
      return;
    }
    if (this._editor.getOption(EditorOption.readOnly) || !this.isPasteAsEnabled() && !this._pasteAsActionContext) {
      return;
    }
    const metadata = this.fetchCopyMetadata(e);
    this._logService.trace("CopyPasteController#handlePaste with metadata : ", metadata?.id, " and text.length : ", e.clipboardData.getData("text/plain").length);
    const fileTypes = Array.from(e.clipboardData.files).map((file) => file.type);
    const allPotentialMimeTypes = [
      ...e.clipboardData.types,
      ...fileTypes,
      ...metadata?.providerCopyMimeTypes ?? [],
      // TODO: always adds `uri-list` because this get set if there are resources in the system clipboard.
      // However we can only check the system clipboard async. For this early check, just add it in.
      // We filter providers again once we have the final dataTransfer we will use.
      Mimes.uriList
    ];
    const allProviders = this._languageFeaturesService.documentPasteEditProvider.ordered(model).filter((provider) => {
      const preference = this._pasteAsActionContext?.preferred;
      if (preference) {
        if (!this.providerMatchesPreference(provider, preference)) {
          return false;
        }
      }
      return provider.pasteMimeTypes?.some((type) => matchesMimeType(type, allPotentialMimeTypes));
    });
    if (!allProviders.length) {
      if (this._pasteAsActionContext?.preferred) {
        this.showPasteAsNoEditMessage(selections, this._pasteAsActionContext.preferred);
        e.setHandled();
      }
      return;
    }
    e.setHandled();
    if (this._pasteAsActionContext) {
      this.showPasteAsPick(this._pasteAsActionContext.preferred, allProviders, selections, dataTransfer, metadata);
    } else {
      this.doPasteInline(allProviders, selections, dataTransfer, metadata, e.browserEvent);
    }
  }
  showPasteAsNoEditMessage(selections, preference) {
    const kindLabel = "only" in preference ? preference.only.value : "preferences" in preference ? preference.preferences.length ? preference.preferences.map((preference2) => preference2.value).join(", ") : localize("noPreferences", "empty") : preference.providerId;
    MessageController.get(this._editor)?.showMessage(localize("pasteAsError", "No paste edits for '{0}' found", kindLabel), selections[0].getStartPosition());
  }
  doPasteInline(allProviders, selections, dataTransfer, metadata, clipboardEvent) {
    this._logService.trace("CopyPasteController#doPasteInline");
    const editor = this._editor;
    if (!editor.hasModel()) {
      return;
    }
    const editorStateCts = new EditorStateCancellationTokenSource(editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Selection, void 0);
    const p = createCancelablePromise(async (pToken) => {
      const editor2 = this._editor;
      if (!editor2.hasModel()) {
        return;
      }
      const model = editor2.getModel();
      const disposables = new DisposableStore();
      const cts = disposables.add(new CancellationTokenSource(pToken));
      disposables.add(editorStateCts.token.onCancellationRequested(() => cts.cancel()));
      const token = cts.token;
      try {
        await this.mergeInDataFromCopy(allProviders, dataTransfer, metadata, token);
        if (token.isCancellationRequested) {
          return;
        }
        const supportedProviders = allProviders.filter((provider) => this.isSupportedPasteProvider(provider, dataTransfer));
        if (!supportedProviders.length || supportedProviders.length === 1 && supportedProviders[0] instanceof DefaultTextPasteOrDropEditProvider) {
          return this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
        }
        const context = {
          triggerKind: DocumentPasteTriggerKind.Automatic
        };
        const editSession = await this.getPasteEdits(supportedProviders, dataTransfer, model, selections, context, token);
        disposables.add(editSession);
        if (token.isCancellationRequested) {
          return;
        }
        if (editSession.edits.length === 1 && editSession.edits[0].provider instanceof DefaultTextPasteOrDropEditProvider) {
          return this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
        }
        if (editSession.edits.length) {
          const canShowWidget = editor2.getOption(EditorOption.pasteAs).showPasteSelector === "afterPaste";
          return this._postPasteWidgetManager.applyEditAndShowIfNeeded(selections, { activeEditIndex: this.getInitialActiveEditIndex(model, editSession.edits), allEdits: editSession.edits }, canShowWidget, async (edit, resolveToken) => {
            if (!edit.provider.resolveDocumentPasteEdit) {
              return edit;
            }
            const resolveP = edit.provider.resolveDocumentPasteEdit(edit, resolveToken);
            const showP = new DeferredPromise();
            const resolved = await this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize("resolveProcess", "Resolving paste edit for '{0}'. Click to cancel", edit.title), raceCancellation(Promise.race([showP.p, resolveP]), resolveToken), {
              cancel: () => showP.cancel()
            }, 0);
            if (resolved) {
              edit.insertText = resolved.insertText;
              edit.additionalEdit = resolved.additionalEdit;
            }
            return edit;
          }, token);
        }
        await this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
      } finally {
        disposables.dispose();
        if (this._currentPasteOperation === p) {
          this._currentPasteOperation = void 0;
        }
      }
    });
    this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize("pasteIntoEditorProgress", "Running paste handlers. Click to cancel and do basic paste"), p, {
      cancel: async () => {
        p.cancel();
        if (editorStateCts.token.isCancellationRequested) {
          return;
        }
        await this.applyDefaultPasteHandler(dataTransfer, metadata, editorStateCts.token, clipboardEvent);
      }
    }).finally(() => {
      editorStateCts.dispose();
    });
    this._currentPasteOperation = p;
  }
  showPasteAsPick(preference, allProviders, selections, dataTransfer, metadata) {
    this._logService.trace("CopyPasteController#showPasteAsPick");
    const p = createCancelablePromise(async (token) => {
      const editor = this._editor;
      if (!editor.hasModel()) {
        return;
      }
      const model = editor.getModel();
      const disposables = new DisposableStore();
      const tokenSource = disposables.add(new EditorStateCancellationTokenSource(editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Selection, void 0, token));
      try {
        await this.mergeInDataFromCopy(allProviders, dataTransfer, metadata, tokenSource.token);
        if (tokenSource.token.isCancellationRequested) {
          return;
        }
        let supportedProviders = allProviders.filter((provider) => this.isSupportedPasteProvider(provider, dataTransfer, preference));
        if (preference) {
          supportedProviders = supportedProviders.filter((provider) => this.providerMatchesPreference(provider, preference));
        }
        const context = {
          triggerKind: DocumentPasteTriggerKind.PasteAs,
          only: preference && "only" in preference ? preference.only : void 0
        };
        let editSession = disposables.add(await this.getPasteEdits(supportedProviders, dataTransfer, model, selections, context, tokenSource.token));
        if (tokenSource.token.isCancellationRequested) {
          return;
        }
        if (preference) {
          editSession = {
            edits: editSession.edits.filter((edit) => {
              if ("only" in preference) {
                return preference.only.contains(edit.kind);
              } else if ("preferences" in preference) {
                return preference.preferences.some((preference2) => preference2.contains(edit.kind));
              } else {
                return preference.providerId === edit.provider.id;
              }
            }),
            dispose: editSession.dispose
          };
        }
        if (!editSession.edits.length) {
          if (preference) {
            this.showPasteAsNoEditMessage(selections, preference);
          }
          return;
        }
        let pickedEdit;
        if (preference) {
          pickedEdit = editSession.edits.at(0);
        } else {
          const configureDefaultItem = {
            id: "editor.pasteAs.default",
            label: localize("pasteAsDefault", "Configure default paste action"),
            edit: void 0
          };
          const selected = await this._quickInputService.pick(
            [
              ...editSession.edits.map((edit) => ({
                label: edit.title,
                description: edit.kind?.value,
                edit
              })),
              ...CopyPasteController._configureDefaultAction ? [
                upcast({ type: "separator" }),
                {
                  label: CopyPasteController._configureDefaultAction.label,
                  edit: void 0
                }
              ] : []
            ],
            {
              placeHolder: localize("pasteAsPickerPlaceholder", "Select Paste Action")
            }
          );
          if (selected === configureDefaultItem) {
            CopyPasteController._configureDefaultAction?.run();
            return;
          }
          pickedEdit = selected?.edit;
        }
        if (!pickedEdit) {
          return;
        }
        const combinedWorkspaceEdit = createCombinedWorkspaceEdit(model.uri, selections, pickedEdit);
        await this._bulkEditService.apply(combinedWorkspaceEdit, { editor: this._editor });
      } finally {
        disposables.dispose();
        if (this._currentPasteOperation === p) {
          this._currentPasteOperation = void 0;
        }
      }
    });
    this._progressService.withProgress({
      location: ProgressLocation.Window,
      title: localize("pasteAsProgress", "Running paste handlers")
    }, () => p);
  }
  setCopyMetadata(clipboardData, metadata) {
    this._logService.trace("CopyPasteController#setCopyMetadata new id : ", metadata.id);
    clipboardData.setData(vscodeClipboardMime, JSON.stringify(metadata));
  }
  fetchCopyMetadata(e) {
    this._logService.trace("CopyPasteController#fetchCopyMetadata");
    const rawMetadata = e.clipboardData.getData(vscodeClipboardMime);
    if (rawMetadata) {
      try {
        return JSON.parse(rawMetadata);
      } catch {
        return void 0;
      }
    }
    if (e.metadata) {
      return {
        defaultPastePayload: {
          mode: e.metadata.mode,
          multicursorText: e.metadata.multicursorText ?? null,
          pasteOnNewLine: !!e.metadata.isFromEmptySelection
        }
      };
    }
    return void 0;
  }
  async mergeInDataFromCopy(allProviders, dataTransfer, metadata, token) {
    this._logService.trace("CopyPasteController#mergeInDataFromCopy with metadata : ", metadata?.id);
    if (metadata?.id && CopyPasteController._currentCopyOperation?.handle === metadata.id) {
      const toResolve = CopyPasteController._currentCopyOperation.operations.filter((op) => allProviders.some((provider) => provider.pasteMimeTypes.some((type) => matchesMimeType(type, op.providerMimeTypes)))).map((op) => op.operation);
      const toMergeResults = await Promise.all(toResolve);
      if (token.isCancellationRequested) {
        return;
      }
      for (const toMergeData of toMergeResults.reverse()) {
        if (toMergeData) {
          for (const [key, value] of toMergeData) {
            dataTransfer.replace(key, value);
          }
        }
      }
    }
    if (!dataTransfer.has(Mimes.uriList)) {
      const resources = await this._clipboardService.readResources();
      if (token.isCancellationRequested) {
        return;
      }
      if (resources.length) {
        dataTransfer.append(Mimes.uriList, createStringDataTransferItem(UriList.create(resources)));
      }
    }
  }
  async getPasteEdits(providers, dataTransfer, model, selections, context, token) {
    const disposables = new DisposableStore();
    const results = await raceCancellation(
      Promise.all(providers.map(async (provider) => {
        try {
          const edits2 = await provider.provideDocumentPasteEdits?.(model, selections, dataTransfer, context, token);
          if (edits2) {
            disposables.add(edits2);
          }
          return edits2?.edits?.map((edit) => ({ ...edit, provider }));
        } catch (err) {
          if (!isCancellationError(err)) {
            console.error(err);
          }
          return void 0;
        }
      })),
      token
    );
    const edits = coalesce(results ?? []).flat().filter((edit) => {
      return !context.only || context.only.contains(edit.kind);
    });
    return {
      edits: sortEditsByYieldTo(edits),
      dispose: () => disposables.dispose()
    };
  }
  async applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent) {
    const textDataTransfer = dataTransfer.get(Mimes.text) ?? dataTransfer.get("text");
    const text = await textDataTransfer?.asString() ?? "";
    if (token.isCancellationRequested) {
      return;
    }
    const payload = {
      clipboardEvent,
      text,
      pasteOnNewLine: metadata?.defaultPastePayload.pasteOnNewLine ?? false,
      multicursorText: metadata?.defaultPastePayload.multicursorText ?? null,
      mode: null
    };
    this._logService.trace("CopyPasteController#applyDefaultPasteHandler for id : ", metadata?.id);
    this._editor.trigger("keyboard", Handler.Paste, payload);
  }
  /**
   * Filter out providers if they:
   * - Don't handle any of the data transfer types we have
   * - Don't match the preferred paste kind
   */
  isSupportedPasteProvider(provider, dataTransfer, preference) {
    if (!provider.pasteMimeTypes?.some((type) => dataTransfer.matches(type))) {
      return false;
    }
    return !preference || this.providerMatchesPreference(provider, preference);
  }
  providerMatchesPreference(provider, preference) {
    if ("only" in preference) {
      return provider.providedPasteEditKinds.some((providedKind) => preference.only.contains(providedKind));
    } else if ("preferences" in preference) {
      return provider.providedPasteEditKinds.some((providedKind) => preference.preferences.some((preferredKind) => preferredKind.contains(providedKind)));
    } else {
      return provider.id === preference.providerId;
    }
  }
  getInitialActiveEditIndex(model, edits) {
    const preferredProviders = this._configService.getValue(pasteAsPreferenceConfig, { resource: model.uri });
    for (const config of Array.isArray(preferredProviders) ? preferredProviders : []) {
      const desiredKind = new HierarchicalKind(config);
      const editIndex = edits.findIndex((edit) => desiredKind.contains(edit.kind));
      if (editIndex >= 0) {
        return editIndex;
      }
    }
    return 0;
  }
};
CopyPasteController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IBulkEditService),
  __decorateParam(4, IClipboardService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILanguageFeaturesService),
  __decorateParam(8, IQuickInputService),
  __decorateParam(9, IProgressService)
], CopyPasteController);
export {
  CopyPasteController,
  changePasteTypeCommandId,
  pasteAsPreferenceConfig,
  pasteWidgetVisibleCtx
};
