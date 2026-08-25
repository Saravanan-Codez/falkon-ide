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
import { getWindow } from "../../../../base/browser/dom.js";
import { raceCancellationError } from "../../../../base/common/async.js";
import { matchesMimeType } from "../../../../base/common/dataTransfer.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { equalsIgnoreCase } from "../../../../base/common/strings.js";
import * as nls from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ExtensionKeyedWebviewOriginStore, IWebviewService, WebviewContentPurpose } from "../../../contrib/webview/browser/webview.js";
import { IExtensionService, isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { IChatWidgetService } from "./chat.js";
const IChatOutputRendererService = createDecorator("chatOutputRendererService");
let ChatOutputRendererService = class extends Disposable {
  constructor(_contextKeyService, _extensionService, _webviewService, _chatWidgetService, storageService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._extensionService = _extensionService;
    this._webviewService = _webviewService;
    this._chatWidgetService = _chatWidgetService;
    this._contributions = /* @__PURE__ */ new Map();
    this._renderers = /* @__PURE__ */ new Map();
    this._originStore = new ExtensionKeyedWebviewOriginStore("chatOutputRenderer.origins", storageService);
    this._register(chatOutputRenderContributionPoint.setHandler((extensions) => {
      this.updateContributions(extensions);
    }));
  }
  registerRenderer(viewType, renderer, options) {
    this._renderers.set(viewType, { viewType, renderer, options });
    return {
      dispose: () => {
        this._renderers.delete(viewType);
      }
    };
  }
  hasCodeBlockRenderer(languageIdentifier) {
    return Array.from(this._contributions.values()).some((value) => value.codeBlockLanguageIdentifiers.some((identifier) => equalsIgnoreCase(identifier, languageIdentifier)));
  }
  async renderOutputPart(mime, data, parent, webviewOptions, token) {
    const rendererData = await this.getRendererForMime(mime, token);
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    if (!rendererData) {
      throw new Error(`No renderer registered found for mime type: ${mime}`);
    }
    return this.doRenderOutputPart(rendererData, mime, data, {}, parent, webviewOptions, token);
  }
  async renderCodeBlock(languageIdentifier, data, parent, webviewOptions, token) {
    const rendererData = await this.getRendererForCodeBlock(languageIdentifier, token);
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    if (!rendererData) {
      throw new Error(`No renderer registered found for code block language identifier: ${languageIdentifier}`);
    }
    return this.doRenderOutputPart(rendererData, "text/x-vscode-chat-code-block", data, { codeBlockContext: { languageIdentifier } }, parent, webviewOptions, token);
  }
  async doRenderOutputPart(rendererData, mime, data, context, parent, webviewOptions, token) {
    const store = new DisposableStore();
    const webview = store.add(this._webviewService.createWebviewElement({
      title: webviewOptions.title ?? "",
      origin: this.getOrigin(rendererData),
      providedViewType: rendererData.viewType,
      options: {
        enableFindWidget: false,
        purpose: WebviewContentPurpose.ChatOutputItem,
        tryRestoreScrollPosition: false
      },
      contentOptions: {},
      extension: rendererData.options.extension ? rendererData.options.extension : void 0
    }));
    webview.setContextKeyService(store.add(this._contextKeyService.createScoped(parent)));
    if (webviewOptions.chatSessionResource) {
      store.add(this.delegateScrollToChatWidget(webview, webviewOptions.chatSessionResource));
    }
    const onDidChangeHeight = store.add(new Emitter());
    store.add(autorun((reader) => {
      const height = reader.readObservable(webview.intrinsicContentSize);
      if (height) {
        onDidChangeHeight.fire(height.height);
        parent.style.height = `${height.height}px`;
      }
    }));
    if (webviewOptions.webviewState) {
      webview.state = webviewOptions.webviewState;
    }
    webview.mountTo(parent, getWindow(parent));
    await rendererData.renderer.renderOutputPart(mime, data, webview, context, token);
    return {
      get webview() {
        return webview;
      },
      onDidChangeHeight: onDidChangeHeight.event,
      dispose: () => {
        store.dispose();
      },
      reinitialize: () => {
        webview.reinitializeAfterDismount();
      }
    };
  }
  delegateScrollToChatWidget(webview, chatSessionResource) {
    return webview.onDidWheel((e) => {
      this._chatWidgetService.getWidgetBySessionResource(chatSessionResource)?.delegateScrollFromMouseWheelEvent({
        ...e,
        preventDefault: () => {
        },
        stopPropagation: () => {
        }
      });
    });
  }
  getOrigin(rendererData) {
    return rendererData.options.extension ? this._originStore.getOrigin(rendererData.viewType, rendererData.options.extension.id) : void 0;
  }
  async getRendererForMime(mime, token) {
    return this.getRenderer((value) => value.mimes.some((m) => matchesMimeType(m, [mime])), token);
  }
  async getRendererForCodeBlock(languageIdentifier, token) {
    return this.getRenderer((value) => value.codeBlockLanguageIdentifiers.some((identifier) => equalsIgnoreCase(identifier, languageIdentifier)), token);
  }
  async getRenderer(matches, token) {
    await raceCancellationError(this._extensionService.whenInstalledExtensionsRegistered(), token);
    for (const [id, value] of this._contributions) {
      if (matches(value)) {
        await raceCancellationError(this._extensionService.activateByEvent(`onChatOutputRenderer:${id}`), token);
        const rendererData = this._renderers.get(id);
        if (rendererData) {
          return rendererData;
        }
      }
    }
    return void 0;
  }
  updateContributions(extensions) {
    this._contributions.clear();
    for (const extension of extensions) {
      if (!isProposedApiEnabled(extension.description, "chatOutputRenderer")) {
        continue;
      }
      for (const contribution of extension.value) {
        if (this._contributions.has(contribution.viewType)) {
          extension.collector.error(`Chat output renderer with view type '${contribution.viewType}' already registered`);
          continue;
        }
        const mimeTypes = contribution.mimeTypes ?? [];
        const codeBlockLanguageIdentifiers = contribution.codeBlockLanguageIdentifiers ?? [];
        if (!mimeTypes.length && !codeBlockLanguageIdentifiers.length) {
          extension.collector.error(`Chat output renderer with view type '${contribution.viewType}' must specify at least one mime type or code block language identifier`);
          continue;
        }
        this._contributions.set(contribution.viewType, {
          mimes: mimeTypes,
          codeBlockLanguageIdentifiers
        });
      }
    }
  }
};
ChatOutputRendererService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IWebviewService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, IStorageService)
], ChatOutputRendererService);
const chatOutputRendererContributionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["viewType"],
  properties: {
    viewType: {
      type: "string",
      description: nls.localize("chatOutputRenderer.viewType", "Unique identifier for the renderer.")
    },
    mimeTypes: {
      type: "array",
      description: nls.localize("chatOutputRenderer.mimeTypes", "MIME types that this renderer can handle"),
      uniqueItems: true,
      items: {
        type: "string"
      }
    },
    codeBlockLanguageIdentifiers: {
      type: "array",
      description: nls.localize("chatOutputRenderer.codeBlockLanguageIdentifiers", "Code block language identifiers that this renderer can handle"),
      uniqueItems: true,
      items: {
        type: "string"
      }
    }
  }
};
const chatOutputRenderContributionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "chatOutputRenderers",
  activationEventsGenerator: function* (contributions) {
    for (const contrib of contributions) {
      yield `onChatOutputRenderer:${contrib.viewType}`;
    }
  },
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.chatOutputRenderer", "Contributes a renderer for specific MIME types and code block language identifiers in chat outputs"),
    type: "array",
    items: chatOutputRendererContributionSchema
  }
});
export {
  ChatOutputRendererService,
  IChatOutputRendererService
};
