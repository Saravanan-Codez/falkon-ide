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
import "../common/walkThroughUtils.js";
import "./media/walkThroughPart.css";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { EventType as TouchEventType, Gesture } from "../../../../base/browser/touch.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import * as strings from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { dispose, toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { WalkThroughInput } from "./walkThroughInput.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { localize } from "../../../../nls.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { RawContextKey, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isObject } from "../../../../base/common/types.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { UILabelProvider } from "../../../../base/common/keybindingLabels.js";
import { OS, OperatingSystem } from "../../../../base/common/platform.js";
import { deepClone } from "../../../../base/common/objects.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { addDisposableListener, isHTMLAnchorElement, isHTMLButtonElement, isHTMLElement, size } from "../../../../base/browser/dom.js";
import * as domSanitize from "../../../../base/browser/domSanitize.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
const WALK_THROUGH_FOCUS = new RawContextKey("interactivePlaygroundFocus", false);
const UNBOUND_COMMAND = localize("walkThrough.unboundCommand", "unbound");
const WALK_THROUGH_EDITOR_VIEW_STATE_PREFERENCE_KEY = "walkThroughEditorViewState";
let WalkThroughPart = class extends EditorPane {
  constructor(group, telemetryService, themeService, textResourceConfigurationService, instantiationService, openerService, keybindingService, storageService, contextKeyService, configurationService, notificationService, extensionService, editorGroupService) {
    super(WalkThroughPart.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.keybindingService = keybindingService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.disposables = new DisposableStore();
    this.contentDisposables = [];
    this.editorFocus = WALK_THROUGH_FOCUS.bindTo(this.contextKeyService);
    this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, WALK_THROUGH_EDITOR_VIEW_STATE_PREFERENCE_KEY);
  }
  static {
    this.ID = "workbench.editor.walkThroughPart";
  }
  createEditor(container) {
    this.content = document.createElement("div");
    this.content.classList.add("welcomePageFocusElement");
    this.content.tabIndex = 0;
    this.content.style.outlineStyle = "none";
    this.scrollbar = new DomScrollableElement(this.content, {
      horizontal: ScrollbarVisibility.Auto,
      vertical: ScrollbarVisibility.Auto
    });
    this.disposables.add(this.scrollbar);
    container.appendChild(this.scrollbar.getDomNode());
    this.registerFocusHandlers();
    this.registerClickHandler();
    this.disposables.add(this.scrollbar.onScroll((e) => this.updatedScrollPosition()));
  }
  updatedScrollPosition() {
    const scrollDimensions = this.scrollbar.getScrollDimensions();
    const scrollPosition = this.scrollbar.getScrollPosition();
    const scrollHeight = scrollDimensions.scrollHeight;
    if (scrollHeight && this.input instanceof WalkThroughInput) {
      const scrollTop = scrollPosition.scrollTop;
      const height = scrollDimensions.height;
      this.input.relativeScrollPosition(scrollTop / scrollHeight, (scrollTop + height) / scrollHeight);
    }
  }
  onTouchChange(event) {
    event.preventDefault();
    event.stopPropagation();
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - event.translationY });
  }
  addEventListener(element, type, listener, useCapture) {
    element.addEventListener(type, listener, useCapture);
    return toDisposable(() => {
      element.removeEventListener(type, listener, useCapture);
    });
  }
  registerFocusHandlers() {
    this.disposables.add(this.addEventListener(this.content, "mousedown", (e) => {
      this.focus();
    }));
    this.disposables.add(this.addEventListener(this.content, "focus", (e) => {
      this.editorFocus.set(true);
    }));
    this.disposables.add(this.addEventListener(this.content, "blur", (e) => {
      this.editorFocus.reset();
    }));
    this.disposables.add(this.addEventListener(this.content, "focusin", (e) => {
      if (isHTMLElement(e.target) && e.target.classList.contains("zone-widget-container")) {
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.content.scrollTop = scrollPosition.scrollTop;
        this.content.scrollLeft = scrollPosition.scrollLeft;
      }
      if (isHTMLElement(e.target)) {
        this.lastFocus = e.target;
      }
    }));
  }
  registerClickHandler() {
    this.disposables.add(this.addEventListener(this.content, "click", (event) => {
      for (let node = event.target; node; node = node.parentNode) {
        if (isHTMLAnchorElement(node) && node.href) {
          const baseElement = node.ownerDocument.getElementsByTagName("base")[0] || this.window.location;
          if (baseElement && node.href.indexOf(baseElement.href) >= 0 && node.hash) {
            const scrollTarget = this.content.querySelector(node.hash);
            const innerContent = this.content.firstElementChild;
            if (scrollTarget && innerContent) {
              const targetTop = scrollTarget.getBoundingClientRect().top - 20;
              const containerTop = innerContent.getBoundingClientRect().top;
              this.scrollbar.setScrollPosition({ scrollTop: targetTop - containerTop });
            }
          } else {
            this.open(URI.parse(node.href));
          }
          event.preventDefault();
          break;
        } else if (isHTMLButtonElement(node)) {
          const href = node.getAttribute("data-href");
          if (href) {
            this.open(URI.parse(href));
          }
          break;
        } else if (node === event.currentTarget) {
          break;
        }
      }
    }));
  }
  open(uri) {
    if (uri.scheme === "command" && uri.path === "git.clone" && !CommandsRegistry.getCommand("git.clone")) {
      this.notificationService.info(localize("walkThrough.gitNotFound", "It looks like Git is not installed on your system."));
      return;
    }
    this.openerService.open(this.addFrom(uri), { allowCommands: true });
  }
  addFrom(uri) {
    if (uri.scheme !== "command" || !(this.input instanceof WalkThroughInput)) {
      return uri;
    }
    const query = uri.query ? JSON.parse(uri.query) : {};
    query.from = this.input.getTelemetryFrom();
    return uri.with({ query: JSON.stringify(query) });
  }
  layout(dimension) {
    this.size = dimension;
    size(this.content, dimension.width, dimension.height);
    this.updateSizeClasses();
    this.contentDisposables.forEach((disposable) => {
      if (disposable instanceof CodeEditorWidget) {
        disposable.layout();
      }
    });
    const walkthroughInput = this.input instanceof WalkThroughInput && this.input;
    if (walkthroughInput && walkthroughInput.layout) {
      walkthroughInput.layout(dimension);
    }
    this.scrollbar.scanDomNode();
  }
  updateSizeClasses() {
    const innerContent = this.content.firstElementChild;
    if (this.size && innerContent) {
      innerContent.classList.toggle("max-height-685px", this.size.height <= 685);
    }
  }
  focus() {
    super.focus();
    let active = this.content.ownerDocument.activeElement;
    while (active && active !== this.content) {
      active = active.parentElement;
    }
    if (!active) {
      (this.lastFocus || this.content).focus();
    }
    this.editorFocus.set(true);
  }
  arrowUp() {
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - this.getArrowScrollHeight() });
  }
  arrowDown() {
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop + this.getArrowScrollHeight() });
  }
  getArrowScrollHeight() {
    let fontSize = this.configurationService.getValue("editor.fontSize");
    if (typeof fontSize !== "number" || fontSize < 1) {
      fontSize = 12;
    }
    return 3 * fontSize;
  }
  pageUp() {
    const scrollDimensions = this.scrollbar.getScrollDimensions();
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - scrollDimensions.height });
  }
  pageDown() {
    const scrollDimensions = this.scrollbar.getScrollDimensions();
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop + scrollDimensions.height });
  }
  setInput(input, options, context, token) {
    const store = new DisposableStore();
    this.contentDisposables.push(store);
    this.content.innerText = "";
    return super.setInput(input, options, context, token).then(async () => {
      if (input.resource.path.endsWith(".md")) {
        await this.extensionService.whenInstalledExtensionsRegistered();
      }
      return input.resolve();
    }).then((model) => {
      if (token.isCancellationRequested) {
        return;
      }
      const content = model.main;
      if (!input.resource.path.endsWith(".md")) {
        this.safeSetInnerHtml(this.content, content);
        this.updateSizeClasses();
        this.decorateContent();
        this.contentDisposables.push(this.keybindingService.onDidUpdateKeybindings(() => this.decorateContent()));
        input.onReady?.(this.content.firstElementChild, store);
        this.scrollbar.scanDomNode();
        this.loadTextEditorViewState(input);
        this.updatedScrollPosition();
        return;
      }
      const innerContent = document.createElement("div");
      innerContent.classList.add("walkThroughContent");
      const markdown = this.expandMacros(content);
      this.safeSetInnerHtml(innerContent, markdown);
      this.content.appendChild(innerContent);
      model.snippets.forEach((snippet, i) => {
        const model2 = snippet.textEditorModel;
        if (!model2) {
          return;
        }
        const id = `snippet-${model2.uri.fragment}`;
        const div = innerContent.querySelector(`#${id.replace(/[\\.]/g, "\\$&")}`);
        const options2 = this.getEditorOptions(model2.getLanguageId());
        const telemetryData = {
          target: this.input instanceof WalkThroughInput ? this.input.getTelemetryFrom() : void 0,
          snippet: i
        };
        const editor = this.instantiationService.createInstance(CodeEditorWidget, div, options2, {
          telemetryData
        });
        editor.setModel(model2);
        this.contentDisposables.push(editor);
        const updateHeight = (initial) => {
          const position = editor.getPosition();
          const lineHeight = position ? editor.getLineHeightForPosition(position) : editor.getOption(EditorOption.lineHeight);
          const height = `${Math.max(model2.getLineCount() + 1, 4) * lineHeight}px`;
          if (div.style.height !== height) {
            div.style.height = height;
            editor.layout();
            if (!initial) {
              this.scrollbar.scanDomNode();
            }
          }
        };
        updateHeight(true);
        this.contentDisposables.push(editor.onDidChangeModelContent(() => updateHeight(false)));
        this.contentDisposables.push(editor.onDidChangeCursorPosition((e) => {
          const innerContent2 = this.content.firstElementChild;
          if (innerContent2) {
            const targetTop = div.getBoundingClientRect().top;
            const containerTop = innerContent2.getBoundingClientRect().top;
            const lineHeight = editor.getLineHeightForPosition(e.position);
            const lineTop = targetTop + (e.position.lineNumber - 1) * lineHeight - containerTop;
            const lineBottom = lineTop + lineHeight;
            const scrollDimensions = this.scrollbar.getScrollDimensions();
            const scrollPosition = this.scrollbar.getScrollPosition();
            const scrollTop = scrollPosition.scrollTop;
            const height = scrollDimensions.height;
            if (scrollTop > lineTop) {
              this.scrollbar.setScrollPosition({ scrollTop: lineTop });
            } else if (scrollTop < lineBottom - height) {
              this.scrollbar.setScrollPosition({ scrollTop: lineBottom - height });
            }
          }
        }));
        this.contentDisposables.push(this.configurationService.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration("editor") && snippet.textEditorModel) {
            editor.updateOptions(this.getEditorOptions(snippet.textEditorModel.getLanguageId()));
          }
        }));
      });
      this.updateSizeClasses();
      this.multiCursorModifier();
      this.contentDisposables.push(this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("editor.multiCursorModifier")) {
          this.multiCursorModifier();
        }
      }));
      input.onReady?.(innerContent, store);
      this.scrollbar.scanDomNode();
      this.loadTextEditorViewState(input);
      this.updatedScrollPosition();
      this.contentDisposables.push(Gesture.addTarget(innerContent));
      this.contentDisposables.push(addDisposableListener(innerContent, TouchEventType.Change, (e) => this.onTouchChange(e)));
    });
  }
  safeSetInnerHtml(node, content) {
    domSanitize.safeSetInnerHtml(node, content, {
      allowedAttributes: {
        augment: [
          "id",
          "class",
          "style",
          "data-command",
          "data-href"
        ]
      }
    });
  }
  getEditorOptions(language) {
    const config = deepClone(this.configurationService.getValue("editor", { overrideIdentifier: language }));
    return {
      ...isObject(config) ? config : /* @__PURE__ */ Object.create(null),
      scrollBeyondLastLine: false,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: false
      },
      overviewRulerLanes: 3,
      fixedOverflowWidgets: false,
      lineNumbersMinChars: 1,
      minimap: { enabled: false }
    };
  }
  expandMacros(input) {
    return input.replace(/kb\(([a-z.\d\-]+)\)/gi, (match, kb) => {
      const keybinding = this.keybindingService.lookupKeybinding(kb);
      const shortcut = keybinding ? keybinding.getLabel() || "" : UNBOUND_COMMAND;
      return `<span class="shortcut">${strings.escape(shortcut)}</span>`;
    });
  }
  decorateContent() {
    const keys = this.content.querySelectorAll(".shortcut[data-command]");
    Array.prototype.forEach.call(keys, (key) => {
      const command = key.getAttribute("data-command");
      const keybinding = command && this.keybindingService.lookupKeybinding(command);
      const label = keybinding ? keybinding.getLabel() || "" : UNBOUND_COMMAND;
      while (key.firstChild) {
        key.firstChild.remove();
      }
      key.appendChild(document.createTextNode(label));
    });
    const ifkeys = this.content.querySelectorAll(".if_shortcut[data-command]");
    Array.prototype.forEach.call(ifkeys, (key) => {
      const command = key.getAttribute("data-command");
      const keybinding = command && this.keybindingService.lookupKeybinding(command);
      key.style.display = !keybinding ? "none" : "";
    });
  }
  multiCursorModifier() {
    const labels = UILabelProvider.modifierLabels[OS];
    const value = this.configurationService.getValue("editor.multiCursorModifier");
    const modifier = labels[value === "ctrlCmd" ? OS === OperatingSystem.Macintosh ? "metaKey" : "ctrlKey" : "altKey"];
    const keys = this.content.querySelectorAll(".multi-cursor-modifier");
    Array.prototype.forEach.call(keys, (key) => {
      while (key.firstChild) {
        key.firstChild.remove();
      }
      key.appendChild(document.createTextNode(modifier));
    });
  }
  saveTextEditorViewState(input) {
    const scrollPosition = this.scrollbar.getScrollPosition();
    this.editorMemento.saveEditorState(this.group, input, {
      viewState: {
        scrollTop: scrollPosition.scrollTop,
        scrollLeft: scrollPosition.scrollLeft
      }
    });
  }
  loadTextEditorViewState(input) {
    const state = this.editorMemento.loadEditorState(this.group, input);
    if (state) {
      this.scrollbar.setScrollPosition(state.viewState);
    }
  }
  clearInput() {
    if (this.input instanceof WalkThroughInput) {
      this.saveTextEditorViewState(this.input);
    }
    this.contentDisposables = dispose(this.contentDisposables);
    super.clearInput();
  }
  saveState() {
    if (this.input instanceof WalkThroughInput) {
      this.saveTextEditorViewState(this.input);
    }
    super.saveState();
  }
  dispose() {
    this.editorFocus.reset();
    this.contentDisposables = dispose(this.contentDisposables);
    this.disposables.dispose();
    super.dispose();
  }
};
WalkThroughPart = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, ITextResourceConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IEditorGroupsService)
], WalkThroughPart);
export {
  WALK_THROUGH_FOCUS,
  WalkThroughPart
};
