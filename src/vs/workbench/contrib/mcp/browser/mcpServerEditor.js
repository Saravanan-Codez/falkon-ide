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
import "./media/mcpServerEditor.css";
import { $, append, clearNode, setParentFlowTo } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Action } from "../../../../base/common/actions.js";
import * as arrays from "../../../../base/common/arrays.js";
import { Cache } from "../../../../base/common/cache.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { TokenizationRegistry } from "../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { generateTokensCSSForColorMap } from "../../../../editor/common/languages/supports/tokenization.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from "../../markdown/browser/markdownDocumentRenderer.js";
import { IWebviewService } from "../../webview/browser/webview.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IMcpWorkbenchService, McpServerContainers, McpServerInstallState } from "../common/mcpTypes.js";
import { StarredWidget, McpServerIconWidget, McpServerStatusWidget, McpServerWidget, onClick, PublisherWidget, McpServerScopeBadgeWidget, LicenseWidget } from "./mcpServerWidgets.js";
import { ButtonWithDropDownExtensionAction, ButtonWithDropdownExtensionActionViewItem, DisableMcpDropDownAction, DropDownAction, EnableMcpDropDownAction, InstallAction, InstallingLabelAction, InstallInRemoteAction, InstallInWorkspaceAction, ManageMcpServerAction, McpServerStatusAction, UninstallAction } from "./mcpServerActions.js";
import { McpServerType } from "../../../../platform/mcp/common/mcpPlatformTypes.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { getMcpGalleryManifestResourceUri, IMcpGalleryManifestService, McpGalleryResourceType } from "../../../../platform/mcp/common/mcpGalleryManifest.js";
import { fromNow } from "../../../../base/common/date.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
var McpServerEditorTab = /* @__PURE__ */ ((McpServerEditorTab2) => {
  McpServerEditorTab2["Readme"] = "readme";
  McpServerEditorTab2["Configuration"] = "configuration";
  McpServerEditorTab2["Manifest"] = "manifest";
  return McpServerEditorTab2;
})(McpServerEditorTab || {});
class NavBar extends Disposable {
  constructor(container) {
    super();
    this._onChange = this._register(new Emitter());
    this._currentId = null;
    const element = append(container, $(".navbar"));
    this.actions = [];
    this.actionbar = this._register(new ActionBar(element));
  }
  get onChange() {
    return this._onChange.event;
  }
  get currentId() {
    return this._currentId;
  }
  push(id, label, tooltip, index) {
    const action = new Action(id, label, void 0, true, () => this.update(id, true));
    action.tooltip = tooltip;
    if (typeof index === "number") {
      this.actions.splice(index, 0, action);
    } else {
      this.actions.push(action);
    }
    this.actionbar.push(action, { index });
    if (this.actions.length === 1) {
      this.update(id);
    }
  }
  remove(id) {
    const index = this.actions.findIndex((action) => action.id === id);
    if (index !== -1) {
      this.actions.splice(index, 1);
      this.actionbar.pull(index);
      if (this._currentId === id) {
        this.switch(this.actions[0]?.id);
      }
    }
  }
  clear() {
    this.actions = dispose(this.actions);
    this.actionbar.clear();
  }
  switch(id) {
    const action = this.actions.find((action2) => action2.id === id);
    if (action) {
      action.run();
      return true;
    }
    return false;
  }
  has(id) {
    return this.actions.some((action) => action.id === id);
  }
  update(id, focus) {
    this._currentId = id;
    this._onChange.fire({ id, focus: !!focus });
    this.actions.forEach((a) => a.checked = a.id === id);
  }
}
var WebviewIndex = /* @__PURE__ */ ((WebviewIndex2) => {
  WebviewIndex2[WebviewIndex2["Readme"] = 0] = "Readme";
  WebviewIndex2[WebviewIndex2["Changelog"] = 1] = "Changelog";
  return WebviewIndex2;
})(WebviewIndex || {});
let McpServerEditor = class extends EditorPane {
  constructor(group, telemetryService, instantiationService, themeService, notificationService, openerService, storageService, extensionService, webviewService, languageService, contextKeyService, mcpWorkbenchService, hoverService, contextMenuService) {
    super(McpServerEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.extensionService = extensionService;
    this.webviewService = webviewService;
    this.languageService = languageService;
    this.contextKeyService = contextKeyService;
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.hoverService = hoverService;
    this.contextMenuService = contextMenuService;
    this._scopedContextKeyService = this._register(new MutableDisposable());
    // Some action bar items use a webview whose vertical scroll position we track in this map
    this.initialScrollProgress = /* @__PURE__ */ new Map();
    // Spot when an ExtensionEditor instance gets reused for a different extension, in which case the vertical scroll positions must be zeroed
    this.currentIdentifier = "";
    this.layoutParticipants = [];
    this.contentDisposables = this._register(new DisposableStore());
    this.transientDisposables = this._register(new DisposableStore());
    this.activeElement = null;
    this.mcpServerReadme = null;
    this.mcpServerManifest = null;
  }
  static {
    this.ID = "workbench.editor.mcpServer";
  }
  get scopedContextKeyService() {
    return this._scopedContextKeyService.value;
  }
  createEditor(parent) {
    const root = append(parent, $(".extension-editor.mcp-server-editor"));
    this._scopedContextKeyService.value = this.contextKeyService.createScoped(root);
    this._scopedContextKeyService.value.createKey("inExtensionEditor", true);
    root.tabIndex = 0;
    root.style.outline = "none";
    root.setAttribute("role", "document");
    const header = append(root, $(".header"));
    const iconContainer = append(header, $(".icon-container"));
    const iconWidget = this.instantiationService.createInstance(McpServerIconWidget, iconContainer);
    const scopeWidget = this.instantiationService.createInstance(McpServerScopeBadgeWidget, iconContainer);
    const details = append(header, $(".details"));
    const title = append(details, $(".title"));
    const name = append(title, $("span.name.clickable", { role: "heading", tabIndex: 0 }));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), name, localize("name", "Extension name")));
    const subtitle = append(details, $(".subtitle"));
    const subTitleEntryContainers = [];
    const publisherContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(publisherContainer);
    const publisherWidget = this.instantiationService.createInstance(PublisherWidget, publisherContainer, false);
    const starredContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(starredContainer);
    const installCountWidget = this.instantiationService.createInstance(StarredWidget, starredContainer, false);
    const licenseContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(licenseContainer);
    const licenseWidget = this.instantiationService.createInstance(LicenseWidget, licenseContainer);
    const widgets = [
      iconWidget,
      publisherWidget,
      installCountWidget,
      scopeWidget,
      licenseWidget
    ];
    const description = append(details, $(".description"));
    const actions = [
      this.instantiationService.createInstance(InstallAction, false),
      this.instantiationService.createInstance(InstallingLabelAction),
      this.instantiationService.createInstance(ButtonWithDropDownExtensionAction, "extensions.uninstall", UninstallAction.CLASS, [
        [
          this.instantiationService.createInstance(UninstallAction),
          this.instantiationService.createInstance(InstallInWorkspaceAction, false),
          this.instantiationService.createInstance(InstallInRemoteAction, false)
        ]
      ]),
      this.instantiationService.createInstance(EnableMcpDropDownAction),
      this.instantiationService.createInstance(DisableMcpDropDownAction),
      this.instantiationService.createInstance(ManageMcpServerAction, true)
    ];
    const actionsAndStatusContainer = append(details, $(".actions-status-container.mcp-server-actions"));
    const actionBar = this._register(new ActionBar(actionsAndStatusContainer, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof DropDownAction) {
          return action.createActionViewItem(options);
        }
        if (action instanceof ButtonWithDropDownExtensionAction) {
          return new ButtonWithDropdownExtensionActionViewItem(
            action,
            {
              ...options,
              icon: true,
              label: true,
              menuActionsOrProvider: { getActions: () => action.menuActions },
              menuActionClassNames: action.menuActionClassNames
            },
            this.contextMenuService
          );
        }
        return void 0;
      },
      focusOnlyEnabledItems: true
    }));
    actionBar.push(actions, { icon: true, label: true });
    actionBar.setFocusable(true);
    this._register(Event.any(...actions.map((a) => Event.filter(a.onDidChange, (e) => e.enabled !== void 0)))(() => {
      actionBar.setFocusable(false);
      actionBar.setFocusable(true);
    }));
    const otherContainers = [];
    const mcpServerStatusAction = this.instantiationService.createInstance(McpServerStatusAction);
    const mcpServerStatusWidget = this._register(this.instantiationService.createInstance(McpServerStatusWidget, append(actionsAndStatusContainer, $(".status")), mcpServerStatusAction));
    this._register(Event.any(mcpServerStatusWidget.onDidRender)(() => {
      if (this.dimension) {
        this.layout(this.dimension);
      }
    }));
    otherContainers.push(mcpServerStatusAction, new class extends McpServerWidget {
      render() {
        actionsAndStatusContainer.classList.toggle("list-layout", this.mcpServer?.installState === McpServerInstallState.Installed);
      }
    }());
    const mcpServerContainers = this.instantiationService.createInstance(McpServerContainers, [...actions, ...widgets, ...otherContainers]);
    for (const disposable of [...actions, ...widgets, ...otherContainers, mcpServerContainers]) {
      this._register(disposable);
    }
    const onError = Event.chain(
      actionBar.onDidRun,
      ($2) => $2.map(({ error }) => error).filter((error) => !!error)
    );
    this._register(onError(this.onError, this));
    const body = append(root, $(".body"));
    const navbar = new NavBar(body);
    const content = append(body, $(".content"));
    content.id = generateUuid();
    this.template = {
      content,
      description,
      header,
      name,
      navbar,
      actionsAndStatusContainer,
      actionBar,
      set mcpServer(mcpServer) {
        mcpServerContainers.mcpServer = mcpServer;
        let lastNonEmptySubtitleEntryContainer;
        for (const subTitleEntryElement of subTitleEntryContainers) {
          subTitleEntryElement.classList.remove("last-non-empty");
          if (subTitleEntryElement.children.length > 0) {
            lastNonEmptySubtitleEntryContainer = subTitleEntryElement;
          }
        }
        if (lastNonEmptySubtitleEntryContainer) {
          lastNonEmptySubtitleEntryContainer.classList.add("last-non-empty");
        }
      }
    };
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (this.template) {
      await this.render(input.mcpServer, this.template, !!options?.preserveFocus);
    }
  }
  async render(mcpServer, template, preserveFocus) {
    this.activeElement = null;
    this.transientDisposables.clear();
    const token = this.transientDisposables.add(new CancellationTokenSource()).token;
    this.mcpServerReadme = new Cache(() => mcpServer.getReadme(token));
    this.mcpServerManifest = new Cache(() => mcpServer.getManifest(token));
    template.mcpServer = mcpServer;
    template.name.textContent = mcpServer.label;
    template.name.classList.toggle("clickable", !!mcpServer.gallery?.webUrl);
    template.description.textContent = mcpServer.description;
    if (mcpServer.gallery?.webUrl) {
      this.transientDisposables.add(onClick(template.name, () => this.openerService.open(URI.parse(mcpServer.gallery?.webUrl))));
    }
    this.renderNavbar(mcpServer, template, preserveFocus);
  }
  setOptions(options) {
    super.setOptions(options);
    if (options?.tab) {
      this.template?.navbar.switch(options.tab);
    }
  }
  renderNavbar(extension, template, preserveFocus) {
    template.content.innerText = "";
    template.navbar.clear();
    if (this.currentIdentifier !== extension.id) {
      this.initialScrollProgress.clear();
      this.currentIdentifier = extension.id;
    }
    if (extension.readmeUrl || extension.gallery?.readme) {
      template.navbar.push("readme" /* Readme */, localize("details", "Details"), localize("detailstooltip", "Extension details, rendered from the extension's 'README.md' file"));
    }
    if (extension.gallery || extension.local?.manifest) {
      template.navbar.push("manifest" /* Manifest */, localize("manifest", "Manifest"), localize("manifesttooltip", "Server manifest details"));
    }
    if (extension.config) {
      template.navbar.push("configuration" /* Configuration */, localize("configuration", "Configuration"), localize("configurationtooltip", "Server configuration details"));
    }
    this.transientDisposables.add(this.mcpWorkbenchService.onChange((e) => {
      if (e === extension) {
        if (e.config && !template.navbar.has("configuration" /* Configuration */)) {
          template.navbar.push("configuration" /* Configuration */, localize("configuration", "Configuration"), localize("configurationtooltip", "Server configuration details"), extension.readmeUrl ? 1 : 0);
        }
        if (!e.config && template.navbar.has("configuration" /* Configuration */)) {
          template.navbar.remove("configuration" /* Configuration */);
        }
      }
    }));
    if (this.options?.tab) {
      template.navbar.switch(this.options.tab);
    }
    if (template.navbar.currentId) {
      this.onNavbarChange(extension, { id: template.navbar.currentId, focus: !preserveFocus }, template);
    }
    template.navbar.onChange((e) => this.onNavbarChange(extension, e, template), this, this.transientDisposables);
  }
  clearInput() {
    this.contentDisposables.clear();
    this.transientDisposables.clear();
    super.clearInput();
  }
  focus() {
    super.focus();
    this.activeElement?.focus();
  }
  showFind() {
    this.activeWebview?.showFind();
  }
  runFindAction(previous) {
    this.activeWebview?.runFindAction(previous);
  }
  get activeWebview() {
    if (!this.activeElement || !this.activeElement.runFindAction) {
      return void 0;
    }
    return this.activeElement;
  }
  onNavbarChange(extension, { id, focus }, template) {
    this.contentDisposables.clear();
    template.content.innerText = "";
    this.activeElement = null;
    if (id) {
      const cts = new CancellationTokenSource();
      this.contentDisposables.add(toDisposable(() => cts.dispose(true)));
      this.open(id, extension, template, cts.token).then((activeElement) => {
        if (cts.token.isCancellationRequested) {
          return;
        }
        this.activeElement = activeElement;
        if (focus) {
          this.focus();
        }
      });
    }
  }
  open(id, extension, template, token) {
    switch (id) {
      case "configuration" /* Configuration */:
        return this.openConfiguration(extension, template, token);
      case "readme" /* Readme */:
        return this.openDetails(extension, template, token);
      case "manifest" /* Manifest */:
        return extension.readmeUrl ? this.openManifest(extension, template.content, token) : this.openManifestWithAdditionalDetails(extension, template, token);
    }
    return Promise.resolve(null);
  }
  async openMarkdown(extension, cacheResult, noContentCopy, container, webviewIndex, title, token) {
    try {
      const body = await this.renderMarkdown(extension, cacheResult, container, token);
      if (token.isCancellationRequested) {
        return Promise.resolve(null);
      }
      const webview = this.contentDisposables.add(this.webviewService.createWebviewOverlay({
        title,
        options: {
          enableFindWidget: true,
          tryRestoreScrollPosition: true,
          disableServiceWorker: true
        },
        contentOptions: {},
        extension: void 0
      }));
      webview.initialScrollProgress = this.initialScrollProgress.get(webviewIndex) || 0;
      webview.claim(this, this.window, this.scopedContextKeyService);
      setParentFlowTo(webview.container, container);
      webview.setAnchorElement(container);
      webview.setHtml(body);
      webview.claim(this, this.window, void 0);
      this.contentDisposables.add(webview.onDidFocus(() => this._onDidFocus?.fire()));
      this.contentDisposables.add(webview.onDidScroll(() => this.initialScrollProgress.set(webviewIndex, webview.initialScrollProgress)));
      const removeLayoutParticipant = arrays.insert(this.layoutParticipants, {
        layout: () => {
          webview.setAnchorElement(container);
        }
      });
      this.contentDisposables.add(toDisposable(removeLayoutParticipant));
      let isDisposed = false;
      this.contentDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.contentDisposables.add(this.themeService.onDidColorThemeChange(async () => {
        const body2 = await this.renderMarkdown(extension, cacheResult, container);
        if (!isDisposed) {
          webview.setHtml(body2);
        }
      }));
      this.contentDisposables.add(webview.onDidClickLink((link) => {
        if (!link) {
          return;
        }
        if (matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.mailto)) {
          this.openerService.open(link);
        }
      }));
      return webview;
    } catch (e) {
      const p = append(container, $("p.nocontent"));
      p.textContent = noContentCopy;
      return p;
    }
  }
  async renderMarkdown(extension, cacheResult, container, token) {
    const contents = await this.loadContents(() => cacheResult, container);
    if (token?.isCancellationRequested) {
      return "";
    }
    const content = await renderMarkdownDocument(contents, this.extensionService, this.languageService, {}, token);
    if (token?.isCancellationRequested) {
      return "";
    }
    return this.renderBody(content);
  }
  renderBody(body) {
    const nonce = generateUuid();
    const colorMap = TokenizationRegistry.getColorMap();
    const css = colorMap ? generateTokensCSSForColorMap(colorMap) : "";
    return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; script-src 'none'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}

					/* prevent scroll-to-top button from blocking the body text */
					body {
						padding-bottom: 75px;
					}

					#scroll-to-top {
						position: fixed;
						width: 32px;
						height: 32px;
						right: 25px;
						bottom: 25px;
						background-color: var(--vscode-button-secondaryBackground);
						border-color: var(--vscode-button-border);
						border-radius: 50%;
						cursor: pointer;
						box-shadow: 1px 1px 1px rgba(0,0,0,.25);
						outline: none;
						display: flex;
						justify-content: center;
						align-items: center;
					}

					#scroll-to-top:hover {
						background-color: var(--vscode-button-secondaryHoverBackground);
						box-shadow: 2px 2px 2px rgba(0,0,0,.25);
					}

					body.vscode-high-contrast #scroll-to-top {
						border-width: 2px;
						border-style: solid;
						box-shadow: none;
					}

					#scroll-to-top span.icon::before {
						content: "";
						display: block;
						background: var(--vscode-button-secondaryForeground);
						/* Chevron up icon */
						webkit-mask-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						-webkit-mask-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						width: 16px;
						height: 16px;
					}
					${css}
				</style>
			</head>
			<body>
				<a id="scroll-to-top" role="button" aria-label="scroll to top" href="#"><span class="icon"></span></a>
				${body}
			</body>
		</html>`;
  }
  async openDetails(extension, template, token) {
    const details = append(template.content, $(".details"));
    const readmeContainer = append(details, $(".content-container"));
    const additionalDetailsContainer = append(details, $(".additional-details-container"));
    const layout = () => details.classList.toggle("narrow", this.dimension && this.dimension.width < 500);
    layout();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    const activeElement = await this.openMarkdown(extension, this.mcpServerReadme.get(), localize("noReadme", "No README available."), readmeContainer, 0 /* Readme */, localize("Readme title", "Readme"), token);
    this.renderAdditionalDetails(additionalDetailsContainer, extension);
    return activeElement;
  }
  async openConfiguration(mcpServer, template, token) {
    const configContainer = append(template.content, $(".configuration"));
    const content = $("div", { class: "configuration-content" });
    this.renderConfigurationDetails(content, mcpServer);
    const scrollableContent = new DomScrollableElement(content, {});
    const layout = () => scrollableContent.scanDomNode();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    append(configContainer, scrollableContent.getDomNode());
    return { focus: () => content.focus() };
  }
  async openManifestWithAdditionalDetails(mcpServer, template, token) {
    const details = append(template.content, $(".details"));
    const readmeContainer = append(details, $(".content-container"));
    const additionalDetailsContainer = append(details, $(".additional-details-container"));
    const layout = () => details.classList.toggle("narrow", this.dimension && this.dimension.width < 500);
    layout();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    const activeElement = await this.openManifest(mcpServer, readmeContainer, token);
    this.renderAdditionalDetails(additionalDetailsContainer, mcpServer);
    return activeElement;
  }
  async openManifest(mcpServer, parent, token) {
    const manifestContainer = append(parent, $(".manifest"));
    const content = $("div", { class: "manifest-content" });
    try {
      const manifest = await this.loadContents(() => this.mcpServerManifest.get(), content);
      if (token.isCancellationRequested) {
        return null;
      }
      this.renderManifestDetails(content, manifest);
    } catch (error) {
      while (content.firstChild) {
        content.removeChild(content.firstChild);
      }
      const noManifestMessage = append(content, $(".no-manifest"));
      noManifestMessage.textContent = localize("noManifest", "No manifest available for this MCP server.");
    }
    const scrollableContent = new DomScrollableElement(content, {});
    const layout = () => scrollableContent.scanDomNode();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    append(manifestContainer, scrollableContent.getDomNode());
    return { focus: () => content.focus() };
  }
  renderConfigurationDetails(container, mcpServer) {
    clearNode(container);
    const config = mcpServer.config;
    if (!config) {
      const noConfigMessage = append(container, $(".no-config"));
      noConfigMessage.textContent = localize("noConfig", "No configuration available for this MCP server.");
      return;
    }
    const nameSection = append(container, $(".config-section"));
    const nameLabel = append(nameSection, $(".config-label"));
    nameLabel.textContent = localize("serverName", "Name:");
    const nameValue = append(nameSection, $(".config-value"));
    nameValue.textContent = mcpServer.name;
    const typeSection = append(container, $(".config-section"));
    const typeLabel = append(typeSection, $(".config-label"));
    typeLabel.textContent = localize("serverType", "Type:");
    const typeValue = append(typeSection, $(".config-value"));
    typeValue.textContent = config.type;
    if (config.type === McpServerType.LOCAL) {
      const commandSection = append(container, $(".config-section"));
      const commandLabel = append(commandSection, $(".config-label"));
      commandLabel.textContent = localize("command", "Command:");
      const commandValue = append(commandSection, $("code.config-value"));
      commandValue.textContent = config.command;
      if (config.args && config.args.length > 0) {
        const argsSection = append(container, $(".config-section"));
        const argsLabel = append(argsSection, $(".config-label"));
        argsLabel.textContent = localize("arguments", "Arguments:");
        const argsValue = append(argsSection, $("code.config-value"));
        argsValue.textContent = config.args.join(" ");
      }
      if (config.env && Object.keys(config.env).length > 0) {
        const envSection = append(container, $(".config-section"));
        const envLabel = append(envSection, $(".config-label"));
        envLabel.textContent = localize("environment", "Environment:");
        const envValue = append(envSection, $(".config-value"));
        for (const [key, value] of Object.entries(config.env)) {
          append(envValue, $("code.env-entry", void 0, `${key}=${value ?? ""}`));
        }
      }
      if (config.envFile) {
        const envFileSection = append(container, $(".config-section"));
        const envFileLabel = append(envFileSection, $(".config-label"));
        envFileLabel.textContent = localize("envFile", "Environment File:");
        const envFileValue = append(envFileSection, $("code.config-value"));
        envFileValue.textContent = config.envFile;
      }
    } else if (config.type === McpServerType.REMOTE) {
      const urlSection = append(container, $(".config-section"));
      const urlLabel = append(urlSection, $(".config-label"));
      urlLabel.textContent = localize("url", "URL:");
      const urlValue = append(urlSection, $("code.config-value"));
      urlValue.textContent = config.url;
      if (config.headers && Object.keys(config.headers).length > 0) {
        const headersSection = append(container, $(".config-section"));
        const headersLabel = append(headersSection, $(".config-label"));
        headersLabel.textContent = localize("headers", "Headers:");
        const headersValue = append(headersSection, $(".config-value"));
        for (const [key, value] of Object.entries(config.headers)) {
          append(headersValue, $("code.env-entry", void 0, `${key}: ${value ?? ""}`));
        }
      }
    }
  }
  renderManifestDetails(container, manifest) {
    clearNode(container);
    if (manifest.packages && manifest.packages.length > 0) {
      const packagesByType = /* @__PURE__ */ new Map();
      for (const pkg of manifest.packages) {
        const type = pkg.registryType;
        let packages = packagesByType.get(type);
        if (!packages) {
          packagesByType.set(type, packages = []);
        }
        packages.push(pkg);
      }
      append(container, $(".manifest-section", void 0, $(".manifest-section-title", void 0, localize("packages", "Packages"))));
      for (const [packageType, packages] of packagesByType) {
        const packageSection = append(container, $(".package-section", void 0, $(".package-section-title", void 0, packageType.toUpperCase())));
        const packagesGrid = append(packageSection, $(".package-details"));
        for (let i = 0; i < packages.length; i++) {
          const pkg = packages[i];
          append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("packageName", "Package:")), $(".detail-value", void 0, pkg.identifier)));
          if (pkg.packageArguments && pkg.packageArguments.length > 0) {
            const argStrings = [];
            for (const arg of pkg.packageArguments) {
              if (arg.type === "named") {
                argStrings.push(arg.name);
                if (arg.value) {
                  argStrings.push(arg.value);
                }
              }
              if (arg.type === "positional") {
                const val = arg.value ?? arg.valueHint;
                if (val) {
                  argStrings.push(val);
                }
              }
            }
            append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("packagearguments", "Package Arguments:")), $("code.detail-value", void 0, argStrings.join(" "))));
          }
          if (pkg.runtimeArguments && pkg.runtimeArguments.length > 0) {
            const argStrings = [];
            for (const arg of pkg.runtimeArguments) {
              if (arg.type === "named") {
                argStrings.push(arg.name);
                if (arg.value) {
                  argStrings.push(arg.value);
                }
              }
              if (arg.type === "positional") {
                const val = arg.value ?? arg.valueHint;
                if (val) {
                  argStrings.push(val);
                }
              }
            }
            append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("runtimeargs", "Runtime Arguments:")), $("code.detail-value", void 0, argStrings.join(" "))));
          }
          if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
            const envStrings = pkg.environmentVariables.map((envVar) => `${envVar.name}=${envVar.value ?? ""}`);
            append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("environmentVariables", "Environment Variables:")), $("code.detail-value", void 0, envStrings.join(" "))));
          }
          if (i < packages.length - 1) {
            append(packagesGrid, $(".package-separator"));
          }
        }
      }
    }
    if (manifest.remotes && manifest.remotes.length > 0) {
      const packageSection = append(container, $(".package-section", void 0, $(".package-section-title", void 0, localize("remotes", "Remote").toLocaleUpperCase())));
      for (const remote of manifest.remotes) {
        const packagesGrid = append(packageSection, $(".package-details"));
        append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("url", "URL:")), $(".detail-value", void 0, remote.url)));
        if (remote.type) {
          append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("transport", "Transport:")), $(".detail-value", void 0, remote.type)));
        }
        if (remote.headers && remote.headers.length > 0) {
          const headerStrings = remote.headers.map((header) => `${header.name}: ${header.value ?? ""}`);
          append(packagesGrid, $(".package-detail", void 0, $(".detail-label", void 0, localize("headers", "Headers:")), $(".detail-value", void 0, headerStrings.join(", "))));
        }
      }
    }
  }
  renderAdditionalDetails(container, extension) {
    const content = $("div", { class: "additional-details-content", tabindex: "0" });
    const scrollableContent = new DomScrollableElement(content, {});
    const layout = () => scrollableContent.scanDomNode();
    const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout });
    this.contentDisposables.add(toDisposable(removeLayoutParticipant));
    this.contentDisposables.add(scrollableContent);
    this.contentDisposables.add(this.instantiationService.createInstance(AdditionalDetailsWidget, content, extension));
    append(container, scrollableContent.getDomNode());
    scrollableContent.scanDomNode();
  }
  loadContents(loadingTask, container) {
    container.classList.add("loading");
    const result = this.contentDisposables.add(loadingTask());
    const onDone = () => container.classList.remove("loading");
    result.promise.then(onDone, onDone);
    return result.promise;
  }
  layout(dimension) {
    this.dimension = dimension;
    this.layoutParticipants.forEach((p) => p.layout());
  }
  onError(err) {
    if (isCancellationError(err)) {
      return;
    }
    this.notificationService.error(err);
  }
};
McpServerEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IWebviewService),
  __decorateParam(9, ILanguageService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IMcpWorkbenchService),
  __decorateParam(12, IHoverService),
  __decorateParam(13, IContextMenuService)
], McpServerEditor);
let AdditionalDetailsWidget = class extends Disposable {
  constructor(container, extension, mcpGalleryManifestService, hoverService, openerService) {
    super();
    this.container = container;
    this.mcpGalleryManifestService = mcpGalleryManifestService;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.disposables = this._register(new DisposableStore());
    this.render(extension);
    this._register(this.mcpGalleryManifestService.onDidChangeMcpGalleryManifest(() => this.render(extension)));
  }
  render(extension) {
    this.container.innerText = "";
    this.disposables.clear();
    if (extension.local) {
      this.renderInstallInfo(this.container, extension.local);
    }
    if (extension.gallery) {
      this.renderMarketplaceInfo(this.container, extension);
    }
    this.renderTags(this.container, extension);
    this.renderExtensionResources(this.container, extension);
  }
  renderTags(container, extension) {
    if (extension.gallery?.topics?.length) {
      const categoriesContainer = append(container, $(".categories-container.additional-details-element"));
      append(categoriesContainer, $(".additional-details-title", void 0, localize("tags", "Tags")));
      const categoriesElement = append(categoriesContainer, $(".categories"));
      for (const category of extension.gallery.topics) {
        append(categoriesElement, $("span.category", { tabindex: "0" }, category));
      }
    }
  }
  async renderExtensionResources(container, extension) {
    const resources = [];
    const manifest = await this.mcpGalleryManifestService.getMcpGalleryManifest();
    if (extension.repository) {
      try {
        resources.push([localize("repository", "Repository"), ThemeIcon.fromId(Codicon.repo.id), URI.parse(extension.repository)]);
      } catch (error) {
      }
    }
    if (manifest) {
      const supportUri = getMcpGalleryManifestResourceUri(manifest, McpGalleryResourceType.ContactSupportUri);
      if (supportUri) {
        try {
          resources.push([localize("support", "Contact Support"), ThemeIcon.fromId(Codicon.commentDiscussion.id), URI.parse(supportUri)]);
        } catch (error) {
        }
      }
    }
    if (resources.length) {
      const extensionResourcesContainer = append(container, $(".resources-container.additional-details-element"));
      append(extensionResourcesContainer, $(".additional-details-title", void 0, localize("resources", "Resources")));
      const resourcesElement = append(extensionResourcesContainer, $(".resources"));
      for (const [label, icon, uri] of resources) {
        const resourceElement = append(resourcesElement, $(".resource"));
        append(resourceElement, $(ThemeIcon.asCSSSelector(icon)));
        append(resourceElement, $("a", { tabindex: "0" }, label));
        this.disposables.add(onClick(resourceElement, () => this.openerService.open(uri)));
        this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), resourceElement, uri.toString()));
      }
    }
  }
  renderInstallInfo(container, extension) {
    const installInfoContainer = append(container, $(".more-info-container.additional-details-element"));
    append(installInfoContainer, $(".additional-details-title", void 0, localize("Install Info", "Installation")));
    const installInfo = append(installInfoContainer, $(".more-info"));
    append(
      installInfo,
      $(
        ".more-info-entry",
        void 0,
        $("div.more-info-entry-name", void 0, localize("id", "Identifier")),
        $("code", void 0, extension.name)
      )
    );
    if (extension.version) {
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("Version", "Version")),
          $("code", void 0, extension.version)
        )
      );
    }
  }
  renderMarketplaceInfo(container, extension) {
    const gallery = extension.gallery;
    const moreInfoContainer = append(container, $(".more-info-container.additional-details-element"));
    append(moreInfoContainer, $(".additional-details-title", void 0, localize("Marketplace Info", "Marketplace")));
    const moreInfo = append(moreInfoContainer, $(".more-info"));
    if (gallery) {
      if (!extension.local) {
        append(
          moreInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", void 0, localize("id", "Identifier")),
            $("code", void 0, extension.name)
          )
        );
        if (gallery.version) {
          append(
            moreInfo,
            $(
              ".more-info-entry",
              void 0,
              $("div.more-info-entry-name", void 0, localize("Version", "Version")),
              $("code", void 0, gallery.version)
            )
          );
        }
      }
      if (gallery.lastUpdated) {
        append(
          moreInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", void 0, localize("last updated", "Last Released")),
            $("div", {
              "title": new Date(gallery.lastUpdated).toString()
            }, fromNow(gallery.lastUpdated, true, true, true))
          )
        );
      }
      if (gallery.publishDate) {
        append(
          moreInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", void 0, localize("published", "Published")),
            $("div", {
              "title": new Date(gallery.publishDate).toString()
            }, fromNow(gallery.publishDate, true, true, true))
          )
        );
      }
    }
  }
};
AdditionalDetailsWidget = __decorateClass([
  __decorateParam(2, IMcpGalleryManifestService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IOpenerService)
], AdditionalDetailsWidget);
export {
  McpServerEditor
};
