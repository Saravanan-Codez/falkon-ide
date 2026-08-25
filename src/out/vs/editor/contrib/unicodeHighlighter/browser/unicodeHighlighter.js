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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { createCommandUri, MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { InvisibleCharacters, isBasicASCII } from "../../../../base/common/strings.js";
import "./unicodeHighlighter.css";
import { EditorAction, EditorContributionInstantiation, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { inUntrustedWorkspace, EditorOption, unicodeHighlightConfigKeys } from "../../../common/config/editorOptions.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { UnicodeHighlighterReasonKind, UnicodeTextModelHighlighter } from "../../../common/services/unicodeTextModelHighlighter.js";
import { IEditorWorkerService } from "../../../common/services/editorWorker.js";
import { HoverAnchorType, HoverParticipantRegistry } from "../../hover/browser/hoverTypes.js";
import { MarkdownHover, renderMarkdownHovers } from "../../hover/browser/markdownHoverParticipant.js";
import { BannerController } from "./bannerController.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { safeIntl } from "../../../../base/common/date.js";
import { isModelDecorationInComment, isModelDecorationInString, isModelDecorationVisible } from "../../../common/viewModel/viewModelDecoration.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
const warningIcon = registerIcon("extensions-warning-message", Codicon.warning, nls.localize("warningIcon", "Icon shown with a warning message in the extensions editor."));
let UnicodeHighlighter = class extends Disposable {
  constructor(_editor, _editorWorkerService, _workspaceTrustService, instantiationService) {
    super();
    this._editor = _editor;
    this._editorWorkerService = _editorWorkerService;
    this._workspaceTrustService = _workspaceTrustService;
    this._highlighter = null;
    this._bannerClosed = false;
    this._updateState = (state) => {
      if (state && state.hasMore) {
        if (this._bannerClosed) {
          return;
        }
        const max = Math.max(state.ambiguousCharacterCount, state.nonBasicAsciiCharacterCount, state.invisibleCharacterCount);
        let data;
        if (state.nonBasicAsciiCharacterCount >= max) {
          data = {
            message: nls.localize("unicodeHighlighting.thisDocumentHasManyNonBasicAsciiUnicodeCharacters", "This document contains many non-basic ASCII unicode characters"),
            command: new DisableHighlightingOfNonBasicAsciiCharactersAction()
          };
        } else if (state.ambiguousCharacterCount >= max) {
          data = {
            message: nls.localize("unicodeHighlighting.thisDocumentHasManyAmbiguousUnicodeCharacters", "This document contains many ambiguous unicode characters"),
            command: new DisableHighlightingOfAmbiguousCharactersAction()
          };
        } else if (state.invisibleCharacterCount >= max) {
          data = {
            message: nls.localize("unicodeHighlighting.thisDocumentHasManyInvisibleUnicodeCharacters", "This document contains many invisible unicode characters"),
            command: new DisableHighlightingOfInvisibleCharactersAction()
          };
        } else {
          throw new Error("Unreachable");
        }
        this._bannerController.show({
          id: "unicodeHighlightBanner",
          message: data.message,
          icon: warningIcon,
          actions: [
            {
              label: data.command.shortLabel,
              href: `command:${data.command.desc.id}`
            }
          ],
          onClose: () => {
            this._bannerClosed = true;
          }
        });
      } else {
        this._bannerController.hide();
      }
    };
    this._bannerController = this._register(instantiationService.createInstance(BannerController, _editor));
    this._register(this._editor.onDidChangeModel(() => {
      this._bannerClosed = false;
      this._updateHighlighter();
    }));
    this._options = _editor.getOption(EditorOption.unicodeHighlighting);
    this._register(_workspaceTrustService.onDidChangeTrust((e) => {
      this._updateHighlighter();
    }));
    this._register(_editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.unicodeHighlighting)) {
        this._options = _editor.getOption(EditorOption.unicodeHighlighting);
        this._updateHighlighter();
      }
    }));
    this._updateHighlighter();
  }
  static {
    this.ID = "editor.contrib.unicodeHighlighter";
  }
  dispose() {
    if (this._highlighter) {
      this._highlighter.dispose();
      this._highlighter = null;
    }
    super.dispose();
  }
  _updateHighlighter() {
    this._updateState(null);
    if (this._highlighter) {
      this._highlighter.dispose();
      this._highlighter = null;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    const options = resolveOptions(this._workspaceTrustService.isWorkspaceTrusted(), this._options);
    if ([
      options.nonBasicASCII,
      options.ambiguousCharacters,
      options.invisibleCharacters
    ].every((option) => option === false)) {
      return;
    }
    const highlightOptions = {
      nonBasicASCII: options.nonBasicASCII,
      ambiguousCharacters: options.ambiguousCharacters,
      invisibleCharacters: options.invisibleCharacters,
      includeComments: options.includeComments,
      includeStrings: options.includeStrings,
      allowedCodePoints: Object.keys(options.allowedCharacters).map((c) => c.codePointAt(0)),
      allowedLocales: Object.keys(options.allowedLocales).map((locale) => {
        if (locale === "_os") {
          const osLocale = safeIntl.NumberFormat().value.resolvedOptions().locale;
          return osLocale;
        } else if (locale === "_vscode") {
          return platform.language;
        }
        return locale;
      })
    };
    if (this._editorWorkerService.canComputeUnicodeHighlights(this._editor.getModel().uri)) {
      this._highlighter = new DocumentUnicodeHighlighter(this._editor, highlightOptions, this._updateState, this._editorWorkerService);
    } else {
      this._highlighter = new ViewportUnicodeHighlighter(this._editor, highlightOptions, this._updateState);
    }
  }
  getDecorationInfo(decoration) {
    if (this._highlighter) {
      return this._highlighter.getDecorationInfo(decoration);
    }
    return null;
  }
};
UnicodeHighlighter = __decorateClass([
  __decorateParam(1, IEditorWorkerService),
  __decorateParam(2, IWorkspaceTrustManagementService),
  __decorateParam(3, IInstantiationService)
], UnicodeHighlighter);
function resolveOptions(trusted, options) {
  return {
    nonBasicASCII: options.nonBasicASCII === inUntrustedWorkspace ? !trusted : options.nonBasicASCII,
    ambiguousCharacters: options.ambiguousCharacters,
    invisibleCharacters: options.invisibleCharacters,
    includeComments: options.includeComments === inUntrustedWorkspace ? !trusted : options.includeComments,
    includeStrings: options.includeStrings === inUntrustedWorkspace ? !trusted : options.includeStrings,
    allowedCharacters: options.allowedCharacters,
    allowedLocales: options.allowedLocales
  };
}
let DocumentUnicodeHighlighter = class extends Disposable {
  constructor(_editor, _options, _updateState, _editorWorkerService) {
    super();
    this._editor = _editor;
    this._options = _options;
    this._updateState = _updateState;
    this._editorWorkerService = _editorWorkerService;
    this._model = this._editor.getModel();
    this._decorations = this._editor.createDecorationsCollection();
    this._updateSoon = this._register(new RunOnceScheduler(() => this._update(), 250));
    this._register(this._editor.onDidChangeModelContent(() => {
      this._updateSoon.schedule();
    }));
    this._updateSoon.schedule();
  }
  dispose() {
    this._decorations.clear();
    super.dispose();
  }
  _update() {
    if (this._model.isDisposed()) {
      return;
    }
    if (!this._model.mightContainNonBasicASCII()) {
      this._decorations.clear();
      return;
    }
    const modelVersionId = this._model.getVersionId();
    this._editorWorkerService.computedUnicodeHighlights(this._model.uri, this._options).then((info) => {
      if (this._model.isDisposed()) {
        return;
      }
      if (this._model.getVersionId() !== modelVersionId) {
        return;
      }
      this._updateState(info);
      const decorations = [];
      if (!info.hasMore) {
        for (const range of info.ranges) {
          decorations.push({
            range,
            options: Decorations.instance.getDecorationFromOptions(this._options)
          });
        }
      }
      this._decorations.set(decorations);
    });
  }
  getDecorationInfo(decoration) {
    if (!this._decorations.has(decoration)) {
      return null;
    }
    const model = this._editor.getModel();
    if (!isModelDecorationVisible(model, decoration)) {
      return null;
    }
    const text = model.getValueInRange(decoration.range);
    return {
      reason: computeReason(text, this._options),
      inComment: isModelDecorationInComment(model, decoration),
      inString: isModelDecorationInString(model, decoration)
    };
  }
};
DocumentUnicodeHighlighter = __decorateClass([
  __decorateParam(3, IEditorWorkerService)
], DocumentUnicodeHighlighter);
class ViewportUnicodeHighlighter extends Disposable {
  constructor(_editor, _options, _updateState) {
    super();
    this._editor = _editor;
    this._options = _options;
    this._updateState = _updateState;
    this._model = this._editor.getModel();
    this._decorations = this._editor.createDecorationsCollection();
    this._updateSoon = this._register(new RunOnceScheduler(() => this._update(), 250));
    this._register(this._editor.onDidLayoutChange(() => {
      this._updateSoon.schedule();
    }));
    this._register(this._editor.onDidScrollChange(() => {
      this._updateSoon.schedule();
    }));
    this._register(this._editor.onDidChangeHiddenAreas(() => {
      this._updateSoon.schedule();
    }));
    this._register(this._editor.onDidChangeModelContent(() => {
      this._updateSoon.schedule();
    }));
    this._updateSoon.schedule();
  }
  dispose() {
    this._decorations.clear();
    super.dispose();
  }
  _update() {
    if (this._model.isDisposed()) {
      return;
    }
    if (!this._model.mightContainNonBasicASCII()) {
      this._decorations.clear();
      return;
    }
    const ranges = this._editor.getVisibleRanges();
    const decorations = [];
    const totalResult = {
      ranges: [],
      ambiguousCharacterCount: 0,
      invisibleCharacterCount: 0,
      nonBasicAsciiCharacterCount: 0,
      hasMore: false
    };
    for (const range of ranges) {
      const result = UnicodeTextModelHighlighter.computeUnicodeHighlights(this._model, this._options, range);
      for (const r of result.ranges) {
        totalResult.ranges.push(r);
      }
      totalResult.ambiguousCharacterCount += totalResult.ambiguousCharacterCount;
      totalResult.invisibleCharacterCount += totalResult.invisibleCharacterCount;
      totalResult.nonBasicAsciiCharacterCount += totalResult.nonBasicAsciiCharacterCount;
      totalResult.hasMore = totalResult.hasMore || result.hasMore;
    }
    if (!totalResult.hasMore) {
      for (const range of totalResult.ranges) {
        decorations.push({ range, options: Decorations.instance.getDecorationFromOptions(this._options) });
      }
    }
    this._updateState(totalResult);
    this._decorations.set(decorations);
  }
  getDecorationInfo(decoration) {
    if (!this._decorations.has(decoration)) {
      return null;
    }
    const model = this._editor.getModel();
    const text = model.getValueInRange(decoration.range);
    if (!isModelDecorationVisible(model, decoration)) {
      return null;
    }
    return {
      reason: computeReason(text, this._options),
      inComment: isModelDecorationInComment(model, decoration),
      inString: isModelDecorationInString(model, decoration)
    };
  }
}
class UnicodeHighlighterHover {
  constructor(owner, range, decoration) {
    this.owner = owner;
    this.range = range;
    this.decoration = decoration;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && this.range.startColumn <= anchor.range.startColumn && this.range.endColumn >= anchor.range.endColumn;
  }
}
const configureUnicodeHighlightOptionsStr = nls.localize("unicodeHighlight.configureUnicodeHighlightOptions", "Configure Unicode Highlight Options");
let UnicodeHighlighterHoverParticipant = class {
  constructor(_editor, _markdownRendererService) {
    this._editor = _editor;
    this._markdownRendererService = _markdownRendererService;
    this.hoverOrdinal = 5;
  }
  computeSync(anchor, lineDecorations) {
    if (!this._editor.hasModel() || anchor.type !== HoverAnchorType.Range) {
      return [];
    }
    const model = this._editor.getModel();
    const unicodeHighlighter = this._editor.getContribution(UnicodeHighlighter.ID);
    if (!unicodeHighlighter) {
      return [];
    }
    const result = [];
    const existedReason = /* @__PURE__ */ new Set();
    let index = 300;
    for (const d of lineDecorations) {
      const highlightInfo = unicodeHighlighter.getDecorationInfo(d);
      if (!highlightInfo) {
        continue;
      }
      const char = model.getValueInRange(d.range);
      const codePoint = char.codePointAt(0);
      const codePointStr = formatCodePointMarkdown(codePoint);
      let reason;
      switch (highlightInfo.reason.kind) {
        case UnicodeHighlighterReasonKind.Ambiguous: {
          if (isBasicASCII(highlightInfo.reason.confusableWith)) {
            reason = nls.localize(
              "unicodeHighlight.characterIsAmbiguousASCII",
              "The character {0} could be confused with the ASCII character {1}, which is more common in source code.",
              codePointStr,
              formatCodePointMarkdown(highlightInfo.reason.confusableWith.codePointAt(0))
            );
          } else {
            reason = nls.localize(
              "unicodeHighlight.characterIsAmbiguous",
              "The character {0} could be confused with the character {1}, which is more common in source code.",
              codePointStr,
              formatCodePointMarkdown(highlightInfo.reason.confusableWith.codePointAt(0))
            );
          }
          break;
        }
        case UnicodeHighlighterReasonKind.Invisible:
          reason = nls.localize(
            "unicodeHighlight.characterIsInvisible",
            "The character {0} is invisible.",
            codePointStr
          );
          break;
        case UnicodeHighlighterReasonKind.NonBasicAscii:
          reason = nls.localize(
            "unicodeHighlight.characterIsNonBasicAscii",
            "The character {0} is not a basic ASCII character.",
            codePointStr
          );
          break;
      }
      if (existedReason.has(reason)) {
        continue;
      }
      existedReason.add(reason);
      const adjustSettingsArgs = {
        codePoint,
        reason: highlightInfo.reason,
        inComment: highlightInfo.inComment,
        inString: highlightInfo.inString
      };
      const adjustSettings = nls.localize("unicodeHighlight.adjustSettings", "Adjust settings");
      const uri = createCommandUri(ShowExcludeOptions.ID, adjustSettingsArgs);
      const markdown = new MarkdownString("", true).appendMarkdown(reason).appendText(" ").appendLink(uri, adjustSettings, configureUnicodeHighlightOptionsStr);
      result.push(new MarkdownHover(this, d.range, [markdown], false, index++));
    }
    return result;
  }
  renderHoverParts(context, hoverParts) {
    return renderMarkdownHovers(context, hoverParts, this._editor, this._markdownRendererService);
  }
  getAccessibleContent(hoverPart) {
    return hoverPart.contents.map((c) => c.value).join("\n");
  }
};
UnicodeHighlighterHoverParticipant = __decorateClass([
  __decorateParam(1, IMarkdownRendererService)
], UnicodeHighlighterHoverParticipant);
function codePointToHex(codePoint) {
  return `U+${codePoint.toString(16).padStart(4, "0")}`;
}
function formatCodePointMarkdown(codePoint) {
  let value = `\`${codePointToHex(codePoint)}\``;
  if (!InvisibleCharacters.isInvisibleCharacter(codePoint)) {
    value += ` "${`${renderCodePointAsInlineCode(codePoint)}`}"`;
  }
  return value;
}
function renderCodePointAsInlineCode(codePoint) {
  if (codePoint === CharCode.BackTick) {
    return "`` ` ``";
  }
  return "`" + String.fromCodePoint(codePoint) + "`";
}
function computeReason(char, options) {
  return UnicodeTextModelHighlighter.computeUnicodeHighlightReason(char, options);
}
class Decorations {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  static {
    this.instance = new Decorations();
  }
  getDecorationFromOptions(options) {
    return this.getDecoration(!options.includeComments, !options.includeStrings);
  }
  getDecoration(hideInComments, hideInStrings) {
    const key = `${hideInComments}${hideInStrings}`;
    let options = this.map.get(key);
    if (!options) {
      options = ModelDecorationOptions.createDynamic({
        description: "unicode-highlight",
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        className: "unicode-highlight",
        showIfCollapsed: true,
        overviewRuler: null,
        minimap: null,
        hideInCommentTokens: hideInComments,
        hideInStringTokens: hideInStrings
      });
      this.map.set(key, options);
    }
    return options;
  }
}
class DisableHighlightingInCommentsAction extends EditorAction {
  constructor() {
    super({
      id: DisableHighlightingOfAmbiguousCharactersAction.ID,
      label: nls.localize2("action.unicodeHighlight.disableHighlightingInComments", "Disable highlighting of characters in comments"),
      precondition: void 0
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingInComments.shortLabel", "Disable Highlight In Comments");
  }
  static {
    this.ID = "editor.action.unicodeHighlight.disableHighlightingInComments";
  }
  async run(accessor, editor) {
    const configurationService = accessor.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.includeComments, false, ConfigurationTarget.USER);
  }
}
class DisableHighlightingInStringsAction extends EditorAction {
  constructor() {
    super({
      id: DisableHighlightingOfAmbiguousCharactersAction.ID,
      label: nls.localize2("action.unicodeHighlight.disableHighlightingInStrings", "Disable highlighting of characters in strings"),
      precondition: void 0
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingInStrings.shortLabel", "Disable Highlight In Strings");
  }
  static {
    this.ID = "editor.action.unicodeHighlight.disableHighlightingInStrings";
  }
  async run(accessor, editor) {
    const configurationService = accessor.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.includeStrings, false, ConfigurationTarget.USER);
  }
}
class DisableHighlightingOfAmbiguousCharactersAction extends Action2 {
  constructor() {
    super({
      id: DisableHighlightingOfAmbiguousCharactersAction.ID,
      title: nls.localize2("action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters", "Disable highlighting of ambiguous characters"),
      precondition: void 0,
      f1: false
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingOfAmbiguousCharacters.shortLabel", "Disable Ambiguous Highlight");
  }
  static {
    this.ID = "editor.action.unicodeHighlight.disableHighlightingOfAmbiguousCharacters";
  }
  async run(accessor, editor) {
    const configurationService = accessor.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.ambiguousCharacters, false, ConfigurationTarget.USER);
  }
}
class DisableHighlightingOfInvisibleCharactersAction extends Action2 {
  constructor() {
    super({
      id: DisableHighlightingOfInvisibleCharactersAction.ID,
      title: nls.localize2("action.unicodeHighlight.disableHighlightingOfInvisibleCharacters", "Disable highlighting of invisible characters"),
      precondition: void 0,
      f1: false
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingOfInvisibleCharacters.shortLabel", "Disable Invisible Highlight");
  }
  static {
    this.ID = "editor.action.unicodeHighlight.disableHighlightingOfInvisibleCharacters";
  }
  async run(accessor, editor) {
    const configurationService = accessor.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.invisibleCharacters, false, ConfigurationTarget.USER);
  }
}
class DisableHighlightingOfNonBasicAsciiCharactersAction extends Action2 {
  constructor() {
    super({
      id: DisableHighlightingOfNonBasicAsciiCharactersAction.ID,
      title: nls.localize2("action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters", "Disable highlighting of non basic ASCII characters"),
      precondition: void 0,
      f1: false
    });
    this.shortLabel = nls.localize("unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters.shortLabel", "Disable Non ASCII Highlight");
  }
  static {
    this.ID = "editor.action.unicodeHighlight.disableHighlightingOfNonBasicAsciiCharacters";
  }
  async run(accessor, editor) {
    const configurationService = accessor.get(IConfigurationService);
    if (configurationService) {
      this.runAction(configurationService);
    }
  }
  async runAction(configurationService) {
    await configurationService.updateValue(unicodeHighlightConfigKeys.nonBasicASCII, false, ConfigurationTarget.USER);
  }
}
class ShowExcludeOptions extends Action2 {
  static {
    this.ID = "editor.action.unicodeHighlight.showExcludeOptions";
  }
  constructor() {
    super({
      id: ShowExcludeOptions.ID,
      title: nls.localize2("action.unicodeHighlight.showExcludeOptions", "Show Exclude Options"),
      precondition: void 0,
      f1: false
    });
  }
  async run(accessor, args) {
    const { codePoint, reason, inString, inComment } = args;
    const char = String.fromCodePoint(codePoint);
    const quickPickService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    function getExcludeCharFromBeingHighlightedLabel(codePoint2) {
      if (InvisibleCharacters.isInvisibleCharacter(codePoint2)) {
        return nls.localize("unicodeHighlight.excludeInvisibleCharFromBeingHighlighted", "Exclude {0} (invisible character) from being highlighted", codePointToHex(codePoint2));
      }
      return nls.localize("unicodeHighlight.excludeCharFromBeingHighlighted", "Exclude {0} from being highlighted", `${codePointToHex(codePoint2)} "${char}"`);
    }
    const options = [];
    if (reason.kind === UnicodeHighlighterReasonKind.Ambiguous) {
      for (const locale of reason.notAmbiguousInLocales) {
        options.push({
          label: nls.localize("unicodeHighlight.allowCommonCharactersInLanguage", 'Allow unicode characters that are more common in the language "{0}".', locale),
          run: async () => {
            excludeLocaleFromBeingHighlighted(configurationService, [locale]);
          }
        });
      }
    }
    options.push(
      {
        label: getExcludeCharFromBeingHighlightedLabel(codePoint),
        run: () => excludeCharFromBeingHighlighted(configurationService, [codePoint])
      }
    );
    if (inComment) {
      const action = new DisableHighlightingInCommentsAction();
      options.push({ label: action.label, run: async () => action.runAction(configurationService) });
    } else if (inString) {
      const action = new DisableHighlightingInStringsAction();
      options.push({ label: action.label, run: async () => action.runAction(configurationService) });
    }
    function getTitle(options2) {
      return typeof options2.desc.title === "string" ? options2.desc.title : options2.desc.title.value;
    }
    if (reason.kind === UnicodeHighlighterReasonKind.Ambiguous) {
      const action = new DisableHighlightingOfAmbiguousCharactersAction();
      options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
    } else if (reason.kind === UnicodeHighlighterReasonKind.Invisible) {
      const action = new DisableHighlightingOfInvisibleCharactersAction();
      options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
    } else if (reason.kind === UnicodeHighlighterReasonKind.NonBasicAscii) {
      const action = new DisableHighlightingOfNonBasicAsciiCharactersAction();
      options.push({ label: getTitle(action), run: async () => action.runAction(configurationService) });
    } else {
      expectNever(reason);
    }
    const result = await quickPickService.pick(
      options,
      { title: configureUnicodeHighlightOptionsStr }
    );
    if (result) {
      await result.run();
    }
  }
}
async function excludeCharFromBeingHighlighted(configurationService, charCodes) {
  const existingValue = configurationService.getValue(unicodeHighlightConfigKeys.allowedCharacters);
  let value;
  if (typeof existingValue === "object" && existingValue) {
    value = existingValue;
  } else {
    value = {};
  }
  for (const charCode of charCodes) {
    value[String.fromCodePoint(charCode)] = true;
  }
  await configurationService.updateValue(unicodeHighlightConfigKeys.allowedCharacters, value, ConfigurationTarget.USER);
}
async function excludeLocaleFromBeingHighlighted(configurationService, locales) {
  const existingValue = configurationService.inspect(unicodeHighlightConfigKeys.allowedLocales).user?.value;
  let value;
  if (typeof existingValue === "object" && existingValue) {
    value = Object.assign({}, existingValue);
  } else {
    value = {};
  }
  for (const locale of locales) {
    value[locale] = true;
  }
  await configurationService.updateValue(unicodeHighlightConfigKeys.allowedLocales, value, ConfigurationTarget.USER);
}
function expectNever(value) {
  throw new Error(`Unexpected value: ${value}`);
}
registerAction2(DisableHighlightingOfAmbiguousCharactersAction);
registerAction2(DisableHighlightingOfInvisibleCharactersAction);
registerAction2(DisableHighlightingOfNonBasicAsciiCharactersAction);
registerAction2(ShowExcludeOptions);
registerEditorContribution(UnicodeHighlighter.ID, UnicodeHighlighter, EditorContributionInstantiation.AfterFirstRender);
HoverParticipantRegistry.register(UnicodeHighlighterHoverParticipant);
export {
  DisableHighlightingInCommentsAction,
  DisableHighlightingInStringsAction,
  DisableHighlightingOfAmbiguousCharactersAction,
  DisableHighlightingOfInvisibleCharactersAction,
  DisableHighlightingOfNonBasicAsciiCharactersAction,
  ShowExcludeOptions,
  UnicodeHighlighter,
  UnicodeHighlighterHover,
  UnicodeHighlighterHoverParticipant,
  warningIcon
};
