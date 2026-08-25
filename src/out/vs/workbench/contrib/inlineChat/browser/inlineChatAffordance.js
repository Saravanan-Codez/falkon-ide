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
import { autorun, debouncedObservable, derived, observableSignalFromEvent, observableValue, runOnChange } from "../../../../base/common/observable.js";
import { observableCodeEditor } from "../../../../editor/browser/observableCodeEditor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { InlineChatConfigKeys, CTX_INLINE_CHAT_AFFORDANCE_VISIBLE } from "../common/inlineChat.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { InlineChatAffordanceWidget } from "./inlineChatAffordanceWidget.js";
import { CursorChangeReason } from "../../../../editor/common/cursorEvents.js";
import { IInlineChatSessionService } from "./inlineChatSessionService.js";
import { CodeActionController } from "../../../../editor/contrib/codeAction/browser/codeActionController.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
let InlineChatAffordance = class extends Disposable {
  #editor;
  #instantiationService;
  #selectionData = observableValue(this, void 0);
  constructor(editor, instantiationService, configurationService, chatEntiteldService, inlineChatSessionService, telemetryService, contextKeyService) {
    super();
    this.#editor = editor;
    this.#instantiationService = instantiationService;
    const editorObs = observableCodeEditor(this.#editor);
    const affordance = observableConfigValue(InlineChatConfigKeys.Affordance, "off", configurationService);
    const debouncedSelection = debouncedObservable(editorObs.cursorSelection, 500);
    const selectionData = this.#selectionData;
    const ctxAffordanceVisible = CTX_INLINE_CHAT_AFFORDANCE_VISIBLE.bindTo(contextKeyService);
    this._store.add({ dispose: () => ctxAffordanceVisible.reset() });
    let explicitSelection = false;
    let affordanceId;
    this._store.add(runOnChange(editorObs.selections, (value, _prev, events) => {
      explicitSelection = events.every((e) => e.reason === CursorChangeReason.Explicit);
      if (!value || value.length !== 1 || value[0].isEmpty() || !explicitSelection) {
        selectionData.set(void 0, void 0);
      }
    }));
    this._store.add(autorun((r) => {
      const value = debouncedSelection.read(r);
      if (!value || value.isEmpty() || !explicitSelection || this.#editor.getModel()?.getValueInRange(value).match(/^\s+$/)) {
        selectionData.set(void 0, void 0);
        affordanceId = void 0;
        return;
      }
      affordanceId = generateUuid();
      const mode = affordance.read(void 0);
      if (mode === "editor") {
        telemetryService.publicLog2("inlineChatAffordance/shown", { mode, id: affordanceId, commandId: "" });
      }
      selectionData.set(value, void 0);
    }));
    this._store.add(autorun((r) => {
      if (chatEntiteldService.sentimentObs.read(r).hidden) {
        selectionData.set(void 0, void 0);
      }
    }));
    const hasSessionObs = derived((r) => {
      observableSignalFromEvent(this, inlineChatSessionService.onDidChangeSessions).read(r);
      const model = editorObs.model.read(r);
      return model ? inlineChatSessionService.getSessionByTextModel(model.uri) !== void 0 : false;
    });
    this._store.add(autorun((r) => {
      if (hasSessionObs.read(r)) {
        selectionData.set(void 0, void 0);
      }
    }));
    this._store.add(this.#editor.onContextMenu(() => {
      selectionData.set(void 0, void 0);
    }));
    this._store.add(autorun((r) => {
      if (!editorObs.isFocused.read(r)) {
        selectionData.set(void 0, void 0);
      }
    }));
    this._store.add(autorun((r) => {
      const sel = selectionData.read(r);
      const mode = affordance.read(r);
      ctxAffordanceVisible.set(sel !== void 0 && mode === "editor");
    }));
    const editorAffordance = this.#instantiationService.createInstance(
      InlineChatAffordanceWidget,
      this.#editor,
      derived((r) => affordance.read(r) === "editor" ? selectionData.read(r) : void 0)
    );
    this._store.add(editorAffordance);
    this._store.add(editorAffordance.onDidRunAction((commandId) => {
      if (affordanceId) {
        telemetryService.publicLog2("inlineChatAffordance/selected", { mode: affordance.get(), id: affordanceId, commandId });
      }
    }));
    this._store.add(autorun((r) => {
      const mode = affordance.read(r);
      const hideWithSelection = mode === "editor";
      const controller = CodeActionController.get(this.#editor);
      if (controller) {
        controller.onlyLightBulbWithEmptySelection = hideWithSelection;
      }
    }));
  }
  dismiss() {
    this.#selectionData.set(void 0, void 0);
  }
};
InlineChatAffordance = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IChatEntitlementService),
  __decorateParam(4, IInlineChatSessionService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IContextKeyService)
], InlineChatAffordance);
export {
  InlineChatAffordance
};
