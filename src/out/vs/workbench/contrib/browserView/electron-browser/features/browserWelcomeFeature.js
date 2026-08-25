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
import { localize } from "../../../../../nls.js";
import { $ } from "../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../../chat/common/actions/chatContextKeys.js";
import {
  BrowserEditor,
  BrowserEditorContribution,
  BrowserWidgetLocation
} from "../browserEditor.js";
let BrowserWelcomeFeature = class extends BrowserEditorContribution {
  constructor(editor, contextKeyService) {
    super(editor);
    this._container = $(".browser-welcome-container");
    const content = $(".browser-welcome-content");
    const iconContainer = $(".browser-welcome-icon");
    iconContainer.appendChild(renderIcon(Codicon.globe));
    content.appendChild(iconContainer);
    const title = $(".browser-welcome-title");
    title.textContent = localize("browser.welcomeTitle", "Browser");
    content.appendChild(title);
    const subtitle = $(".browser-welcome-subtitle");
    const chatEnabled = contextKeyService.getContextKeyValue(ChatContextKeys.enabled.key);
    subtitle.textContent = chatEnabled ? localize("browser.welcomeSubtitleChat", "Use Add Element to Chat to reference UI elements in chat prompts.") : localize("browser.welcomeSubtitle", "Enter a URL above to get started.");
    content.appendChild(subtitle);
    this._container.appendChild(content);
    this._widget = { location: BrowserWidgetLocation.ContentArea, element: this._container, order: 50 };
  }
  get widgets() {
    return [this._widget];
  }
  prerenderInput(input) {
    this._setVisible(!input.url);
  }
  onModelAttached(model, store) {
    this._setVisible(!model.url);
    store.add(model.onDidNavigate((event) => this._setVisible(!event.url)));
  }
  onModelDetached() {
    this._setVisible(true);
  }
  _setVisible(visible) {
    this._container.style.display = visible ? "" : "none";
  }
};
BrowserWelcomeFeature = __decorateClass([
  __decorateParam(1, IContextKeyService)
], BrowserWelcomeFeature);
BrowserEditor.registerContribution(BrowserWelcomeFeature);
export {
  BrowserWelcomeFeature
};
