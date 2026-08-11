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
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { EditorContributionInstantiation, EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { MenuPreventer } from "../../codeEditor/browser/menuPreventer.js";
import { EditorDictation } from "../../codeEditor/browser/dictation/editorDictation.js";
import { ContextMenuController } from "../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { TabCompletionController } from "../../snippets/browser/tabCompletion.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { ILanguageConfigurationService } from "../../../../editor/common/languages/languageConfigurationRegistry.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { clamp } from "../../../../base/common/numbers.js";
import { CopyPasteController } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { CodeActionController } from "../../../../editor/contrib/codeAction/browser/codeActionController.js";
import { DropIntoEditorController } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import { InlineCompletionsController } from "../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
import { LinkDetector } from "../../../../editor/contrib/links/browser/links.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import { SelectionClipboardContributionID } from "../../codeEditor/browser/selectionClipboard.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { ContentHoverController } from "../../../../editor/contrib/hover/browser/contentHoverController.js";
import { GlyphHoverController } from "../../../../editor/contrib/hover/browser/glyphHoverController.js";
import { PlaceholderTextContribution } from "../../../../editor/contrib/placeholderText/browser/placeholderTextContribution.js";
import { IUserInteractionService } from "../../../../platform/userInteraction/browser/userInteractionService.js";
const ctxCommentEditorFocused = new RawContextKey("commentEditorFocused", false);
const MIN_EDITOR_HEIGHT = 5 * 18;
const MAX_EDITOR_HEIGHT = 25 * 18;
let SimpleCommentEditor = class extends CodeEditorWidget {
  constructor(domElement, options, scopedContextKeyService, parentThread, instantiationService, codeEditorService, commandService, themeService, notificationService, accessibilityService, languageConfigurationService, languageFeaturesService, userInteractionService) {
    const codeEditorWidgetOptions = {
      contributions: [
        { id: MenuPreventer.ID, ctor: MenuPreventer, instantiation: EditorContributionInstantiation.BeforeFirstInteraction },
        { id: ContextMenuController.ID, ctor: ContextMenuController, instantiation: EditorContributionInstantiation.BeforeFirstInteraction },
        { id: SuggestController.ID, ctor: SuggestController, instantiation: EditorContributionInstantiation.Eager },
        { id: SnippetController2.ID, ctor: SnippetController2, instantiation: EditorContributionInstantiation.Lazy },
        { id: TabCompletionController.ID, ctor: TabCompletionController, instantiation: EditorContributionInstantiation.Eager },
        // eager because it needs to define a context key
        { id: EditorDictation.ID, ctor: EditorDictation, instantiation: EditorContributionInstantiation.Lazy },
        ...EditorExtensionsRegistry.getSomeEditorContributions([
          CopyPasteController.ID,
          DropIntoEditorController.ID,
          LinkDetector.ID,
          MessageController.ID,
          ContentHoverController.ID,
          GlyphHoverController.ID,
          SelectionClipboardContributionID,
          InlineCompletionsController.ID,
          CodeActionController.ID,
          PlaceholderTextContribution.ID
        ])
      ],
      contextMenuId: MenuId.SimpleEditorContext
    };
    super(domElement, options, codeEditorWidgetOptions, instantiationService, codeEditorService, commandService, scopedContextKeyService, themeService, notificationService, accessibilityService, languageConfigurationService, languageFeaturesService, userInteractionService);
    this._commentEditorFocused = ctxCommentEditorFocused.bindTo(scopedContextKeyService);
    this._commentEditorEmpty = CommentContextKeys.commentIsEmpty.bindTo(scopedContextKeyService);
    this._commentEditorEmpty.set(!this.getModel()?.getValueLength());
    this._parentThread = parentThread;
    this._register(this.onDidFocusEditorWidget((_) => this._commentEditorFocused.set(true)));
    this._register(this.onDidChangeModelContent((e) => this._commentEditorEmpty.set(!this.getModel()?.getValueLength())));
    this._register(this.onDidBlurEditorWidget((_) => this._commentEditorFocused.reset()));
  }
  getParentThread() {
    return this._parentThread;
  }
  _getActions() {
    return EditorExtensionsRegistry.getEditorActions();
  }
  updateOptions(newOptions) {
    const withLineNumberRemoved = { ...newOptions, lineNumbers: "off" };
    super.updateOptions(withLineNumberRemoved);
  }
  static getEditorOptions(configurationService) {
    return {
      wordWrap: "on",
      glyphMargin: false,
      lineNumbers: "off",
      folding: false,
      selectOnLineNumbers: false,
      scrollbar: {
        vertical: "visible",
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: false
      },
      overviewRulerLanes: 2,
      lineDecorationsWidth: 0,
      scrollBeyondLastLine: false,
      renderLineHighlight: "none",
      fixedOverflowWidgets: true,
      acceptSuggestionOnEnter: "smart",
      minimap: {
        enabled: false
      },
      dropIntoEditor: { enabled: true },
      autoClosingBrackets: configurationService.getValue("editor.autoClosingBrackets"),
      quickSuggestions: false,
      accessibilitySupport: configurationService.getValue("editor.accessibilitySupport"),
      fontFamily: configurationService.getValue("editor.fontFamily"),
      fontSize: configurationService.getValue("editor.fontSize"),
      allowVariableLineHeights: false
    };
  }
};
SimpleCommentEditor = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICodeEditorService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IAccessibilityService),
  __decorateParam(10, ILanguageConfigurationService),
  __decorateParam(11, ILanguageFeaturesService),
  __decorateParam(12, IUserInteractionService)
], SimpleCommentEditor);
function calculateEditorHeight(parentEditor, editor, currentHeight) {
  const layoutInfo = editor.getLayoutInfo();
  const lineHeight = editor.getOption(EditorOption.lineHeight);
  const contentHeight = editor._getViewModel()?.getLineCount() * lineHeight;
  if (contentHeight > layoutInfo.height || contentHeight < layoutInfo.height && currentHeight > MIN_EDITOR_HEIGHT) {
    const linesToAdd = Math.ceil((contentHeight - layoutInfo.height) / lineHeight);
    const proposedHeight = layoutInfo.height + lineHeight * linesToAdd;
    return clamp(proposedHeight, MIN_EDITOR_HEIGHT, clamp(parentEditor.getLayoutInfo().height - 90, MIN_EDITOR_HEIGHT, MAX_EDITOR_HEIGHT));
  }
  return currentHeight;
}
export {
  MAX_EDITOR_HEIGHT,
  MIN_EDITOR_HEIGHT,
  SimpleCommentEditor,
  calculateEditorHeight,
  ctxCommentEditorFocused
};
