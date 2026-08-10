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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { McpServerStatus } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { IAgentHostCustomizationService } from "../../agentSessions/agentHost/agentHostCustomizationService.js";
import "./media/chatMcpServersInteractionContent.css";
let ChatMcpAuthenticationContentPart = class extends Disposable {
  constructor(data, markdownRendererService, agentHostCustomizationService) {
    super();
    this.data = data;
    this.markdownRendererService = markdownRendererService;
    this.agentHostCustomizationService = agentHostCustomizationService;
    this.rendered = this._register(new MutableDisposable());
    /**
     * Whether this part was ever shown. Used to distinguish the initial empty
     * state (the part is emitted with an empty `servers` observable that is
     * populated immediately after) from the terminal state where every server
     * has been authenticated — only the latter marks the part
     * {@link IChatMcpAuthenticationRequired.isUsed used}.
     */
    this._hasBeenVisible = false;
    /**
     * The MCP server currently being authenticated, or `undefined` when idle.
     * While set, the part shows an "Authenticating …" progress message for that
     * server and stays visible regardless of the underlying auth-required state.
     */
    this._authenticating = observableValue(this, void 0);
    this.domNode = dom.$(".chat-mcp-servers-interaction");
    this._register(autorun((reader) => {
      const servers = this.data.servers.read(reader);
      const authenticating = this._authenticating.read(reader);
      this.render(servers, authenticating);
      this.updateVisibility(servers, authenticating);
    }));
    this._register(this.agentHostCustomizationService.onDidChangeCustomizations(() => this.updateVisibility(this.data.servers.get(), this._authenticating.get())));
  }
  render(servers, authenticating) {
    dom.clearNode(this.domNode);
    this.rendered.clear();
    if (authenticating) {
      this._renderMessage(
        ThemeIcon.modify(Codicon.loading, "spin"),
        localize("mcp.auth.authenticating", "Authenticating {0}...", "`" + escapeMarkdownSyntaxTokens(authenticating.name) + "`")
      );
      return;
    }
    if (!servers.length) {
      return;
    }
    const links = servers.map((server) => "`" + escapeMarkdownSyntaxTokens(server.name) + "`").join(", ");
    const content = servers.length === 1 ? localize("mcp.auth.single", "The MCP server {0} requires authentication. [Authenticate](#authenticate)?", links) : localize("mcp.auth.multiple", "The MCP servers {0} require authentication. [Authenticate](#authenticate)?", links);
    this._renderMessage(Codicon.mcp, content, { href: "#authenticate", run: () => void this.authenticate() });
  }
  _renderMessage(icon, content, action) {
    const container = dom.$(".chat-mcp-servers-interaction-hint");
    const messageContainer = dom.$(".chat-mcp-servers-message");
    const iconElement = dom.$(".chat-mcp-servers-icon");
    iconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
    const rendered = this.rendered.value = this.markdownRendererService.render(new MarkdownString(content, { isTrusted: true }), action ? {
      actionHandler: (href) => {
        if (href !== action.href) {
          return Promise.resolve(false);
        }
        action.run();
        return Promise.resolve(true);
      }
    } : void 0);
    messageContainer.appendChild(iconElement);
    messageContainer.appendChild(rendered.element);
    container.appendChild(messageContainer);
    this.domNode.appendChild(container);
    if (action) {
      const actionLink = rendered.element.querySelector(`a[data-href="${action.href}"]`);
      if (actionLink) {
        actionLink.setAttribute("role", "button");
        actionLink.href = "";
      }
    }
  }
  async authenticate() {
    const sessionResource = URI.revive(this.data.sessionResource);
    try {
      for (const server of this.data.servers.get()) {
        this._authenticating.set(server, void 0);
        await this.agentHostCustomizationService.authenticateMcpServer(sessionResource, server.id);
      }
    } finally {
      this._authenticating.set(void 0, void 0);
    }
  }
  updateVisibility(dataServers, authenticating) {
    if (authenticating) {
      this.domNode.style.display = "";
      this._hasBeenVisible = true;
      return;
    }
    const sessionResource = URI.revive(this.data.sessionResource);
    const servers = this.agentHostCustomizationService.getMcpServers(sessionResource);
    const visible = dataServers.some((server) => servers.some((current) => current.id === server.id && current.status === McpServerStatus.AuthRequired));
    this.domNode.style.display = visible ? "" : "none";
    if (visible) {
      this._hasBeenVisible = true;
    } else if (this._hasBeenVisible) {
      this.data.isUsed = true;
    }
  }
  hasSameContent(other, _followingContent, _element) {
    return other.kind === "mcpAuthenticationRequired";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatMcpAuthenticationContentPart = __decorateClass([
  __decorateParam(1, IMarkdownRendererService),
  __decorateParam(2, IAgentHostCustomizationService)
], ChatMcpAuthenticationContentPart);
export {
  ChatMcpAuthenticationContentPart
};
