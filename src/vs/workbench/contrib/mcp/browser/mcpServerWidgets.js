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
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { verifiedPublisherIcon } from "../../../services/extensionManagement/common/extensionsIcons.js";
import { McpServerInstallState } from "../common/mcpTypes.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { isDark } from "../../../../platform/theme/common/theme.js";
import { Emitter } from "../../../../base/common/event.js";
import { reset } from "../../../../base/browser/dom.js";
import { mcpLicenseIcon, mcpServerIcon, mcpServerRemoteIcon, mcpServerWorkspaceIcon, mcpStarredIcon } from "./mcpServerIcons.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../base/common/htmlContent.js";
import { ExtensionIconBadge } from "../../extensions/browser/extensionsWidgets.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { LocalMcpServerScope } from "../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { registerColor } from "../../../../platform/theme/common/colorUtils.js";
import { textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
class McpServerWidget extends Disposable {
  constructor() {
    super(...arguments);
    this._mcpServer = null;
  }
  get mcpServer() {
    return this._mcpServer;
  }
  set mcpServer(mcpServer) {
    this._mcpServer = mcpServer;
    this.update();
  }
  update() {
    this.render();
  }
}
function onClick(element, callback) {
  const disposables = new DisposableStore();
  disposables.add(dom.addDisposableListener(element, dom.EventType.CLICK, dom.finalHandler(callback)));
  disposables.add(dom.addDisposableListener(element, dom.EventType.KEY_UP, (e) => {
    const keyboardEvent = new StandardKeyboardEvent(e);
    if (keyboardEvent.equals(KeyCode.Space) || keyboardEvent.equals(KeyCode.Enter)) {
      e.preventDefault();
      e.stopPropagation();
      callback();
    }
  }));
  return disposables;
}
let McpServerIconWidget = class extends McpServerWidget {
  constructor(container, themeService) {
    super();
    this.themeService = themeService;
    this.iconLoadingDisposable = this._register(new MutableDisposable());
    this.element = dom.append(container, dom.$(".extension-icon"));
    this.iconElement = dom.append(this.element, dom.$("img.icon", { alt: "" }));
    this.iconElement.style.display = "none";
    this.codiconIconElement = dom.append(this.element, dom.$(ThemeIcon.asCSSSelector(mcpServerIcon)));
    this.codiconIconElement.style.display = "none";
    this.render();
    this._register(toDisposable(() => this.clear()));
    this._register(this.themeService.onDidColorThemeChange(() => this.render()));
  }
  clear() {
    this.iconUrl = void 0;
    this.iconElement.src = "";
    this.iconElement.style.display = "none";
    this.codiconIconElement.style.display = "none";
    this.codiconIconElement.className = ThemeIcon.asClassName(mcpServerIcon);
    this.iconLoadingDisposable.clear();
  }
  render() {
    if (!this.mcpServer) {
      this.clear();
      return;
    }
    if (this.mcpServer.icon) {
      const type = this.themeService.getColorTheme().type;
      const iconUrl = isDark(type) ? this.mcpServer.icon.dark : this.mcpServer.icon.light;
      if (this.iconUrl !== iconUrl) {
        this.iconElement.style.display = "inherit";
        this.codiconIconElement.style.display = "none";
        this.iconUrl = iconUrl;
        this.iconLoadingDisposable.value = dom.addDisposableListener(this.iconElement, "error", () => {
          this.iconElement.style.display = "none";
          this.codiconIconElement.style.display = "inherit";
        }, { once: true });
        this.iconElement.src = this.iconUrl;
        if (!this.iconElement.complete) {
          this.iconElement.style.visibility = "hidden";
          this.iconElement.onload = () => this.iconElement.style.visibility = "inherit";
        } else {
          this.iconElement.style.visibility = "inherit";
        }
      }
    } else {
      this.iconUrl = void 0;
      this.iconElement.style.display = "none";
      this.iconElement.src = "";
      this.codiconIconElement.className = this.mcpServer.codicon ? `codicon ${this.mcpServer.codicon}` : ThemeIcon.asClassName(mcpServerIcon);
      this.codiconIconElement.style.display = "inherit";
      this.iconLoadingDisposable.clear();
    }
  }
};
McpServerIconWidget = __decorateClass([
  __decorateParam(1, IThemeService)
], McpServerIconWidget);
let PublisherWidget = class extends McpServerWidget {
  constructor(container, small, hoverService, openerService) {
    super();
    this.container = container;
    this.small = small;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.disposables = this._register(new DisposableStore());
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.element?.remove();
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.mcpServer?.publisherDisplayName) {
      return;
    }
    this.element = dom.append(this.container, dom.$(".publisher"));
    const publisherDisplayName = dom.$(".publisher-name.ellipsis");
    publisherDisplayName.textContent = this.mcpServer.publisherDisplayName;
    const verifiedPublisher = dom.$(".verified-publisher");
    dom.append(verifiedPublisher, dom.$("span.extension-verified-publisher.clickable"), renderIcon(verifiedPublisherIcon));
    if (this.small) {
      if (this.mcpServer.gallery?.publisherDomain?.verified) {
        dom.append(this.element, verifiedPublisher);
      }
      dom.append(this.element, publisherDisplayName);
    } else {
      this.element.classList.toggle("clickable", !!this.mcpServer.gallery?.publisherUrl);
      this.element.setAttribute("role", "button");
      this.element.tabIndex = 0;
      this.containerHover = this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, localize("publisher", "Publisher ({0})", this.mcpServer.publisherDisplayName)));
      dom.append(this.element, publisherDisplayName);
      if (this.mcpServer.gallery?.publisherDomain?.verified) {
        dom.append(this.element, verifiedPublisher);
        const publisherDomainLink = URI.parse(this.mcpServer.gallery?.publisherDomain.link);
        verifiedPublisher.tabIndex = 0;
        verifiedPublisher.setAttribute("role", "button");
        this.containerHover.update(localize("verified publisher", "This publisher has verified ownership of {0}", this.mcpServer.gallery?.publisherDomain.link));
        verifiedPublisher.setAttribute("role", "link");
        dom.append(verifiedPublisher, dom.$("span.extension-verified-publisher-domain", void 0, publisherDomainLink.authority.startsWith("www.") ? publisherDomainLink.authority.substring(4) : publisherDomainLink.authority));
        this.disposables.add(onClick(verifiedPublisher, () => this.openerService.open(publisherDomainLink)));
      }
      if (this.mcpServer.gallery?.publisherUrl) {
        this.disposables.add(onClick(this.element, () => this.openerService.open(this.mcpServer?.gallery?.publisherUrl)));
      }
    }
  }
};
PublisherWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IOpenerService)
], PublisherWidget);
class StarredWidget extends McpServerWidget {
  constructor(container, small) {
    super();
    this.container = container;
    this.small = small;
    this.disposables = this._register(new DisposableStore());
    this.container.classList.add("extension-ratings");
    if (this.small) {
      container.classList.add("small");
    }
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.container.innerText = "";
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.mcpServer?.starsCount) {
      return;
    }
    if (this.small && this.mcpServer.installState !== McpServerInstallState.Uninstalled) {
      return;
    }
    const parent = this.small ? this.container : dom.append(this.container, dom.$("span.rating", { tabIndex: 0 }));
    dom.append(parent, dom.$("span" + ThemeIcon.asCSSSelector(mcpStarredIcon)));
    const ratingCountElement = dom.append(parent, dom.$("span.count", void 0, StarredWidget.getCountLabel(this.mcpServer.starsCount)));
    if (!this.small) {
      ratingCountElement.style.paddingLeft = "3px";
    }
  }
  static getCountLabel(starsCount) {
    if (starsCount > 1e6) {
      return `${Math.floor(starsCount / 1e5) / 10}M`;
    } else if (starsCount > 1e3) {
      return `${Math.floor(starsCount / 1e3)}K`;
    } else {
      return String(starsCount);
    }
  }
}
class LicenseWidget extends McpServerWidget {
  constructor(container) {
    super();
    this.container = container;
    this.disposables = this._register(new DisposableStore());
    this.container.classList.add("license");
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.container.innerText = "";
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.mcpServer?.license) {
      return;
    }
    const parent = dom.append(this.container, dom.$("span.license", { tabIndex: 0 }));
    dom.append(parent, dom.$("span" + ThemeIcon.asCSSSelector(mcpLicenseIcon)));
    const licenseElement = dom.append(parent, dom.$("span", void 0, this.mcpServer.license));
    licenseElement.style.paddingLeft = "3px";
  }
}
let McpServerHoverWidget = class extends McpServerWidget {
  constructor(options, mcpServerStatusAction, hoverService, configurationService) {
    super();
    this.options = options;
    this.mcpServerStatusAction = mcpServerStatusAction;
    this.hoverService = hoverService;
    this.configurationService = configurationService;
    this.hover = this._register(new MutableDisposable());
  }
  render() {
    this.hover.value = void 0;
    if (this.mcpServer) {
      this.hover.value = this.hoverService.setupManagedHover(
        {
          delay: this.configurationService.getValue("workbench.hover.delay"),
          showHover: (options, focus) => {
            return this.hoverService.showInstantHover({
              ...options,
              additionalClasses: ["extension-hover"],
              position: {
                hoverPosition: this.options.position(),
                forcePosition: true
              },
              persistence: {
                hideOnKeyDown: true
              }
            }, focus);
          },
          placement: "element"
        },
        this.options.target,
        {
          markdown: () => Promise.resolve(this.getHoverMarkdown()),
          markdownNotSupportedFallback: void 0
        },
        {
          appearance: {
            showHoverHint: true
          }
        }
      );
    }
  }
  getHoverMarkdown() {
    if (!this.mcpServer) {
      return void 0;
    }
    const markdown = new MarkdownString("", { isTrusted: false, supportThemeIcons: true });
    markdown.appendMarkdown(`**${escapeMarkdownSyntaxTokens(this.mcpServer.label)}**`);
    markdown.appendText(`
`);
    let addSeparator = false;
    if (this.mcpServer.local?.scope === LocalMcpServerScope.Workspace) {
      markdown.appendMarkdown(`$(${mcpServerWorkspaceIcon.id})&nbsp;`);
      markdown.appendMarkdown(localize("workspace extension", "Workspace MCP Server"));
      addSeparator = true;
    }
    if (this.mcpServer.local?.scope === LocalMcpServerScope.RemoteUser) {
      markdown.appendMarkdown(`$(${mcpServerRemoteIcon.id})&nbsp;`);
      markdown.appendMarkdown(localize("remote user extension", "Remote MCP Server"));
      addSeparator = true;
    }
    if (this.mcpServer.installState === McpServerInstallState.Installed) {
      if (this.mcpServer.starsCount) {
        if (addSeparator) {
          markdown.appendText(`  |  `);
        }
        const starsCountLabel = StarredWidget.getCountLabel(this.mcpServer.starsCount);
        markdown.appendMarkdown(`$(${mcpStarredIcon.id}) ${starsCountLabel}`);
        addSeparator = true;
      }
    }
    if (addSeparator) {
      markdown.appendText(`
`);
    }
    if (this.mcpServer.description) {
      markdown.appendMarkdown(escapeMarkdownSyntaxTokens(this.mcpServer.description));
    }
    const extensionStatus = this.mcpServerStatusAction.status;
    if (extensionStatus.length) {
      markdown.appendMarkdown(`---`);
      markdown.appendText(`
`);
      for (const status of extensionStatus) {
        if (status.icon) {
          markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
        }
        markdown.appendMarkdown(status.message.value);
        markdown.appendText(`
`);
      }
    }
    return markdown;
  }
};
McpServerHoverWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IConfigurationService)
], McpServerHoverWidget);
let McpServerScopeBadgeWidget = class extends McpServerWidget {
  constructor(container, instantiationService) {
    super();
    this.container = container;
    this.instantiationService = instantiationService;
    this.badge = this._register(new MutableDisposable());
    this.element = dom.append(this.container, dom.$(""));
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.badge.value?.element.remove();
    this.badge.clear();
  }
  render() {
    this.clear();
    const scope = this.mcpServer?.local?.scope;
    if (!scope || scope === LocalMcpServerScope.User) {
      return;
    }
    let icon;
    switch (scope) {
      case LocalMcpServerScope.Workspace: {
        icon = mcpServerWorkspaceIcon;
        break;
      }
      case LocalMcpServerScope.RemoteUser: {
        icon = mcpServerRemoteIcon;
        break;
      }
    }
    this.badge.value = this.instantiationService.createInstance(ExtensionIconBadge, icon, void 0);
    dom.append(this.element, this.badge.value.element);
  }
};
McpServerScopeBadgeWidget = __decorateClass([
  __decorateParam(1, IInstantiationService)
], McpServerScopeBadgeWidget);
let McpServerStatusWidget = class extends McpServerWidget {
  constructor(container, extensionStatusAction, markdownRendererService) {
    super();
    this.container = container;
    this.extensionStatusAction = extensionStatusAction;
    this.markdownRendererService = markdownRendererService;
    this.renderDisposables = this._register(new MutableDisposable());
    this._onDidRender = this._register(new Emitter());
    this.onDidRender = this._onDidRender.event;
    this.render();
    this._register(extensionStatusAction.onDidChangeStatus(() => this.render()));
  }
  render() {
    reset(this.container);
    this.renderDisposables.value = void 0;
    const disposables = new DisposableStore();
    this.renderDisposables.value = disposables;
    const extensionStatus = this.extensionStatusAction.status;
    if (extensionStatus.length) {
      const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
      for (let i = 0; i < extensionStatus.length; i++) {
        const status = extensionStatus[i];
        if (status.icon) {
          markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
        }
        markdown.appendMarkdown(status.message.value);
        if (i < extensionStatus.length - 1) {
          markdown.appendText(`
`);
        }
      }
      const rendered = disposables.add(this.markdownRendererService.render(markdown));
      dom.append(this.container, rendered.element);
    }
    this._onDidRender.fire();
  }
};
McpServerStatusWidget = __decorateClass([
  __decorateParam(2, IMarkdownRendererService)
], McpServerStatusWidget);
const mcpStarredIconColor = registerColor("mcpIcon.starForeground", { light: "#DF6100", dark: "#FF8E00", hcDark: "#FF8E00", hcLight: textLinkForeground }, localize("mcpIconStarForeground", "The icon color for mcp starred."), false);
registerThemingParticipant((theme, collector) => {
  const mcpStarredIconColorValue = theme.getColor(mcpStarredIconColor);
  if (mcpStarredIconColorValue) {
    collector.addRule(`.extension-ratings .codicon-mcp-server-starred { color: ${mcpStarredIconColorValue}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(mcpStarredIcon)} { color: ${mcpStarredIconColorValue}; }`);
  }
});
export {
  LicenseWidget,
  McpServerHoverWidget,
  McpServerIconWidget,
  McpServerScopeBadgeWidget,
  McpServerStatusWidget,
  McpServerWidget,
  PublisherWidget,
  StarredWidget,
  mcpStarredIconColor,
  onClick
};
