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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IMarkdownRendererService, openLinkFromMarkdown } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asTextOrError, IRequestService } from "../../../../platform/request/common/request.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ShowCurrentReleaseNotesActionId } from "../common/update.js";
import { parseUpdateInfoInput } from "../common/updateInfoParser.js";
import { getUpdateInfoUrl, isMajorMinorVersionChange } from "../common/updateUtils.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { URI } from "../../../../base/common/uri.js";
import "./media/postUpdateWidget.css";
const LAST_KNOWN_VERSION_KEY = "postUpdateWidget/lastKnownVersion";
let PostUpdateWidgetContribution = class extends Disposable {
  constructor(commandService, configurationService, hostService, hoverService, layoutService, markdownRendererService, openerService, productService, requestService, storageService, telemetryService) {
    super();
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.hostService = hostService;
    this.hoverService = hoverService;
    this.layoutService = layoutService;
    this.markdownRendererService = markdownRendererService;
    this.openerService = openerService;
    this.productService = productService;
    this.requestService = requestService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    if (isWeb) {
      return;
    }
    this._register(CommandsRegistry.registerCommand("_update.showUpdateInfo", (_accessor, markdown) => this.showUpdateInfo(markdown)));
    void this.tryShowOnStartup();
  }
  static {
    this.idCounter = 0;
  }
  async tryShowOnStartup() {
    if (!await this.hostService.hadLastFocus()) {
      return;
    }
    if (!this.detectVersionChange()) {
      return;
    }
    if (this.configurationService.getValue("update.showPostInstallInfo") === false) {
      return;
    }
    await this.showUpdateInfo();
  }
  async showUpdateInfo(markdown) {
    const info = await this.getUpdateInfo(markdown);
    if (!info) {
      return;
    }
    const contentDisposables = new DisposableStore();
    const target = this.layoutService.mainContainer;
    const { clientWidth } = target;
    const maxWidth = 420;
    const x = Math.max(clientWidth - maxWidth - 80, 16);
    this.hoverService.showInstantHover({
      content: this.buildContent(info, contentDisposables),
      target: {
        targetElements: [target],
        x,
        y: 40,
        dispose: () => contentDisposables.dispose()
      },
      additionalClasses: ["post-update-widget-hover"],
      persistence: { sticky: true },
      appearance: { showPointer: false, compact: true, maxHeightRatio: 1 },
      trapFocus: true
    }, true);
  }
  async getUpdateInfo(input) {
    if (!input) {
      try {
        const url = getUpdateInfoUrl(this.productService.version);
        const context = await this.requestService.request({ url, callSite: "postUpdateWidget" }, CancellationToken.None);
        input = await asTextOrError(context);
      } catch {
      }
    }
    if (!input) {
      return void 0;
    }
    let info = parseUpdateInfoInput(input);
    if (!info?.buttons?.length) {
      info = {
        ...info,
        buttons: [{
          label: localize("postUpdate.releaseNotes", "Release Notes"),
          commandId: ShowCurrentReleaseNotesActionId,
          args: [this.productService.version],
          style: "secondary"
        }]
      };
    }
    return info;
  }
  buildContent(info, disposables) {
    const { markdown, buttons, bannerImageUrl, badge, title, features } = info;
    const container = dom.$(".post-update-widget");
    const titleId = `post-update-widget-title-${PostUpdateWidgetContribution.idCounter++}`;
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-labelledby", titleId);
    const banner = dom.append(container, dom.$(".banner"));
    banner.setAttribute("aria-hidden", "true");
    const safeBannerUrl = sanitizeBannerImageUrl(bannerImageUrl);
    if (safeBannerUrl) {
      banner.style.setProperty("background-image", `url(${JSON.stringify(safeBannerUrl)})`);
    }
    const closeButton = dom.append(container, dom.$("button.banner-close"));
    closeButton.setAttribute("aria-label", localize("postUpdate.close", "Close"));
    const closeIcon = dom.append(closeButton, dom.$(ThemeIcon.asCSSSelector(Codicon.close)));
    closeIcon.setAttribute("aria-hidden", "true");
    disposables.add(dom.addDisposableListener(closeButton, "click", () => {
      this.hoverService.hideHover(true);
    }));
    const body = dom.append(container, dom.$(".body"));
    if (badge) {
      const badgeEl = dom.append(body, dom.$(".badge"));
      badgeEl.textContent = badge;
    }
    const titleEl = dom.append(body, dom.$(".title"));
    titleEl.id = titleId;
    titleEl.textContent = title ?? localize("postUpdate.title", "New in {0}", this.productService.version);
    if (features?.length) {
      const list = dom.append(body, dom.$(".features"));
      list.setAttribute("role", "list");
      for (const feature of features) {
        const row = dom.append(list, dom.$(".feature"));
        row.setAttribute("role", "listitem");
        const iconEl = dom.append(row, dom.$(".feature-icon"));
        const iconId = feature.icon ?? Codicon.sparkle.id;
        const themeIcon = ThemeIcon.fromId(iconId);
        iconEl.classList.add(...ThemeIcon.asClassNameArray(themeIcon));
        iconEl.setAttribute("aria-hidden", "true");
        const text = dom.append(row, dom.$(".feature-text"));
        const featureTitle = dom.append(text, dom.$(".feature-title"));
        featureTitle.textContent = feature.title;
        const featureDescription = dom.append(text, dom.$(".feature-description"));
        const rendered = disposables.add(this.markdownRendererService.render(
          new MarkdownString(feature.description, {
            isTrusted: true,
            supportThemeIcons: true
          }),
          {
            actionHandler: (link, mdStr) => {
              openLinkFromMarkdown(this.openerService, link, mdStr.isTrusted);
              this.hoverService.hideHover(true);
            }
          }
        ));
        featureDescription.appendChild(rendered.element);
      }
    } else if (markdown) {
      const markdownContainer = dom.append(body, dom.$(".update-markdown"));
      const rendered = disposables.add(this.markdownRendererService.render(
        new MarkdownString(markdown, {
          isTrusted: true,
          supportHtml: true,
          supportThemeIcons: true
        }),
        {
          actionHandler: (link, mdStr) => {
            openLinkFromMarkdown(this.openerService, link, mdStr.isTrusted);
            this.hoverService.hideHover(true);
          }
        }
      ));
      markdownContainer.appendChild(rendered.element);
    }
    if (buttons?.length) {
      const buttonBar = dom.append(body, dom.$(".button-bar"));
      const isSingleButton = buttons.length === 1;
      let seenSecondary = false;
      for (const { label, style, commandId, args } of buttons) {
        const button = dom.append(buttonBar, dom.$("button"));
        button.textContent = label;
        if (style === "secondary") {
          button.classList.add("update-button-secondary");
          if (!seenSecondary && buttons.length > 1) {
            button.classList.add("update-button-leading-secondary");
            seenSecondary = true;
          }
        } else {
          button.classList.add("update-button-primary");
        }
        if (isSingleButton) {
          button.classList.add("update-button-full-width");
        }
        disposables.add(dom.addDisposableListener(button, "click", () => {
          this.telemetryService.publicLog2(
            "workbenchActionExecuted",
            { id: commandId, from: "postUpdateWidget" }
          );
          void this.commandService.executeCommand(commandId, ...args ?? []);
          this.hoverService.hideHover(true);
        }));
      }
    }
    return container;
  }
  detectVersionChange() {
    let from;
    try {
      from = this.storageService.getObject(LAST_KNOWN_VERSION_KEY, StorageScope.APPLICATION);
    } catch {
    }
    const to = {
      version: this.productService.version,
      commit: this.productService.commit,
      timestamp: Date.now()
    };
    if (from?.commit === to.commit) {
      return false;
    }
    this.storageService.store(LAST_KNOWN_VERSION_KEY, JSON.stringify(to), StorageScope.APPLICATION, StorageTarget.MACHINE);
    if (from) {
      return isMajorMinorVersionChange(from.version, to.version);
    }
    return false;
  }
};
PostUpdateWidgetContribution = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IHostService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, ILayoutService),
  __decorateParam(5, IMarkdownRendererService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IRequestService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ITelemetryService)
], PostUpdateWidgetContribution);
function sanitizeBannerImageUrl(value) {
  if (!value) {
    return void 0;
  }
  try {
    const uri = URI.parse(value, true);
    if (uri.scheme === "https") {
      return uri.toString(true);
    }
    if (uri.scheme === "data" && /^image\//i.test(uri.path)) {
      return uri.toString(true);
    }
  } catch {
  }
  return void 0;
}
export {
  PostUpdateWidgetContribution
};
