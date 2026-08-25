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
import * as dom from "../../../../../../base/browser/dom.js";
import { createPixelSpinner } from "../../../../../../base/browser/ui/pixelSpinner/pixelSpinner.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { localize } from "../../../../../../nls.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import "./media/chatMcpServersInteractionContent.css";
let ChatMcpServersStartingContentPart = class extends Disposable {
  constructor(data, options, markdownRendererService) {
    super();
    this.data = data;
    this.options = options;
    this.markdownRendererService = markdownRendererService;
    this.rendered = this._register(new MutableDisposable());
    this.spinner = this._register(new MutableDisposable());
    this.hadStartingServers = false;
    this.didNotifyFinished = false;
    this.domNode = dom.$(".chat-mcp-servers-interaction");
    this._register(autorun((reader) => {
      this.render(this.data.servers.read(reader));
    }));
  }
  render(servers) {
    dom.clearNode(this.domNode);
    this.rendered.clear();
    this.spinner.clear();
    if (!servers.length) {
      this.domNode.style.display = "none";
      if (this.hadStartingServers && !this.didNotifyFinished) {
        this.didNotifyFinished = true;
        this.options?.onDidFinishStarting?.();
      }
      return;
    }
    this.hadStartingServers = true;
    this.domNode.style.display = "";
    const links = servers.map((server) => "`" + escapeMarkdownSyntaxTokens(server.name) + "`").join(", ");
    this._renderMessage(
      localize("mcp.starting.servers", "Starting MCP servers {0}...", links)
    );
  }
  _renderMessage(content) {
    const container = dom.$(".chat-mcp-servers-interaction-hint");
    const messageContainer = dom.$(".chat-mcp-servers-message");
    const iconElement = dom.$(".chat-mcp-servers-icon");
    this.spinner.value = (this.options?.createSpinner ?? createPixelSpinner)(iconElement);
    const rendered = this.rendered.value = this.markdownRendererService.render(new MarkdownString(content));
    messageContainer.appendChild(iconElement);
    messageContainer.appendChild(rendered.element);
    container.appendChild(messageContainer);
    this.domNode.appendChild(container);
  }
  hasSameContent(other, _followingContent, _element) {
    return other.kind === "mcpServersStartingSlow";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatMcpServersStartingContentPart = __decorateClass([
  __decorateParam(2, IMarkdownRendererService)
], ChatMcpServersStartingContentPart);
export {
  ChatMcpServersStartingContentPart
};
