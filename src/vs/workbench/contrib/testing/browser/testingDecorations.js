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
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { renderAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { Action, Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { equals } from "../../../../base/common/arrays.js";
import { mapFindFirst } from "../../../../base/common/arraysFind.js";
import { RunOnceScheduler, Throttler, timeout } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { clamp } from "../../../../base/common/numbers.js";
import { autorun } from "../../../../base/common/observable.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { count, truncateMiddle } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Constants } from "../../../../base/common/uint.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ContentWidgetPositionPreference, MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { overviewRulerError, overviewRulerInfo } from "../../../../editor/common/core/editorColorRegistry.js";
import { Position } from "../../../../editor/common/core/position.js";
import { GlyphMarginLane, OverviewRulerLane, TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { localize } from "../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditorLineNumberContextMenu, GutterActionsRegistry } from "../../codeEditor/browser/editorLineNumberMenu.js";
import { DefaultGutterClickAction, TestingConfigKeys, getTestingConfiguration } from "../common/configuration.js";
import { TestCommandId, Testing, labelForTestInState } from "../common/constants.js";
import { TestId } from "../common/testId.js";
import { ITestProfileService } from "../common/testProfileService.js";
import { LiveTestResult, TestResultItemChangeReason } from "../common/testResult.js";
import { ITestResultService } from "../common/testResultService.js";
import { ITestService, getContextForTestItem, simplifyTestsToExecute, testsInFile } from "../common/testService.js";
import { TestDiffOpType, TestMessageType, TestResultState, TestRunProfileBitset } from "../common/testTypes.js";
import { ITestingDecorationsService, TestDecorations } from "../common/testingDecorations.js";
import { ITestingPeekOpener } from "../common/testingPeekOpener.js";
import { isFailedState, maxPriority } from "../common/testingStates.js";
import { TestUriType, buildTestUri, parseTestUri } from "../common/testingUri.js";
import { getTestItemContextOverlay } from "./explorerProjections/testItemContextOverlay.js";
import { testingDebugAllIcon, testingDebugIcon, testingRunAllIcon, testingRunIcon, testingStatesToIcons } from "./icons.js";
import { renderTestMessageAsText } from "./testMessageColorizer.js";
import { MessageSubject } from "./testResultsView/testResultsSubject.js";
import { TestingOutputPeekController } from "./testingOutputPeek.js";
const MAX_INLINE_MESSAGE_LENGTH = 128;
const MAX_TESTS_IN_SUBMENU = 30;
const GLYPH_MARGIN_LANE = GlyphMarginLane.Center;
function isOriginalInDiffEditor(codeEditorService, codeEditor) {
  const diffEditors = codeEditorService.listDiffEditors();
  for (const diffEditor of diffEditors) {
    if (diffEditor.getOriginalEditor() === codeEditor) {
      return true;
    }
  }
  return false;
}
class CachedDecorations {
  constructor() {
    this.runByIdKey = /* @__PURE__ */ new Map();
  }
  get size() {
    return this.runByIdKey.size;
  }
  /** Gets a test run decoration that contains exactly the given test IDs */
  getForExactTests(testIds) {
    const key = testIds.sort().join("\0\0");
    return this.runByIdKey.get(key);
  }
  /** Adds a new test run decroation */
  addTest(d) {
    const key = d.testIds.sort().join("\0\0");
    this.runByIdKey.set(key, d);
  }
  /** Finds an extension by VS Code event ID */
  getById(decorationId) {
    for (const d of this.runByIdKey.values()) {
      if (d.id === decorationId) {
        return d;
      }
    }
    return void 0;
  }
  /** Iterate over all decorations */
  *[Symbol.iterator]() {
    for (const d of this.runByIdKey.values()) {
      yield d;
    }
  }
}
let TestingDecorationService = class extends Disposable {
  constructor(codeEditorService, configurationService, testService, results, instantiationService, modelService) {
    super();
    this.configurationService = configurationService;
    this.testService = testService;
    this.results = results;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.generation = 0;
    this.changeEmitter = this._register(new Emitter());
    this.decorationCache = new ResourceMap();
    /**
     * List of messages that should be hidden because an editor changed their
     * underlying ranges. I think this is good enough, because:
     *  - Message decorations are never shown across reloads; this does not
     *    need to persist
     *  - Message instances are stable for any completed test results for
     *    the duration of the session.
     */
    this.invalidatedMessages = /* @__PURE__ */ new WeakSet();
    /** @inheritdoc */
    this.onDidChange = this.changeEmitter.event;
    this._register(codeEditorService.registerDecorationType("test-message-decoration", TestMessageDecoration.decorationId, {}, void 0));
    this._register(modelService.onModelRemoved((e) => this.decorationCache.delete(e.uri)));
    const debounceInvalidate = this._register(new RunOnceScheduler(() => this.invalidate(), 100));
    this._register(this.testService.onWillProcessDiff((diff) => {
      for (const entry of diff) {
        if (entry.op !== TestDiffOpType.DocumentSynced) {
          continue;
        }
        const rec = this.decorationCache.get(entry.uri);
        if (rec) {
          rec.rangeUpdateVersionId = entry.docv;
        }
      }
      if (!debounceInvalidate.isScheduled()) {
        debounceInvalidate.schedule();
      }
    }));
    this._register(Event.any(
      this.results.onResultsChanged,
      this.results.onTestChanged,
      this.testService.excluded.onTestExclusionsChanged,
      Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(TestingConfigKeys.GutterEnabled))
    )(() => {
      if (!debounceInvalidate.isScheduled()) {
        debounceInvalidate.schedule();
      }
    }));
    this._register(GutterActionsRegistry.registerGutterActionsGenerator((context, result) => {
      const model = context.editor.getModel();
      const testingDecorations = TestingDecorations.get(context.editor);
      if (!model || !testingDecorations?.currentUri) {
        return;
      }
      const currentDecorations = this.syncDecorations(testingDecorations.currentUri);
      if (!currentDecorations.size) {
        return;
      }
      const modelDecorations = model.getLinesDecorations(context.lineNumber, context.lineNumber);
      for (const { id } of modelDecorations) {
        const decoration = currentDecorations.getById(id);
        if (decoration) {
          const { object: actions } = decoration.getContextMenuActions();
          for (const action of actions) {
            result.push(action, "1_testing");
          }
        }
      }
    }));
  }
  /** @inheritdoc */
  invalidateResultMessage(message) {
    this.invalidatedMessages.add(message);
    this.invalidate();
  }
  /** @inheritdoc */
  syncDecorations(resource) {
    const model = this.modelService.getModel(resource);
    if (!model) {
      return new CachedDecorations();
    }
    const cached = this.decorationCache.get(resource);
    if (cached && cached.generation === this.generation && (cached.rangeUpdateVersionId === void 0 || cached.rangeUpdateVersionId !== model.getVersionId())) {
      return cached.value;
    }
    return this.applyDecorations(model);
  }
  /** @inheritdoc */
  getDecoratedTestPosition(resource, testId) {
    const model = this.modelService.getModel(resource);
    if (!model) {
      return void 0;
    }
    const decoration = Iterable.find(this.syncDecorations(resource), (v) => v instanceof RunTestDecoration && v.isForTest(testId));
    if (!decoration) {
      return void 0;
    }
    return model.getDecorationRange(decoration.id)?.getStartPosition();
  }
  invalidate() {
    this.generation++;
    this.changeEmitter.fire();
  }
  /**
   * Sets whether alternate actions are shown for the model.
   */
  updateDecorationsAlternateAction(resource, isAlt) {
    const model = this.modelService.getModel(resource);
    const cached = this.decorationCache.get(resource);
    if (!model || !cached || cached.isAlt === isAlt) {
      return;
    }
    cached.isAlt = isAlt;
    model.changeDecorations((accessor) => {
      for (const decoration of cached.value) {
        if (decoration instanceof RunTestDecoration && decoration.editorDecoration.alternate) {
          accessor.changeDecorationOptions(
            decoration.id,
            isAlt ? decoration.editorDecoration.alternate : decoration.editorDecoration.options
          );
        }
      }
    });
  }
  /**
   * Applies the current set of test decorations to the given text model.
   */
  applyDecorations(model) {
    const gutterEnabled = getTestingConfiguration(this.configurationService, TestingConfigKeys.GutterEnabled);
    const cached = this.decorationCache.get(model.uri);
    const testRangesUpdated = cached?.rangeUpdateVersionId === model.getVersionId();
    const lastDecorations = cached?.value ?? new CachedDecorations();
    const newDecorations = model.changeDecorations((accessor) => {
      const newDecorations2 = new CachedDecorations();
      const runDecorations = new TestDecorations();
      for (const test of this.testService.collection.getNodeByUrl(model.uri)) {
        if (!test.item.range) {
          continue;
        }
        const stateLookup = this.results.getStateById(test.item.extId);
        const line = test.item.range.startLineNumber;
        runDecorations.push({ line, id: "", test, resultItem: stateLookup?.[1] });
      }
      for (const [line, tests] of runDecorations.lines()) {
        const multi = tests.length > 1;
        let existing = lastDecorations.getForExactTests(tests.map((t) => t.test.item.extId));
        if (existing && testRangesUpdated && model.getDecorationRange(existing.id)?.startLineNumber !== line) {
          existing = void 0;
        }
        if (existing) {
          if (existing.replaceOptions(tests, gutterEnabled)) {
            accessor.changeDecorationOptions(existing.id, existing.editorDecoration.options);
          }
          newDecorations2.addTest(existing);
        } else {
          newDecorations2.addTest(multi ? this.instantiationService.createInstance(MultiRunTestDecoration, tests, gutterEnabled, model) : this.instantiationService.createInstance(RunSingleTestDecoration, tests[0].test, tests[0].resultItem, model, gutterEnabled));
        }
      }
      const saveFromRemoval = /* @__PURE__ */ new Set();
      for (const decoration of newDecorations2) {
        if (decoration.id === "") {
          decoration.id = accessor.addDecoration(decoration.editorDecoration.range, decoration.editorDecoration.options);
        } else {
          saveFromRemoval.add(decoration.id);
        }
      }
      for (const decoration of lastDecorations) {
        if (!saveFromRemoval.has(decoration.id)) {
          accessor.removeDecoration(decoration.id);
        }
      }
      this.decorationCache.set(model.uri, {
        generation: this.generation,
        rangeUpdateVersionId: cached?.rangeUpdateVersionId,
        value: newDecorations2
      });
      return newDecorations2;
    });
    return newDecorations || lastDecorations;
  }
};
TestingDecorationService = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITestService),
  __decorateParam(3, ITestResultService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IModelService)
], TestingDecorationService);
let TestingDecorations = class extends Disposable {
  constructor(editor, codeEditorService, testService, decorations, uriIdentityService, results, configurationService, instantiationService) {
    super();
    this.editor = editor;
    this.codeEditorService = codeEditorService;
    this.testService = testService;
    this.decorations = decorations;
    this.uriIdentityService = uriIdentityService;
    this.results = results;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.expectedWidget = this._register(new MutableDisposable());
    this.actualWidget = this._register(new MutableDisposable());
    this.errorContentWidgets = this._register(new DisposableMap());
    this.loggedMessageDecorations = /* @__PURE__ */ new Map();
    this._register(codeEditorService.registerDecorationType("test-message-decoration", TestMessageDecoration.decorationId, {}, void 0, editor));
    this.attachModel(editor.getModel()?.uri);
    this._register(decorations.onDidChange(() => {
      if (this._currentUri) {
        decorations.syncDecorations(this._currentUri);
      }
    }));
    const msgThrottler = this._register(new Throttler());
    this._register(this.results.onTestChanged((ev) => {
      if (ev.reason !== TestResultItemChangeReason.NewMessage) {
        return;
      }
      msgThrottler.queue(() => {
        this.applyResults();
        return timeout(100);
      });
    }));
    this._register(Event.any(
      this.results.onResultsChanged,
      editor.onDidChangeModel,
      this.testService.showInlineOutput.onDidChange
    )(() => this.applyResults()));
    const win = dom.getWindow(editor.getDomNode());
    this._register(dom.addDisposableListener(win, "keydown", (e) => {
      if (new StandardKeyboardEvent(e).keyCode === KeyCode.Alt && this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, true);
      }
    }));
    this._register(dom.addDisposableListener(win, "keyup", (e) => {
      if (new StandardKeyboardEvent(e).keyCode === KeyCode.Alt && this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, false);
      }
    }));
    this._register(dom.addDisposableListener(win, "blur", () => {
      if (this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, false);
      }
    }));
    this._register(this.editor.onKeyUp((e) => {
      if (e.keyCode === KeyCode.Alt && this._currentUri) {
        decorations.updateDecorationsAlternateAction(this._currentUri, false);
      }
    }));
    this._register(this.editor.onDidChangeModel((e) => this.attachModel(e.newModelUrl || void 0)));
    this._register(this.editor.onMouseDown((e) => {
      if (e.target.position && this.currentUri) {
        const modelDecorations = editor.getModel()?.getLineDecorations(e.target.position.lineNumber) ?? [];
        if (!modelDecorations.length) {
          return;
        }
        const cache = decorations.syncDecorations(this.currentUri);
        for (const { id } of modelDecorations) {
          if (cache.getById(id)?.click(e)) {
            e.event.stopPropagation();
            return;
          }
        }
      }
    }));
    this._register(Event.accumulate(this.editor.onDidChangeModelContent, 0, void 0, this._store)((evts) => {
      const model = editor.getModel();
      if (!this._currentUri || !model) {
        return;
      }
      let changed = false;
      for (const [message, deco] of this.loggedMessageDecorations) {
        const invalidate = evts.some((e) => e.changes.some(
          (c) => c.range.startLineNumber <= deco.line && c.range.endLineNumber >= deco.line || deco.resultItem?.item.range && deco.resultItem.item.range.startLineNumber <= c.range.startLineNumber && deco.resultItem.item.range.endLineNumber >= c.range.endLineNumber
        ));
        if (invalidate) {
          changed = true;
          TestingDecorations.invalidatedTests.add(deco.resultItem || message);
        }
      }
      if (changed) {
        this.applyResults();
      }
    }));
    const updateFontFamilyVar = () => {
      this.editor.getContainerDomNode().style.setProperty("--testMessageDecorationFontFamily", editor.getOption(EditorOption.fontFamily));
      this.editor.getContainerDomNode().style.setProperty("--testMessageDecorationFontSize", `${editor.getOption(EditorOption.fontSize)}px`);
    };
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontFamily)) {
        updateFontFamilyVar();
      }
    }));
    updateFontFamilyVar();
  }
  static {
    /**
     * Results invalidated by editor changes.
     */
    this.invalidatedTests = /* @__PURE__ */ new WeakSet();
  }
  /**
   * Gets the decorations associated with the given code editor.
   */
  static get(editor) {
    return editor.getContribution(Testing.DecorationsContributionId);
  }
  get currentUri() {
    return this._currentUri;
  }
  attachModel(uri) {
    switch (uri && parseTestUri(uri)?.type) {
      case TestUriType.ResultExpectedOutput:
        this.expectedWidget.value = new ExpectedLensContentWidget(this.editor);
        this.actualWidget.clear();
        break;
      case TestUriType.ResultActualOutput:
        this.expectedWidget.clear();
        this.actualWidget.value = new ActualLensContentWidget(this.editor);
        break;
      default:
        this.expectedWidget.clear();
        this.actualWidget.clear();
    }
    if (isOriginalInDiffEditor(this.codeEditorService, this.editor)) {
      uri = void 0;
    }
    this._currentUri = uri;
    if (!uri) {
      return;
    }
    this.decorations.syncDecorations(uri);
    (async () => {
      for await (const _tests of testsInFile(this.testService, this.uriIdentityService, uri, false)) {
        if (this._currentUri !== uri) {
          break;
        }
      }
    })();
  }
  applyResults() {
    const model = this.editor.getModel();
    if (!model) {
      return this.clearResults();
    }
    const uriStr = model.uri.toString();
    const seenLines = /* @__PURE__ */ new Set();
    this.applyResultsContentWidgets(uriStr, seenLines);
    this.applyResultsLoggedMessages(uriStr, seenLines);
  }
  clearResults() {
    this.errorContentWidgets.clearAndDisposeAll();
  }
  isMessageInvalidated(message) {
    return TestingDecorations.invalidatedTests.has(message);
  }
  applyResultsContentWidgets(uriStr, seenLines) {
    const seen = /* @__PURE__ */ new Set();
    if (getTestingConfiguration(this.configurationService, TestingConfigKeys.ShowAllMessages)) {
      this.results.results.forEach((lastResult) => this.applyContentWidgetsFromResult(lastResult, uriStr, seen, seenLines));
    } else if (this.results.results.length) {
      this.applyContentWidgetsFromResult(this.results.results[0], uriStr, seen, seenLines);
    }
    for (const message of this.errorContentWidgets.keys()) {
      if (!seen.has(message)) {
        this.errorContentWidgets.deleteAndDispose(message);
      }
    }
  }
  applyContentWidgetsFromResult(lastResult, uriStr, seen, seenLines) {
    for (const test of lastResult.tests) {
      if (TestingDecorations.invalidatedTests.has(test)) {
        continue;
      }
      for (let taskId = 0; taskId < test.tasks.length; taskId++) {
        const state = test.tasks[taskId];
        for (let i = 0; i < state.messages.length; i++) {
          const m = state.messages[i];
          if (m.type !== TestMessageType.Error || this.isMessageInvalidated(m)) {
            continue;
          }
          const line = m.location?.uri.toString() === uriStr ? m.location.range.startLineNumber : m.stackTrace && mapFindFirst(m.stackTrace, (f) => f.position && f.uri?.toString() === uriStr ? f.position.lineNumber : void 0);
          if (line === void 0 || seenLines.has(line)) {
            continue;
          }
          const model = this.editor.getModel();
          if (model && (line < 1 || line > model.getLineCount())) {
            continue;
          }
          seenLines.add(line);
          let deco = this.errorContentWidgets.get(m);
          if (!deco) {
            const lineLength = model?.getLineLength(line) ?? 100;
            deco = this.instantiationService.createInstance(
              TestErrorContentWidget,
              this.editor,
              new Position(line, lineLength + 1),
              m,
              test,
              buildTestUri({
                type: TestUriType.ResultActualOutput,
                messageIndex: i,
                taskIndex: taskId,
                resultId: lastResult.id,
                testExtId: test.item.extId
              })
            );
            this.errorContentWidgets.set(m, deco);
          }
          seen.add(m);
        }
      }
    }
  }
  applyResultsLoggedMessages(uriStr, messageLines) {
    this.editor.changeDecorations((accessor) => {
      const seen = /* @__PURE__ */ new Set();
      if (getTestingConfiguration(this.configurationService, TestingConfigKeys.ShowAllMessages)) {
        this.results.results.forEach((r) => this.applyLoggedMessageFromResult(r, uriStr, seen, messageLines, accessor));
      } else if (this.results.results.length) {
        this.applyLoggedMessageFromResult(this.results.results[0], uriStr, seen, messageLines, accessor);
      }
      for (const [message, { id }] of this.loggedMessageDecorations) {
        if (!seen.has(message)) {
          accessor.removeDecoration(id);
        }
      }
    });
  }
  applyLoggedMessageFromResult(lastResult, uriStr, seen, messageLines, accessor) {
    if (!this.testService.showInlineOutput.value || !(lastResult instanceof LiveTestResult)) {
      return;
    }
    const tryAdd = (resultItem, m, uri) => {
      if (this.isMessageInvalidated(m) || m.location?.uri.toString() !== uriStr) {
        return;
      }
      seen.add(m);
      const line = m.location.range.startLineNumber;
      if (messageLines.has(line) || this.loggedMessageDecorations.has(m)) {
        return;
      }
      const deco = this.instantiationService.createInstance(TestMessageDecoration, m, uri, this.editor.getModel());
      messageLines.add(line);
      const id = accessor.addDecoration(
        deco.editorDecoration.range,
        deco.editorDecoration.options
      );
      this.loggedMessageDecorations.set(m, { id, line, resultItem });
    };
    for (const test of lastResult.tests) {
      if (TestingDecorations.invalidatedTests.has(test)) {
        continue;
      }
      for (let taskId = 0; taskId < test.tasks.length; taskId++) {
        const state = test.tasks[taskId];
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const m = state.messages[i];
          if (m.type === TestMessageType.Output) {
            tryAdd(test, m, buildTestUri({
              type: TestUriType.ResultActualOutput,
              messageIndex: i,
              taskIndex: taskId,
              resultId: lastResult.id,
              testExtId: test.item.extId
            }));
          }
        }
      }
    }
    for (const task of lastResult.tasks) {
      for (const m of task.otherMessages) {
        tryAdd(void 0, m);
      }
    }
  }
};
TestingDecorations = __decorateClass([
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, ITestService),
  __decorateParam(3, ITestingDecorationsService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, ITestResultService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IInstantiationService)
], TestingDecorations);
const collapseRange = (originalRange) => ({
  startLineNumber: originalRange.startLineNumber,
  endLineNumber: originalRange.startLineNumber,
  startColumn: originalRange.startColumn,
  endColumn: originalRange.startColumn
});
const createRunTestDecoration = (tests, states, visible, defaultGutterAction) => {
  const range = tests[0]?.item.range;
  if (!range) {
    throw new Error("Test decorations can only be created for tests with a range");
  }
  if (!visible) {
    return {
      range: collapseRange(range),
      options: { isWholeLine: true, description: "run-test-decoration" }
    };
  }
  let computedState = TestResultState.Unset;
  const hoverMessageParts = [];
  let testIdWithMessages;
  let retired = false;
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const resultItem = states[i];
    const state = resultItem?.computedState ?? TestResultState.Unset;
    if (hoverMessageParts.length < 10) {
      hoverMessageParts.push(labelForTestInState(test.item.label, state));
    }
    computedState = maxPriority(computedState, state);
    retired = retired || !!resultItem?.retired;
    if (!testIdWithMessages && resultItem?.tasks.some((t) => t.messages.length)) {
      testIdWithMessages = test.item.extId;
    }
  }
  const hasMultipleTests = tests.length > 1 || tests[0].children.size > 0;
  const primaryIcon = computedState === TestResultState.Unset ? hasMultipleTests ? testingRunAllIcon : testingRunIcon : testingStatesToIcons.get(computedState);
  const alternateIcon = defaultGutterAction === DefaultGutterClickAction.Debug ? hasMultipleTests ? testingRunAllIcon : testingRunIcon : hasMultipleTests ? testingDebugAllIcon : testingDebugIcon;
  let hoverMessage;
  let glyphMarginClassName = "testing-run-glyph";
  if (retired) {
    glyphMarginClassName += " retired";
  }
  const defaultOptions = {
    description: "run-test-decoration",
    showIfCollapsed: true,
    get hoverMessage() {
      if (!hoverMessage) {
        const building = hoverMessage = new MarkdownString("", true).appendText(hoverMessageParts.join(", ") + ".");
        if (testIdWithMessages) {
          const args = encodeURIComponent(JSON.stringify([testIdWithMessages]));
          building.appendMarkdown(` [${localize("peekTestOutout", "Peek Test Output")}](command:vscode.peekTestError?${args})`);
        }
      }
      return hoverMessage;
    },
    glyphMargin: { position: GLYPH_MARGIN_LANE },
    glyphMarginClassName: `${ThemeIcon.asClassName(primaryIcon)} ${glyphMarginClassName}`,
    stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    zIndex: 1e4,
    overviewRuler: isFailedState(computedState) ? { color: themeColorFromId(overviewRulerError), position: OverviewRulerLane.Center } : void 0
  };
  const alternateOptions = {
    ...defaultOptions,
    glyphMarginClassName: `${ThemeIcon.asClassName(alternateIcon)} ${glyphMarginClassName}`
  };
  return {
    range: collapseRange(range),
    options: defaultOptions,
    alternate: alternateOptions
  };
};
var LensContentWidgetVars = /* @__PURE__ */ ((LensContentWidgetVars2) => {
  LensContentWidgetVars2["FontFamily"] = "testingDiffLensFontFamily";
  LensContentWidgetVars2["FontFeatures"] = "testingDiffLensFontFeatures";
  return LensContentWidgetVars2;
})(LensContentWidgetVars || {});
class TitleLensContentWidget {
  constructor(editor) {
    this.editor = editor;
    /** @inheritdoc */
    this.allowEditorOverflow = false;
    /** @inheritdoc */
    this.suppressMouseDown = true;
    this._domNode = dom.$("span");
    queueMicrotask(() => {
      this.applyStyling();
      this.editor.addContentWidget(this);
    });
  }
  applyStyling() {
    let fontSize = this.editor.getOption(EditorOption.codeLensFontSize);
    let height;
    if (!fontSize || fontSize < 5) {
      fontSize = this.editor.getOption(EditorOption.fontSize) * 0.9 | 0;
      height = this.editor.getOption(EditorOption.lineHeight);
    } else {
      height = fontSize * Math.max(1.3, this.editor.getOption(EditorOption.lineHeight) / this.editor.getOption(EditorOption.fontSize)) | 0;
    }
    const editorFontInfo = this.editor.getOption(EditorOption.fontInfo);
    const node = this._domNode;
    node.classList.add("testing-diff-lens-widget");
    node.textContent = this.getText();
    node.style.lineHeight = `${height}px`;
    node.style.fontSize = `${fontSize}px`;
    node.style.fontFamily = `var(--${"testingDiffLensFontFamily" /* FontFamily */})`;
    node.style.fontFeatureSettings = `var(--${"testingDiffLensFontFeatures" /* FontFeatures */})`;
    const containerStyle = this.editor.getContainerDomNode().style;
    containerStyle.setProperty("testingDiffLensFontFamily" /* FontFamily */, this.editor.getOption(EditorOption.codeLensFontFamily) ?? "inherit");
    containerStyle.setProperty("testingDiffLensFontFeatures" /* FontFeatures */, editorFontInfo.fontFeatureSettings);
    this.editor.changeViewZones((accessor) => {
      if (this.viewZoneId) {
        accessor.removeZone(this.viewZoneId);
      }
      this.viewZoneId = accessor.addZone({
        afterLineNumber: 0,
        afterColumn: Constants.MAX_SAFE_SMALL_INTEGER,
        domNode: document.createElement("div"),
        heightInPx: 20
      });
    });
  }
  /** @inheritdoc */
  getDomNode() {
    return this._domNode;
  }
  /** @inheritdoc */
  dispose() {
    this.editor.changeViewZones((accessor) => {
      if (this.viewZoneId) {
        accessor.removeZone(this.viewZoneId);
      }
    });
    this.editor.removeContentWidget(this);
  }
  /** @inheritdoc */
  getPosition() {
    return {
      position: { column: 0, lineNumber: 0 },
      preference: [ContentWidgetPositionPreference.ABOVE]
    };
  }
}
class ExpectedLensContentWidget extends TitleLensContentWidget {
  getId() {
    return "expectedTestingLens";
  }
  getText() {
    return localize("expected.title", "Expected");
  }
}
class ActualLensContentWidget extends TitleLensContentWidget {
  getId() {
    return "actualTestingLens";
  }
  getText() {
    return localize("actual.title", "Actual");
  }
}
let RunTestDecoration = class {
  constructor(tests, visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfileService, contextKeyService, menuService) {
    this.tests = tests;
    this.visible = visible;
    this.model = model;
    this.codeEditorService = codeEditorService;
    this.testService = testService;
    this.contextMenuService = contextMenuService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.testProfileService = testProfileService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    /** @inheritdoc */
    this.id = "";
    this.displayedStates = tests.map((t) => t.resultItem?.computedState);
    this.editorDecoration = createRunTestDecoration(
      tests.map((t) => t.test),
      tests.map((t) => t.resultItem),
      visible,
      getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)
    );
    this.editorDecoration.options.glyphMarginHoverMessage = new MarkdownString().appendText(this.getGutterLabel());
  }
  get line() {
    return this.editorDecoration.range.startLineNumber;
  }
  get testIds() {
    return this.tests.map((t) => t.test.item.extId);
  }
  /** @inheritdoc */
  click(e) {
    if (e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.detail.glyphMarginLane !== GLYPH_MARGIN_LANE || e.event.rightButton || isMacintosh && e.event.leftButton && e.event.ctrlKey) {
      return false;
    }
    const alternateAction = e.event.altKey;
    switch (getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)) {
      case DefaultGutterClickAction.ContextMenu:
        this.showContextMenu(e);
        break;
      case DefaultGutterClickAction.Debug:
        this.runWith(alternateAction ? TestRunProfileBitset.Run : TestRunProfileBitset.Debug);
        break;
      case DefaultGutterClickAction.Coverage:
        this.runWith(alternateAction ? TestRunProfileBitset.Debug : TestRunProfileBitset.Coverage);
        break;
      case DefaultGutterClickAction.Run:
      default:
        this.runWith(alternateAction ? TestRunProfileBitset.Debug : TestRunProfileBitset.Run);
        break;
    }
    return true;
  }
  /**
   * Updates the decoration to match the new set of tests.
   * @returns true if options were changed, false otherwise
   */
  replaceOptions(newTests, visible) {
    const displayedStates = newTests.map((t) => t.resultItem?.computedState);
    if (visible === this.visible && equals(this.displayedStates, displayedStates)) {
      return false;
    }
    this.tests = newTests;
    this.displayedStates = displayedStates;
    this.visible = visible;
    const { options, alternate } = createRunTestDecoration(
      newTests.map((t) => t.test),
      newTests.map((t) => t.resultItem),
      visible,
      getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)
    );
    this.editorDecoration.options = options;
    this.editorDecoration.alternate = alternate;
    this.editorDecoration.options.glyphMarginHoverMessage = new MarkdownString().appendText(this.getGutterLabel());
    return true;
  }
  /**
   * Gets whether this decoration serves as the run button for the given test ID.
   */
  isForTest(testId) {
    return this.tests.some((t) => t.test.item.extId === testId);
  }
  runWith(profile) {
    return this.testService.runTests({
      tests: simplifyTestsToExecute(this.testService.collection, this.tests.map(({ test }) => test)),
      group: profile
    });
  }
  showContextMenu(e) {
    const editor = this.codeEditorService.listCodeEditors().find((e2) => e2.getModel() === this.model);
    editor?.getContribution(EditorLineNumberContextMenu.ID)?.show(e);
  }
  getGutterLabel() {
    switch (getTestingConfiguration(this.configurationService, TestingConfigKeys.DefaultGutterClickAction)) {
      case DefaultGutterClickAction.ContextMenu:
        return localize("testing.gutterMsg.contextMenu", "Click for test options");
      case DefaultGutterClickAction.Debug:
        return localize("testing.gutterMsg.debug", "Click to debug tests, right click for more options");
      case DefaultGutterClickAction.Coverage:
        return localize("testing.gutterMsg.coverage", "Click to run tests with coverage, right click for more options");
      case DefaultGutterClickAction.Run:
      default:
        return localize("testing.gutterMsg.run", "Click to run tests, right click for more options");
    }
  }
  /**
   * Gets context menu actions relevant for a singel test.
   */
  getTestContextMenuActions(test, resultItem) {
    const testActions = [];
    const capabilities = this.testProfileService.capabilitiesForTest(test.item);
    [
      { bitset: TestRunProfileBitset.Run, label: localize("run test", "Run Test") },
      { bitset: TestRunProfileBitset.Debug, label: localize("debug test", "Debug Test") },
      { bitset: TestRunProfileBitset.Coverage, label: localize("coverage test", "Run with Coverage") }
    ].forEach(({ bitset, label }) => {
      if (capabilities & bitset) {
        testActions.push(new Action(
          `testing.gutter.${bitset}`,
          label,
          void 0,
          void 0,
          () => this.testService.runTests({ group: bitset, tests: [test] })
        ));
      }
    });
    if (capabilities & TestRunProfileBitset.HasNonDefaultProfile) {
      testActions.push(new Action("testing.runUsing", localize("testing.runUsing", "Execute Using Profile..."), void 0, void 0, async () => {
        const profile = await this.commandService.executeCommand("vscode.pickTestProfile", { onlyForTest: test });
        if (!profile) {
          return;
        }
        this.testService.runResolvedTests({
          group: profile.group,
          targets: [{
            profileId: profile.profileId,
            controllerId: profile.controllerId,
            testIds: [test.item.extId]
          }]
        });
      }));
    }
    if (resultItem && isFailedState(resultItem.computedState)) {
      testActions.push(new Action(
        "testing.gutter.peekFailure",
        localize("peek failure", "Peek Error"),
        void 0,
        void 0,
        () => this.commandService.executeCommand("vscode.peekTestError", test.item.extId)
      ));
    }
    if (resultItem?.computedState === TestResultState.Running) {
      testActions.push(new Action(
        "testing.gutter.cancel",
        localize("testing.cancelRun", "Cancel Test Run"),
        void 0,
        void 0,
        () => this.commandService.executeCommand(TestCommandId.CancelTestRunAction)
      ));
    }
    testActions.push(new Action(
      "testing.gutter.reveal",
      localize("reveal test", "Reveal in Test Explorer"),
      void 0,
      void 0,
      () => this.commandService.executeCommand("_revealTestInExplorer", test.item.extId)
    ));
    const contributed = this.getContributedTestActions(test, capabilities);
    return { object: Separator.join(testActions, contributed), dispose() {
      testActions.forEach((a) => a.dispose());
    } };
  }
  getContributedTestActions(test, capabilities) {
    const contextOverlay = this.contextKeyService.createOverlay(getTestItemContextOverlay(test, capabilities));
    const arg = getContextForTestItem(this.testService.collection, test.item.extId);
    const menu = this.menuService.getMenuActions(MenuId.TestItemGutter, contextOverlay, { shouldForwardArgs: true, arg });
    return getFlatContextMenuActions(menu);
  }
};
RunTestDecoration = __decorateClass([
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, ITestService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITestProfileService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IMenuService)
], RunTestDecoration);
let MultiRunTestDecoration = class extends RunTestDecoration {
  constructor(tests, visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfileService, contextKeyService, menuService, quickInputService) {
    super(tests, visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfileService, contextKeyService, menuService);
    this.quickInputService = quickInputService;
  }
  getContextMenuActions() {
    const disposable = new DisposableStore();
    const allActions = [];
    [
      { bitset: TestRunProfileBitset.Run, label: localize("run all test", "Run All Tests") },
      { bitset: TestRunProfileBitset.Coverage, label: localize("run all test with coverage", "Run All Tests with Coverage") },
      { bitset: TestRunProfileBitset.Debug, label: localize("debug all test", "Debug All Tests") }
    ].forEach(({ bitset, label }, i) => {
      const canRun = this.tests.some(({ test }) => this.testProfileService.capabilitiesForTest(test.item) & bitset);
      if (canRun) {
        allActions.push(new Action(`testing.gutter.run${i}`, label, void 0, void 0, () => this.runWith(bitset)));
      }
    });
    disposable.add(toDisposable(() => allActions.forEach((a) => a.dispose())));
    const testItems = this.tests.map((testItem) => ({
      currentLabel: testItem.test.item.label,
      testItem,
      parent: TestId.fromString(testItem.test.item.extId).parentId
    }));
    const getLabelConflicts = (tests) => {
      const labelCount = /* @__PURE__ */ new Map();
      for (const test of tests) {
        labelCount.set(test.currentLabel, (labelCount.get(test.currentLabel) || 0) + 1);
      }
      return tests.filter((e) => labelCount.get(e.currentLabel) > 1);
    };
    let conflicts, hasParent = true;
    while ((conflicts = getLabelConflicts(testItems)).length && hasParent) {
      for (const conflict of conflicts) {
        if (conflict.parent) {
          const parent = this.testService.collection.getNodeById(conflict.parent.toString());
          conflict.currentLabel = parent?.item.label + " > " + conflict.currentLabel;
          conflict.parent = conflict.parent.parentId;
        } else {
          hasParent = false;
        }
      }
    }
    testItems.sort((a, b) => {
      const ai = a.testItem.test.item;
      const bi = b.testItem.test.item;
      return (ai.sortText || ai.label).localeCompare(bi.sortText || bi.label);
    });
    let testSubmenus = testItems.map(({ currentLabel, testItem }) => {
      const actions = this.getTestContextMenuActions(testItem.test, testItem.resultItem);
      disposable.add(actions);
      let label = stripIcons(currentLabel);
      const lf = label.indexOf("\n");
      if (lf !== -1) {
        label = label.slice(0, lf);
      }
      return new SubmenuAction(testItem.test.item.extId, label, actions.object);
    });
    const overflow = testSubmenus.length - MAX_TESTS_IN_SUBMENU;
    if (overflow > 0) {
      testSubmenus = testSubmenus.slice(0, MAX_TESTS_IN_SUBMENU);
      testSubmenus.push(new Action(
        "testing.gutter.overflow",
        localize("testOverflowItems", "{0} more tests...", overflow),
        void 0,
        void 0,
        () => this.pickAndRun(testItems)
      ));
    }
    return { object: Separator.join(allActions, testSubmenus), dispose: () => disposable.dispose() };
  }
  async pickAndRun(testItems) {
    const doPick = (items, title) => new Promise((resolve) => {
      const disposables = new DisposableStore();
      const pick = disposables.add(this.quickInputService.createQuickPick());
      pick.placeholder = title;
      pick.items = items;
      disposables.add(pick.onDidHide(() => {
        resolve(void 0);
        disposables.dispose();
      }));
      disposables.add(pick.onDidAccept(() => {
        resolve(pick.selectedItems[0]);
        disposables.dispose();
      }));
      pick.show();
    });
    const item = await doPick(
      testItems.map(({ currentLabel, testItem }) => ({ label: currentLabel, test: testItem.test, result: testItem.resultItem })),
      localize("selectTestToRun", "Select a test to run")
    );
    if (!item) {
      return;
    }
    const actions = this.getTestContextMenuActions(item.test, item.result);
    try {
      (await doPick(actions.object, item.label))?.run();
    } finally {
      actions.dispose();
    }
  }
};
MultiRunTestDecoration = __decorateClass([
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, ITestService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITestProfileService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IMenuService),
  __decorateParam(11, IQuickInputService)
], MultiRunTestDecoration);
let RunSingleTestDecoration = class extends RunTestDecoration {
  constructor(test, resultItem, model, visible, codeEditorService, testService, commandService, contextMenuService, configurationService, testProfiles, contextKeyService, menuService) {
    super([{ test, resultItem }], visible, model, codeEditorService, testService, contextMenuService, commandService, configurationService, testProfiles, contextKeyService, menuService);
  }
  getContextMenuActions() {
    return this.getTestContextMenuActions(this.tests[0].test, this.tests[0].resultItem);
  }
};
RunSingleTestDecoration = __decorateClass([
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, ITestService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, ITestProfileService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IMenuService)
], RunSingleTestDecoration);
const lineBreakRe = /\r?\n\s*/g;
let TestMessageDecoration = class {
  constructor(testMessage, messageUri, textModel, peekOpener, editorService) {
    this.testMessage = testMessage;
    this.messageUri = messageUri;
    this.peekOpener = peekOpener;
    this.id = "";
    this.contentIdClass = `test-message-inline-content-id${generateUuid()}`;
    const location = testMessage.location;
    this.line = clamp(location.range.startLineNumber, 0, textModel.getLineCount());
    const severity = testMessage.type;
    const message = testMessage.message;
    const options = editorService.resolveDecorationOptions(TestMessageDecoration.decorationId, true);
    const hoverText = renderTestMessageAsText(message);
    options.hoverMessage = new MarkdownString().appendText(hoverText);
    options.zIndex = 10;
    options.className = `testing-inline-message-severity-${severity}`;
    options.isWholeLine = true;
    options.stickiness = TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
    options.collapseOnReplaceEdit = true;
    let inlineText = renderTestMessageAsText(message).replace(lineBreakRe, " ");
    if (inlineText.length > MAX_INLINE_MESSAGE_LENGTH) {
      inlineText = inlineText.slice(0, MAX_INLINE_MESSAGE_LENGTH - 1) + "\u2026";
    }
    options.after = {
      content: inlineText,
      inlineClassName: `test-message-inline-content test-message-inline-content-s${severity} ${this.contentIdClass} ${messageUri ? "test-message-inline-content-clickable" : ""}`
    };
    options.showIfCollapsed = true;
    const rulerColor = severity === TestMessageType.Error ? overviewRulerError : overviewRulerInfo;
    if (rulerColor) {
      options.overviewRuler = { color: themeColorFromId(rulerColor), position: OverviewRulerLane.Right };
    }
    const lineLength = textModel.getLineLength(this.line);
    const column = lineLength ? lineLength + 1 : location.range.endColumn;
    this.editorDecoration = {
      options,
      range: {
        startLineNumber: this.line,
        startColumn: column,
        endColumn: column,
        endLineNumber: this.line
      }
    };
  }
  static {
    this.inlineClassName = "test-message-inline-content";
  }
  static {
    this.decorationId = `testmessage-${generateUuid()}`;
  }
  click(e) {
    if (e.event.rightButton) {
      return false;
    }
    if (!this.messageUri) {
      return false;
    }
    if (e.target.element?.className.includes(this.contentIdClass)) {
      this.peekOpener.peekUri(this.messageUri);
    }
    return false;
  }
  getContextMenuActions() {
    return { object: [], dispose: () => {
    } };
  }
};
TestMessageDecoration = __decorateClass([
  __decorateParam(3, ITestingPeekOpener),
  __decorateParam(4, ICodeEditorService)
], TestMessageDecoration);
const ERROR_CONTENT_WIDGET_HEIGHT = 20;
let TestErrorContentWidget = class extends Disposable {
  constructor(editor, position, message, resultItem, uri, peekOpener) {
    super();
    this.editor = editor;
    this.position = position;
    this.message = message;
    this.resultItem = resultItem;
    this.peekOpener = peekOpener;
    this.id = generateUuid();
    /** @inheritdoc */
    this.allowEditorOverflow = false;
    this.node = dom.h("div.test-error-content-widget", [
      dom.h("div.inner@inner", [
        dom.h("div.arrow@arrow"),
        dom.h(`span${ThemeIcon.asCSSSelector(testingStatesToIcons.get(TestResultState.Failed))}`),
        dom.h("span.content@name")
      ])
    ]);
    const setMarginTop = () => {
      const lineHeight = editor.getLineHeightForPosition(position);
      this.node.root.style.marginTop = (lineHeight - ERROR_CONTENT_WIDGET_HEIGHT) / 2 + "px";
    };
    setMarginTop();
    this._register(editor.onDidChangeLineHeight((e) => {
      if (e.affects(position)) {
        setMarginTop();
      }
    }));
    this._register(editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.lineHeight)) {
        setMarginTop();
      }
    }));
    let text;
    if (message.expected !== void 0 && message.actual !== void 0) {
      text = `${truncateMiddle(message.actual.replace(/\s+/g, " "), 30)} != ${truncateMiddle(message.expected.replace(/\s+/g, " "), 30)}`;
    } else {
      const msg = renderAsPlaintext(message.message);
      const lf = msg.indexOf("\n");
      text = lf === -1 ? msg : msg.slice(0, lf);
    }
    this._register(dom.addDisposableListener(this.node.root, dom.EventType.CLICK, (e) => {
      this.peekOpener.peekUri(uri);
      e.preventDefault();
    }));
    const ctrl = TestingOutputPeekController.get(editor);
    if (ctrl) {
      this._register(autorun((reader) => {
        const subject = ctrl.subject.read(reader);
        const isCurrent = subject instanceof MessageSubject && subject.message === message;
        this.node.root.classList.toggle("is-current", isCurrent);
      }));
    }
    this.node.name.innerText = text || "Test Failed";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "10");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("viewBox", "0 0 15 10");
    const leftArrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    leftArrow.setAttribute("d", "M15 0 L10 0 L0 5 L10 10 L15 10 Z");
    svg.append(leftArrow);
    this.node.arrow.appendChild(svg);
    this._register(editor.onDidChangeModelContent((e) => {
      for (const c of e.changes) {
        if (c.range.startLineNumber > this.line) {
          continue;
        }
        if (c.range.startLineNumber <= this.line && c.range.endLineNumber >= this.line || resultItem.item.range && resultItem.item.range.startLineNumber <= c.range.startLineNumber && resultItem.item.range.endLineNumber >= c.range.endLineNumber) {
          TestingDecorations.invalidatedTests.add(this.resultItem);
          this.dispose();
        }
        const adjust = count(c.text, "\n") - (c.range.endLineNumber - c.range.startLineNumber);
        if (adjust !== 0) {
          this.position = this.position.delta(adjust);
          this.editor.layoutContentWidget(this);
        }
      }
    }));
    editor.addContentWidget(this);
    this._register(toDisposable(() => editor.removeContentWidget(this)));
  }
  get line() {
    return this.position.lineNumber;
  }
  getId() {
    return this.id;
  }
  getDomNode() {
    return this.node.root;
  }
  getPosition() {
    return {
      position: this.position,
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  afterRender(_position, coordinate) {
    if (coordinate) {
      const { verticalScrollbarWidth } = this.editor.getLayoutInfo();
      const scrollWidth = this.editor.getScrollWidth();
      this.node.inner.style.maxWidth = `${scrollWidth - verticalScrollbarWidth - coordinate.left - 20}px`;
    }
  }
};
TestErrorContentWidget = __decorateClass([
  __decorateParam(5, ITestingPeekOpener)
], TestErrorContentWidget);
export {
  TestingDecorationService,
  TestingDecorations
};
