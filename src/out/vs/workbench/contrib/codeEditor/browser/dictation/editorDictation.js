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
import "./editorDictation.css";
import { localize, localize2 } from "../../../../../nls.js";
import { getActiveWindow, getWindow } from "../../../../../base/browser/dom.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../../../editor/browser/editorBrowser.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { HasSpeechProvider, ISpeechService, SpeechToTextInProgress, SpeechToTextStatus } from "../../../speech/common/speechService.js";
import { ChatContextKeys } from "../../../chat/common/actions/chatContextKeys.js";
import { ChatSpeechToTextState, IChatSpeechToTextService } from "../../../chat/browser/speechToText/chatSpeechToTextService.js";
import { activeDictationEditor, isDictating, startDictation, stopDictation } from "../../../chat/browser/speechToText/dictationSession.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { EditorAction2, EditorContributionInstantiation, registerEditorContribution } from "../../../../../editor/browser/editorExtensions.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { assertReturnsDefined } from "../../../../../base/common/types.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { toAction } from "../../../../../base/common/actions.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { EmptyTextEditorHintContributionId } from "../emptyTextEditorHint/emptyTextEditorHintTypes.js";
const EDITOR_DICTATION_IN_PROGRESS = new RawContextKey("editorDictation.inProgress", false);
const VOICE_CATEGORY = localize2("voiceCategory", "Voice");
const BuiltinDictationConfigured = ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.speechToTextConfigured);
class EditorDictationStartAction extends EditorAction2 {
  static {
    this.ID = "workbench.action.editorDictation.start";
  }
  constructor() {
    super({
      id: EditorDictationStartAction.ID,
      title: localize2("startDictation", "Start Dictation in Editor"),
      category: VOICE_CATEGORY,
      precondition: ContextKeyExpr.and(
        // Available either through the built-in on-device engine or the
        // speech extension's provider.
        ContextKeyExpr.or(HasSpeechProvider, BuiltinDictationConfigured),
        // Keep the toggle available for editor dictation, but not unrelated speech-to-text sessions.
        ContextKeyExpr.or(SpeechToTextInProgress.toNegated(), EDITOR_DICTATION_IN_PROGRESS),
        EditorContextKeys.readOnly.toNegated()
        // disable in read-only editors
      ),
      f1: true,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyV,
        weight: KeybindingWeight.WorkbenchContrib,
        secondary: isWindows ? [
          KeyMod.Alt | KeyCode.Backquote
        ] : void 0
      }
    });
  }
  runEditorCommand(accessor, editor) {
    const dictation = EditorDictation.get(editor);
    if (dictation?.isInProgress()) {
      dictation.stop();
      return;
    }
    const keybindingService = accessor.get(IKeybindingService);
    const holdMode = keybindingService.enableKeybindingHoldMode(this.desc.id);
    if (holdMode) {
      let shouldCallStop = false;
      const handle = setTimeout(() => {
        shouldCallStop = true;
      }, 500);
      holdMode.finally(() => {
        clearTimeout(handle);
        if (shouldCallStop) {
          EditorDictation.get(editor)?.stop();
        }
      });
    }
    EditorDictation.get(editor)?.start();
  }
}
class EditorDictationStopAction extends EditorAction2 {
  static {
    this.ID = "workbench.action.editorDictation.stop";
  }
  constructor() {
    super({
      id: EditorDictationStopAction.ID,
      title: localize2("stopDictation", "Stop Dictation in Editor"),
      category: VOICE_CATEGORY,
      precondition: EDITOR_DICTATION_IN_PROGRESS,
      f1: true
    });
  }
  runEditorCommand(_accessor, editor) {
    EditorDictation.get(editor)?.stop();
  }
}
class DictationWidget extends Disposable {
  constructor(editor, keybindingService) {
    super();
    this.editor = editor;
    this.suppressMouseDown = true;
    this.allowEditorOverflow = true;
    this.domNode = document.createElement("div");
    const actionBar = this._register(new ActionBar(this.domNode));
    const stopActionKeybinding = keybindingService.lookupKeybinding(EditorDictationStartAction.ID)?.getLabel();
    actionBar.push(toAction({
      id: EditorDictationStopAction.ID,
      label: stopActionKeybinding ? localize("stopDictationShort1", "Stop Dictation ({0})", stopActionKeybinding) : localize("stopDictationShort2", "Stop Dictation"),
      class: ThemeIcon.asClassName(Codicon.micFilled),
      run: () => EditorDictation.get(editor)?.stop()
    }), { icon: true, label: false, keybinding: stopActionKeybinding });
    this.domNode.classList.add("editor-dictation-widget");
    this.domNode.appendChild(actionBar.domNode);
  }
  getId() {
    return "editorDictation";
  }
  getDomNode() {
    return this.domNode;
  }
  getPosition() {
    if (!this.editor.hasModel()) {
      return null;
    }
    const selection = this.editor.getSelection();
    return {
      position: selection.getPosition(),
      preference: [
        selection.getPosition().equals(selection.getStartPosition()) ? ContentWidgetPositionPreference.ABOVE : ContentWidgetPositionPreference.BELOW,
        ContentWidgetPositionPreference.EXACT
      ]
    };
  }
  beforeRender() {
    const position = this.editor.getPosition();
    const lineHeight = position ? this.editor.getLineHeightForPosition(position) : this.editor.getOption(EditorOption.lineHeight);
    const width = this.editor.getLayoutInfo().contentWidth * 0.7;
    this.domNode.style.setProperty("--vscode-editor-dictation-widget-height", `${lineHeight}px`);
    this.domNode.style.setProperty("--vscode-editor-dictation-widget-width", `${width}px`);
    return null;
  }
  show() {
    this.editor.addContentWidget(this);
  }
  layout() {
    this.editor.layoutContentWidget(this);
  }
  active() {
    this.domNode.classList.add("recording");
  }
  hide() {
    this.domNode.classList.remove("recording");
    this.editor.removeContentWidget(this);
  }
}
let EditorDictation = class extends Disposable {
  constructor(editor, speechService, chatSpeechToTextService, logService, contextKeyService, keybindingService) {
    super();
    this.editor = editor;
    this.speechService = speechService;
    this.chatSpeechToTextService = chatSpeechToTextService;
    this.logService = logService;
    this.sessionDisposables = this._register(new MutableDisposable());
    this.widget = this._register(new DictationWidget(this.editor, keybindingService));
    this.editorDictationInProgress = EDITOR_DICTATION_IN_PROGRESS.bindTo(contextKeyService);
  }
  static {
    this.ID = "editorDictation";
  }
  static get(editor) {
    return editor.getContribution(EditorDictation.ID);
  }
  /** True while a dictation session is active in this editor. */
  isInProgress() {
    return !!this.editorDictationInProgress.get();
  }
  async start() {
    this.editor.getContribution(EmptyTextEditorHintContributionId)?.disposeHint();
    if (this.chatSpeechToTextService.isConfigured) {
      return this.startBuiltin();
    }
    return this.startWithProvider();
  }
  /**
   * Run editor dictation through the built-in on-device engine, reusing the
   * shared chat dictation renderer (live transcript, interim styling, and
   * "Listening…" placeholder). A floating stop widget is shown so the mic can
   * be stopped by mouse as well as by toggling the start keybinding.
   */
  async startBuiltin() {
    const disposables = new DisposableStore();
    this.sessionDisposables.value = disposables;
    this.widget.show();
    this.widget.active();
    disposables.add(toDisposable(() => this.widget.hide()));
    this.editorDictationInProgress.set(true);
    disposables.add(toDisposable(() => this.editorDictationInProgress.reset()));
    disposables.add(this.editor.onDidChangeCursorPosition(() => this.widget.layout()));
    const window = getWindow(this.editor.getDomNode()) ?? getActiveWindow();
    await startDictation(this.chatSpeechToTextService, this.editor, window, this.logService, "editor");
    if (activeDictationEditor() !== this.editor) {
      this.sessionDisposables.clear();
      return;
    }
    disposables.add(this.chatSpeechToTextService.onDidChangeState((state) => {
      if (state === ChatSpeechToTextState.Idle) {
        this.sessionDisposables.clear();
      }
    }));
  }
  async startWithProvider() {
    const disposables = new DisposableStore();
    this.sessionDisposables.value = disposables;
    this.widget.show();
    disposables.add(toDisposable(() => this.widget.hide()));
    this.editorDictationInProgress.set(true);
    disposables.add(toDisposable(() => this.editorDictationInProgress.reset()));
    const collection = this.editor.createDecorationsCollection();
    disposables.add(toDisposable(() => collection.clear()));
    disposables.add(this.editor.onDidChangeCursorPosition(() => this.widget.layout()));
    let previewStart = void 0;
    let lastReplaceTextLength = 0;
    const replaceText = (text, isPreview) => {
      if (!previewStart) {
        previewStart = assertReturnsDefined(this.editor.getPosition());
      }
      const endPosition = new Position(previewStart.lineNumber, previewStart.column + text.length);
      this.editor.executeEdits(EditorDictation.ID, [
        EditOperation.replace(Range.fromPositions(previewStart, previewStart.with(void 0, previewStart.column + lastReplaceTextLength)), text)
      ], [
        Selection.fromPositions(endPosition)
      ]);
      if (isPreview) {
        collection.set([
          {
            range: Range.fromPositions(previewStart, previewStart.with(void 0, previewStart.column + text.length)),
            options: {
              description: "editor-dictation-preview",
              inlineClassName: "ghost-text-decoration-preview"
            }
          }
        ]);
      } else {
        collection.clear();
      }
      lastReplaceTextLength = text.length;
      if (!isPreview) {
        previewStart = void 0;
        lastReplaceTextLength = 0;
      }
      this.editor.revealPositionInCenterIfOutsideViewport(endPosition);
    };
    const cts = new CancellationTokenSource();
    disposables.add(toDisposable(() => cts.dispose(true)));
    const session = await this.speechService.createSpeechToTextSession(cts.token, "editor");
    disposables.add(session.onDidChange((e) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      switch (e.status) {
        case SpeechToTextStatus.Started:
          this.widget.active();
          break;
        case SpeechToTextStatus.Stopped:
          disposables.dispose();
          break;
        case SpeechToTextStatus.Recognizing: {
          if (!e.text) {
            return;
          }
          replaceText(e.text, true);
          break;
        }
        case SpeechToTextStatus.Recognized: {
          if (!e.text) {
            return;
          }
          replaceText(`${e.text} `, false);
          break;
        }
      }
    }));
  }
  stop() {
    if (isDictating() && activeDictationEditor() === this.editor) {
      stopDictation();
      return;
    }
    this.sessionDisposables.clear();
  }
};
EditorDictation = __decorateClass([
  __decorateParam(1, ISpeechService),
  __decorateParam(2, IChatSpeechToTextService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IKeybindingService)
], EditorDictation);
registerEditorContribution(EditorDictation.ID, EditorDictation, EditorContributionInstantiation.Lazy);
registerAction2(EditorDictationStartAction);
registerAction2(EditorDictationStopAction);
export {
  DictationWidget,
  EditorDictation,
  EditorDictationStartAction,
  EditorDictationStopAction
};
