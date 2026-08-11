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
import { isHTMLElement } from "../../../../../base/browser/dom.js";
import { createTrustedTypesPolicy } from "../../../../../base/browser/trustedTypes.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { createBareFontInfoFromRawSettings } from "../../../../common/config/fontInfoFromSettings.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../common/languages/modesRegistry.js";
import { tokenizeToString } from "../../../../common/languages/textToHtmlTokenizer.js";
import { applyFontInfo } from "../../../config/domFontInfo.js";
import { isCodeEditor } from "../../../editorBrowser.js";
import "./renderedMarkdown.css";
let EditorMarkdownCodeBlockRenderer = class {
  constructor(_configurationService, _languageService) {
    this._configurationService = _configurationService;
    this._languageService = _languageService;
  }
  static {
    this._ttpTokenizer = createTrustedTypesPolicy("tokenizeToString", {
      createHTML(html) {
        return html;
      }
    });
  }
  async renderCodeBlock(languageAlias, value, options) {
    const editor = isCodeEditor(options.context) ? options.context : void 0;
    let languageId;
    if (languageAlias) {
      languageId = this._languageService.getLanguageIdByLanguageName(languageAlias);
    } else if (editor) {
      languageId = editor.getModel()?.getLanguageId();
    }
    if (!languageId) {
      languageId = PLAINTEXT_LANGUAGE_ID;
    }
    const html = await tokenizeToString(this._languageService, value, languageId);
    const content = EditorMarkdownCodeBlockRenderer._ttpTokenizer ? EditorMarkdownCodeBlockRenderer._ttpTokenizer.createHTML(html) ?? html : html;
    const root = document.createElement("span");
    root.innerHTML = content;
    const codeElement = root.querySelector(".monaco-tokenized-source");
    if (!isHTMLElement(codeElement)) {
      return document.createElement("span");
    }
    applyFontInfo(codeElement, this.getFontInfo(editor));
    return root;
  }
  getFontInfo(editor) {
    if (editor) {
      return editor.getOption(EditorOption.fontInfo);
    } else {
      return createBareFontInfoFromRawSettings({
        fontFamily: this._configurationService.getValue("editor").fontFamily
      }, 1);
    }
  }
};
EditorMarkdownCodeBlockRenderer = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ILanguageService)
], EditorMarkdownCodeBlockRenderer);
export {
  EditorMarkdownCodeBlockRenderer
};
