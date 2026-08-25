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
import { isHTMLElement, ModifierKeyEmitter } from "../../../../base/browser/dom.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { disposableTimeout, RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { DynamicCssRules } from "../../../browser/editorDom.js";
import { StableEditorScrollState } from "../../../browser/stableEditorScroll.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { EDITOR_FONT_DEFAULTS } from "../../../common/config/fontInfo.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Range } from "../../../common/core/range.js";
import * as languages from "../../../common/languages.js";
import { InjectedTextCursorStops, TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationInjectedTextOptions } from "../../../common/model/textModel.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { ITextModelService } from "../../../common/services/resolverService.js";
import { ClickLinkGesture } from "../../gotoSymbol/browser/link/clickLinkGesture.js";
import { InlayHintAnchor, InlayHintsFragments } from "./inlayHints.js";
import { goToDefinitionWithLocation, showGoToContextMenu } from "./inlayHintsLocations.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import * as colors from "../../../../platform/theme/common/colorRegistry.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
class InlayHintsCache {
  constructor() {
    this._entries = new LRUCache(50);
  }
  get(model) {
    const key = InlayHintsCache._key(model);
    return this._entries.get(key);
  }
  set(model, value) {
    const key = InlayHintsCache._key(model);
    this._entries.set(key, value);
  }
  static _key(model) {
    return `${model.uri.toString()}/${model.getVersionId()}`;
  }
}
const IInlayHintsCache = createDecorator("IInlayHintsCache");
registerSingleton(IInlayHintsCache, InlayHintsCache, InstantiationType.Delayed);
class RenderedInlayHintLabelPart {
  constructor(item, index) {
    this.item = item;
    this.index = index;
  }
  get part() {
    const label = this.item.hint.label;
    if (typeof label === "string") {
      return { label };
    } else {
      return label[this.index];
    }
  }
}
class ActiveInlayHintInfo {
  constructor(part, hasTriggerModifier) {
    this.part = part;
    this.hasTriggerModifier = hasTriggerModifier;
  }
}
var RenderMode = /* @__PURE__ */ ((RenderMode2) => {
  RenderMode2[RenderMode2["Normal"] = 0] = "Normal";
  RenderMode2[RenderMode2["Invisible"] = 1] = "Invisible";
  return RenderMode2;
})(RenderMode || {});
class CancellationStore {
  constructor() {
    this._store = new MutableDisposable();
    this._tokenSource = new CancellationTokenSource();
  }
  dispose() {
    this._store.dispose();
    this._tokenSource.dispose(true);
  }
  reset() {
    this._tokenSource.dispose(true);
    this._tokenSource = new CancellationTokenSource();
    this._store.value = new DisposableStore();
    return {
      store: this._store.value,
      token: this._tokenSource.token
    };
  }
}
let InlayHintsController = class {
  constructor(_editor, _languageFeaturesService, _featureDebounce, _inlayHintsCache, _commandService, _notificationService, _instaService) {
    this._editor = _editor;
    this._languageFeaturesService = _languageFeaturesService;
    this._inlayHintsCache = _inlayHintsCache;
    this._commandService = _commandService;
    this._notificationService = _notificationService;
    this._instaService = _instaService;
    this._disposables = new DisposableStore();
    this._sessionDisposables = new DisposableStore();
    this._decorationsMetadata = /* @__PURE__ */ new Map();
    this._activeRenderMode = 0 /* Normal */;
    this._ruleFactory = this._disposables.add(new DynamicCssRules(this._editor));
    this._debounceInfo = _featureDebounce.for(_languageFeaturesService.inlayHintsProvider, "InlayHint", { min: 25 });
    this._disposables.add(_languageFeaturesService.inlayHintsProvider.onDidChange(() => this._update()));
    this._disposables.add(_editor.onDidChangeModel(() => this._update()));
    this._disposables.add(_editor.onDidChangeModelLanguage(() => this._update()));
    this._disposables.add(_editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.inlayHints)) {
        this._update();
      }
    }));
    this._update();
  }
  static {
    this.ID = "editor.contrib.InlayHints";
  }
  static {
    this._MAX_DECORATORS = 1500;
  }
  static {
    this._whitespaceData = {};
  }
  static get(editor) {
    return editor.getContribution(InlayHintsController.ID) ?? void 0;
  }
  dispose() {
    this._sessionDisposables.dispose();
    this._removeAllDecorations();
    this._disposables.dispose();
  }
  _update() {
    this._sessionDisposables.clear();
    this._removeAllDecorations();
    const options = this._editor.getOption(EditorOption.inlayHints);
    if (options.enabled === "off") {
      return;
    }
    const model = this._editor.getModel();
    if (!model || !this._languageFeaturesService.inlayHintsProvider.has(model)) {
      return;
    }
    if (options.enabled === "on") {
      this._activeRenderMode = 0 /* Normal */;
    } else {
      let defaultMode;
      let altMode;
      if (options.enabled === "onUnlessPressed") {
        defaultMode = 0 /* Normal */;
        altMode = 1 /* Invisible */;
      } else {
        defaultMode = 1 /* Invisible */;
        altMode = 0 /* Normal */;
      }
      this._activeRenderMode = defaultMode;
      this._sessionDisposables.add(ModifierKeyEmitter.getInstance().event((e) => {
        if (!this._editor.hasModel()) {
          return;
        }
        const newRenderMode = e.altKey && e.ctrlKey && !(e.shiftKey || e.metaKey) ? altMode : defaultMode;
        if (newRenderMode !== this._activeRenderMode) {
          this._activeRenderMode = newRenderMode;
          const model2 = this._editor.getModel();
          const copies = this._copyInlayHintsWithCurrentAnchor(model2);
          this._updateHintsDecorators([model2.getFullModelRange()], copies);
          scheduler.schedule(0);
        }
      }));
    }
    const cached = this._inlayHintsCache.get(model);
    if (cached) {
      this._updateHintsDecorators([model.getFullModelRange()], cached);
    }
    this._sessionDisposables.add(toDisposable(() => {
      if (!model.isDisposed()) {
        this._cacheHintsForFastRestore(model);
      }
    }));
    let cts;
    const watchedProviders = /* @__PURE__ */ new Set();
    this._sessionDisposables.add(model.onWillDispose(() => cts?.cancel()));
    const cancellationStore = this._sessionDisposables.add(new CancellationStore());
    const scheduler = new RunOnceScheduler(async () => {
      const t1 = Date.now();
      const { store, token } = cancellationStore.reset();
      try {
        const inlayHints = await InlayHintsFragments.create(this._languageFeaturesService.inlayHintsProvider, model, this._getHintsRanges(), token);
        scheduler.delay = this._debounceInfo.update(model, Date.now() - t1);
        if (token.isCancellationRequested) {
          inlayHints.dispose();
          return;
        }
        for (const provider of inlayHints.provider) {
          if (typeof provider.onDidChangeInlayHints === "function" && !watchedProviders.has(provider)) {
            watchedProviders.add(provider);
            store.add(provider.onDidChangeInlayHints(() => {
              if (!scheduler.isScheduled()) {
                scheduler.schedule();
              }
            }));
          }
        }
        store.add(inlayHints);
        store.add(toDisposable(() => watchedProviders.clear()));
        this._updateHintsDecorators(inlayHints.ranges, inlayHints.items);
        this._cacheHintsForFastRestore(model);
      } catch (err) {
        onUnexpectedError(err);
      }
    }, this._debounceInfo.get(model));
    this._sessionDisposables.add(scheduler);
    scheduler.schedule(0);
    this._sessionDisposables.add(this._editor.onDidScrollChange((e) => {
      if (e.scrollTopChanged || !scheduler.isScheduled()) {
        scheduler.schedule();
      }
    }));
    const cursor = this._sessionDisposables.add(new MutableDisposable());
    this._sessionDisposables.add(this._editor.onDidChangeModelContent((e) => {
      cts?.cancel();
      const delay = Math.max(scheduler.delay, 800);
      this._cursorInfo = { position: this._editor.getPosition(), notEarlierThan: Date.now() + delay };
      cursor.value = disposableTimeout(() => scheduler.schedule(0), delay);
      scheduler.schedule();
    }));
    this._sessionDisposables.add(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.inlayHints)) {
        scheduler.schedule();
      }
    }));
    this._sessionDisposables.add(this._installDblClickGesture(() => scheduler.schedule(0)));
    this._sessionDisposables.add(this._installLinkGesture());
    this._sessionDisposables.add(this._installContextMenu());
  }
  _installLinkGesture() {
    const store = new DisposableStore();
    const gesture = store.add(new ClickLinkGesture(this._editor));
    const sessionStore = new DisposableStore();
    store.add(sessionStore);
    store.add(gesture.onMouseMoveOrRelevantKeyDown((e) => {
      const [mouseEvent] = e;
      const labelPart = this._getInlayHintLabelPart(mouseEvent);
      const model = this._editor.getModel();
      if (!labelPart || !model) {
        sessionStore.clear();
        return;
      }
      const cts = new CancellationTokenSource();
      sessionStore.add(toDisposable(() => cts.dispose(true)));
      labelPart.item.resolve(cts.token);
      this._activeInlayHintPart = labelPart.part.command || labelPart.part.location ? new ActiveInlayHintInfo(labelPart, mouseEvent.hasTriggerModifier) : void 0;
      const lineNumber = model.validatePosition(labelPart.item.hint.position).lineNumber;
      const range = new Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
      const lineHints = this._getInlineHintsForRange(range);
      this._updateHintsDecorators([range], lineHints);
      sessionStore.add(toDisposable(() => {
        this._activeInlayHintPart = void 0;
        this._updateHintsDecorators([range], lineHints);
      }));
    }));
    store.add(gesture.onCancel(() => sessionStore.clear()));
    store.add(gesture.onExecute(async (e) => {
      const label = this._getInlayHintLabelPart(e);
      if (label) {
        const part = label.part;
        if (part.location) {
          this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor, part.location);
        } else if (languages.Command.is(part.command)) {
          await this._invokeCommand(part.command, label.item);
        }
      }
    }));
    return store;
  }
  _getInlineHintsForRange(range) {
    const lineHints = /* @__PURE__ */ new Set();
    for (const data of this._decorationsMetadata.values()) {
      if (range.containsRange(data.item.anchor.range)) {
        lineHints.add(data.item);
      }
    }
    return Array.from(lineHints);
  }
  _installDblClickGesture(updateInlayHints) {
    return this._editor.onMouseUp(async (e) => {
      if (e.event.detail !== 2) {
        return;
      }
      const part = this._getInlayHintLabelPart(e);
      if (!part) {
        return;
      }
      e.event.preventDefault();
      await part.item.resolve(CancellationToken.None);
      if (isNonEmptyArray(part.item.hint.textEdits)) {
        const edits = part.item.hint.textEdits.map((edit) => EditOperation.replace(Range.lift(edit.range), edit.text));
        this._editor.executeEdits("inlayHint.default", edits);
        updateInlayHints();
      }
    });
  }
  _installContextMenu() {
    return this._editor.onContextMenu(async (e) => {
      if (!isHTMLElement(e.event.target)) {
        return;
      }
      const part = this._getInlayHintLabelPart(e);
      if (part) {
        await this._instaService.invokeFunction(showGoToContextMenu, this._editor, e.event.target, part);
      }
    });
  }
  _getInlayHintLabelPart(e) {
    if (e.target.type !== MouseTargetType.CONTENT_TEXT) {
      return void 0;
    }
    const options = e.target.detail.injectedText?.options;
    if (options instanceof ModelDecorationInjectedTextOptions && options?.attachedData instanceof RenderedInlayHintLabelPart) {
      return options.attachedData;
    }
    return void 0;
  }
  async _invokeCommand(command, item) {
    try {
      await this._commandService.executeCommand(command.id, ...command.arguments ?? []);
    } catch (err) {
      this._notificationService.notify({
        severity: Severity.Error,
        source: item.provider.displayName,
        message: err
      });
    }
  }
  _cacheHintsForFastRestore(model) {
    const hints = this._copyInlayHintsWithCurrentAnchor(model);
    this._inlayHintsCache.set(model, hints);
  }
  // return inlay hints but with an anchor that reflects "updates"
  // that happened after receiving them, e.g adding new lines before a hint
  _copyInlayHintsWithCurrentAnchor(model) {
    const items = /* @__PURE__ */ new Map();
    for (const [id, obj] of this._decorationsMetadata) {
      if (items.has(obj.item)) {
        continue;
      }
      const range = model.getDecorationRange(id);
      if (range) {
        const anchor = new InlayHintAnchor(range, obj.item.anchor.direction);
        const copy = obj.item.with({ anchor });
        items.set(obj.item, copy);
      }
    }
    return Array.from(items.values());
  }
  _getHintsRanges() {
    const extra = 30;
    const model = this._editor.getModel();
    const visibleRanges = this._editor.getVisibleRangesPlusViewportAboveBelow();
    const result = [];
    for (const range of visibleRanges.sort(Range.compareRangesUsingStarts)) {
      const extendedRange = model.validateRange(new Range(range.startLineNumber - extra, range.startColumn, range.endLineNumber + extra, range.endColumn));
      if (result.length === 0 || !Range.areIntersectingOrTouching(result[result.length - 1], extendedRange)) {
        result.push(extendedRange);
      } else {
        result[result.length - 1] = Range.plusRange(result[result.length - 1], extendedRange);
      }
    }
    return result;
  }
  _updateHintsDecorators(ranges, items) {
    const itemFixedLengths = /* @__PURE__ */ new Map();
    if (this._cursorInfo && this._cursorInfo.notEarlierThan > Date.now() && ranges.some((range) => range.containsPosition(this._cursorInfo.position))) {
      const { position } = this._cursorInfo;
      this._cursorInfo = void 0;
      const lengths = /* @__PURE__ */ new Map();
      for (const deco of this._editor.getLineDecorations(position.lineNumber) ?? []) {
        const data = this._decorationsMetadata.get(deco.id);
        if (deco.range.startColumn > position.column) {
          continue;
        }
        const opts = data?.decoration.options[data.item.anchor.direction];
        if (opts && opts.attachedData !== InlayHintsController._whitespaceData) {
          const len = lengths.get(data.item) ?? 0;
          lengths.set(data.item, len + opts.content.length);
        }
      }
      const newItemsWithFixedLength = items.filter((item) => item.anchor.range.startLineNumber === position.lineNumber && item.anchor.range.endColumn <= position.column);
      const fixedLengths = Array.from(lengths.values());
      let lastItem;
      while (true) {
        const targetItem = newItemsWithFixedLength.shift();
        const fixedLength = fixedLengths.shift();
        if (!fixedLength && !targetItem) {
          break;
        }
        if (targetItem) {
          itemFixedLengths.set(targetItem, fixedLength ?? 0);
          lastItem = targetItem;
        } else if (lastItem && fixedLength) {
          let len = itemFixedLengths.get(lastItem);
          len += fixedLength;
          len += fixedLengths.reduce((p, c) => p + c, 0);
          fixedLengths.length = 0;
          break;
        }
      }
    }
    const newDecorationsData = [];
    const addInjectedText = (item, ref, content, cursorStops, attachedData) => {
      const opts = {
        content,
        inlineClassNameAffectsLetterSpacing: true,
        inlineClassName: ref.className,
        cursorStops,
        attachedData
      };
      newDecorationsData.push({
        item,
        classNameRef: ref,
        decoration: {
          range: item.anchor.range,
          options: {
            // className: "rangeHighlight", // DEBUG highlight to see to what range a hint is attached
            description: "InlayHint",
            showIfCollapsed: item.anchor.range.isEmpty(),
            // "original" range is empty
            collapseOnReplaceEdit: !item.anchor.range.isEmpty(),
            stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges,
            [item.anchor.direction]: this._activeRenderMode === 0 /* Normal */ ? opts : void 0
          }
        }
      });
    };
    const addInjectedWhitespace = (item, isLast) => {
      const marginRule = this._ruleFactory.createClassNameRef({
        width: `${fontSize / 3 | 0}px`,
        display: "inline-block"
      });
      addInjectedText(item, marginRule, "\u200A", isLast ? InjectedTextCursorStops.Right : InjectedTextCursorStops.None, InlayHintsController._whitespaceData);
    };
    const { fontSize, fontFamily, padding, isUniform } = this._getLayoutInfo();
    const maxLength = this._editor.getOption(EditorOption.inlayHints).maximumLength;
    const fontFamilyVar = "--code-editorInlayHintsFontFamily";
    this._editor.getContainerDomNode().style.setProperty(fontFamilyVar, fontFamily);
    let currentLineInfo = { line: 0, totalLen: 0 };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (currentLineInfo.line !== item.anchor.range.startLineNumber) {
        currentLineInfo = { line: item.anchor.range.startLineNumber, totalLen: 0 };
      }
      if (maxLength && currentLineInfo.totalLen > maxLength) {
        continue;
      }
      if (item.hint.paddingLeft) {
        addInjectedWhitespace(item, false);
      }
      const parts = typeof item.hint.label === "string" ? [{ label: item.hint.label }] : item.hint.label;
      const itemFixedLength = itemFixedLengths.get(item);
      let itemActualLength = 0;
      for (let i2 = 0; i2 < parts.length; i2++) {
        const part = parts[i2];
        const isFirst = i2 === 0;
        const isLast = i2 === parts.length - 1;
        const cssProperties = {
          fontSize: `${fontSize}px`,
          fontFamily: `var(${fontFamilyVar}), ${EDITOR_FONT_DEFAULTS.fontFamily}`,
          verticalAlign: isUniform ? "baseline" : "middle",
          unicodeBidi: "isolate"
        };
        if (isNonEmptyArray(item.hint.textEdits)) {
          cssProperties.cursor = "default";
        }
        this._fillInColors(cssProperties, item.hint);
        if ((part.command || part.location) && this._activeInlayHintPart?.part.item === item && this._activeInlayHintPart.part.index === i2) {
          cssProperties.textDecoration = "underline";
          if (this._activeInlayHintPart.hasTriggerModifier) {
            cssProperties.color = themeColorFromId(colors.editorActiveLinkForeground);
            cssProperties.cursor = "pointer";
          }
        }
        let textlabel = part.label;
        currentLineInfo.totalLen += textlabel.length;
        let tooLong = false;
        const over = maxLength !== 0 ? currentLineInfo.totalLen - maxLength : 0;
        if (over > 0) {
          textlabel = textlabel.slice(0, -over) + "\u2026";
          tooLong = true;
        }
        itemActualLength += textlabel.length;
        if (itemFixedLength !== void 0) {
          const overFixedLength = itemActualLength - itemFixedLength;
          if (overFixedLength >= 0) {
            itemActualLength -= overFixedLength;
            textlabel = textlabel.slice(0, -(1 + overFixedLength)) + "\u2026";
            tooLong = true;
          }
        }
        if (padding) {
          if (isFirst && (isLast || tooLong)) {
            cssProperties.padding = `1px ${Math.max(1, fontSize / 4) | 0}px`;
            cssProperties.borderRadius = `${fontSize / 4 | 0}px`;
          } else if (isFirst) {
            cssProperties.padding = `1px 0 1px ${Math.max(1, fontSize / 4) | 0}px`;
            cssProperties.borderRadius = `${fontSize / 4 | 0}px 0 0 ${fontSize / 4 | 0}px`;
          } else if (isLast || tooLong) {
            cssProperties.padding = `1px ${Math.max(1, fontSize / 4) | 0}px 1px 0`;
            cssProperties.borderRadius = `0 ${fontSize / 4 | 0}px ${fontSize / 4 | 0}px 0`;
          } else {
            cssProperties.padding = `1px 0 1px 0`;
          }
        }
        addInjectedText(
          item,
          this._ruleFactory.createClassNameRef(cssProperties),
          fixSpace(textlabel),
          isLast && !item.hint.paddingRight ? InjectedTextCursorStops.Right : InjectedTextCursorStops.None,
          new RenderedInlayHintLabelPart(item, i2)
        );
        if (tooLong) {
          break;
        }
      }
      if (itemFixedLength !== void 0 && itemActualLength < itemFixedLength) {
        const pad = itemFixedLength - itemActualLength;
        addInjectedText(
          item,
          this._ruleFactory.createClassNameRef({}),
          "\u200A".repeat(pad),
          InjectedTextCursorStops.None
        );
      }
      if (item.hint.paddingRight) {
        addInjectedWhitespace(item, true);
      }
      if (newDecorationsData.length > InlayHintsController._MAX_DECORATORS) {
        break;
      }
    }
    const decorationIdsToReplace = [];
    for (const [id, metadata] of this._decorationsMetadata) {
      const range = this._editor.getModel()?.getDecorationRange(id);
      if (range && ranges.some((r) => r.containsRange(range))) {
        decorationIdsToReplace.push(id);
        metadata.classNameRef.dispose();
        this._decorationsMetadata.delete(id);
      }
    }
    const scrollState = StableEditorScrollState.capture(this._editor);
    this._editor.changeDecorations((accessor) => {
      const newDecorationIds = accessor.deltaDecorations(decorationIdsToReplace, newDecorationsData.map((d) => d.decoration));
      for (let i = 0; i < newDecorationIds.length; i++) {
        const data = newDecorationsData[i];
        this._decorationsMetadata.set(newDecorationIds[i], data);
      }
    });
    scrollState.restore(this._editor);
  }
  _fillInColors(props, hint) {
    if (hint.kind === languages.InlayHintKind.Parameter) {
      props.backgroundColor = themeColorFromId(colors.editorInlayHintParameterBackground);
      props.color = themeColorFromId(colors.editorInlayHintParameterForeground);
    } else if (hint.kind === languages.InlayHintKind.Type) {
      props.backgroundColor = themeColorFromId(colors.editorInlayHintTypeBackground);
      props.color = themeColorFromId(colors.editorInlayHintTypeForeground);
    } else {
      props.backgroundColor = themeColorFromId(colors.editorInlayHintBackground);
      props.color = themeColorFromId(colors.editorInlayHintForeground);
    }
  }
  _getLayoutInfo() {
    const options = this._editor.getOption(EditorOption.inlayHints);
    const padding = options.padding;
    const editorFontSize = this._editor.getOption(EditorOption.fontSize);
    const editorFontFamily = this._editor.getOption(EditorOption.fontFamily);
    let fontSize = options.fontSize;
    if (!fontSize || fontSize < 5 || fontSize > editorFontSize) {
      fontSize = editorFontSize;
    }
    const fontFamily = options.fontFamily || editorFontFamily;
    const isUniform = !padding && fontFamily === editorFontFamily && fontSize === editorFontSize;
    return { fontSize, fontFamily, padding, isUniform };
  }
  _removeAllDecorations() {
    this._editor.removeDecorations(Array.from(this._decorationsMetadata.keys()));
    for (const obj of this._decorationsMetadata.values()) {
      obj.classNameRef.dispose();
    }
    this._decorationsMetadata.clear();
  }
  // --- accessibility
  getInlayHintsForLine(line) {
    if (!this._editor.hasModel()) {
      return [];
    }
    const set = /* @__PURE__ */ new Set();
    const result = [];
    for (const deco of this._editor.getLineDecorations(line)) {
      const data = this._decorationsMetadata.get(deco.id);
      if (data && !set.has(data.item.hint)) {
        set.add(data.item.hint);
        result.push(data.item);
      }
    }
    return result;
  }
};
InlayHintsController = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, ILanguageFeatureDebounceService),
  __decorateParam(3, IInlayHintsCache),
  __decorateParam(4, ICommandService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IInstantiationService)
], InlayHintsController);
function fixSpace(str) {
  const noBreakWhitespace = "\xA0";
  return str.replace(/[ \t]/g, noBreakWhitespace);
}
CommandsRegistry.registerCommand("_executeInlayHintProvider", async (accessor, ...args) => {
  const [uri, range] = args;
  assertType(URI.isUri(uri));
  assertType(Range.isIRange(range));
  const { inlayHintsProvider } = accessor.get(ILanguageFeaturesService);
  const ref = await accessor.get(ITextModelService).createModelReference(uri);
  try {
    const model = await InlayHintsFragments.create(inlayHintsProvider, ref.object.textEditorModel, [Range.lift(range)], CancellationToken.None);
    const result = model.items.map((i) => i.hint);
    setTimeout(() => model.dispose(), 0);
    return result;
  } finally {
    ref.dispose();
  }
});
export {
  InlayHintsController,
  RenderedInlayHintLabelPart
};
