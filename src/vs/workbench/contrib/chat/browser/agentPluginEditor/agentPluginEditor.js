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
import { $, EventType, addDisposableListener, append, reset, setParentFlowTo } from "../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { Action } from "../../../../../base/common/actions.js";
import * as arrays from "../../../../../base/common/arrays.js";
import { Cache } from "../../../../../base/common/cache.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas, matchesScheme } from "../../../../../base/common/network.js";
import { autorun, derived } from "../../../../../base/common/observable.js";
import { dirname, joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { TokenizationRegistry } from "../../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { generateTokensCSSForColorMap } from "../../../../../editor/common/languages/supports/tokenization.js";
import { localize } from "../../../../../nls.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IRequestService, asText } from "../../../../../platform/request/common/request.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../../browser/parts/editor/editorPane.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from "../../../markdown/browser/markdownDocumentRenderer.js";
import { IWebviewService } from "../../../webview/browser/webview.js";
import { IAgentPluginService } from "../../common/plugins/agentPluginService.js";
import { IPluginInstallService } from "../../common/plugins/pluginInstallService.js";
import { hasSourceChanged, IPluginMarketplaceService } from "../../common/plugins/pluginMarketplaceService.js";
import { AgentPluginItemKind } from "./agentPluginItems.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { EnablementStatusWidget, pluginEnablementLabels } from "../enablementStatusWidget.js";
import { InstallPluginAction, createUninstallPluginAction, createEnablePluginDropDown, createDisablePluginDropDown, createPolicyBlockedEnableAction, isPluginPolicyBlocked, EnablementDropDownAction, EnablementDropdownActionViewItem } from "../agentPluginActions.js";
import "./media/agentPluginEditor.css";
var WebviewIndex = /* @__PURE__ */ ((WebviewIndex2) => {
  WebviewIndex2[WebviewIndex2["Readme"] = 0] = "Readme";
  return WebviewIndex2;
})(WebviewIndex || {});
let AgentPluginEditor = class extends EditorPane {
  constructor(group, telemetryService, instantiationService, themeService, openerService, storageService, extensionService, webviewService, languageService, fileService, requestService, agentPluginService, pluginInstallService, pluginMarketplaceService, labelService, contextMenuService) {
    super(AgentPluginEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.extensionService = extensionService;
    this.webviewService = webviewService;
    this.languageService = languageService;
    this.fileService = fileService;
    this.requestService = requestService;
    this.agentPluginService = agentPluginService;
    this.pluginInstallService = pluginInstallService;
    this.pluginMarketplaceService = pluginMarketplaceService;
    this.labelService = labelService;
    this.contextMenuService = contextMenuService;
    this.pluginReadme = null;
    this.initialScrollProgress = /* @__PURE__ */ new Map();
    this.currentIdentifier = "";
    this.layoutParticipants = [];
    this.contentDisposables = this._register(new DisposableStore());
    this.transientDisposables = this._register(new DisposableStore());
    this.activeElement = null;
  }
  static {
    this.ID = "workbench.editor.agentPlugin";
  }
  createEditor(parent) {
    const root = append(parent, $(".extension-editor.agent-plugin-editor"));
    root.tabIndex = 0;
    root.style.outline = "none";
    root.setAttribute("role", "document");
    const header = append(root, $(".header"));
    const iconContainer = append(header, $(".icon-container"));
    const icon = append(iconContainer, $("span.codicon.codicon-extensions"));
    icon.style.fontSize = "64px";
    const details = append(header, $(".details"));
    const title = append(details, $(".title"));
    const name = append(title, $("span.name", { role: "heading", tabIndex: 0 }));
    const description = append(details, $(".description"));
    const subtitle = append(details, $(".subtitle"));
    const marketplace = append(subtitle, $("span.subtitle-entry"));
    const actionsAndStatusContainer = append(details, $(".actions-status-container"));
    const actionBar = this._register(new ActionBar(actionsAndStatusContainer, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof EnablementDropDownAction) {
          return new EnablementDropdownActionViewItem(
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
    actionBar.setFocusable(true);
    const statusContainer = append(actionsAndStatusContainer, $(".status"));
    const body = append(root, $(".body"));
    const content = append(body, $(".content"));
    content.id = generateUuid();
    this.template = {
      content,
      description,
      header,
      name,
      marketplace,
      actionBar,
      statusContainer
    };
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (this.template) {
      await this.render(input.item, this.template);
    }
  }
  async render(item, template) {
    this.activeElement = null;
    this.transientDisposables.clear();
    this.contentDisposables.clear();
    template.content.innerText = "";
    const cts = new CancellationTokenSource();
    this.transientDisposables.add(toDisposable(() => cts.dispose(true)));
    const token = cts.token;
    const itemId = item.kind === AgentPluginItemKind.Installed ? item.plugin.uri.toString() : `${item.marketplaceReference.canonicalId}/${item.source}`;
    if (this.currentIdentifier !== itemId) {
      this.initialScrollProgress.clear();
      this.currentIdentifier = itemId;
    }
    this.pluginReadme = new Cache(() => this.fetchReadme(item, token));
    template.name.textContent = item.name;
    template.description.textContent = item.description;
    const marketplaceLabel = item.marketplace ?? "";
    const githubRepo = item.kind === AgentPluginItemKind.Marketplace ? item.marketplaceReference.githubRepo : item.plugin.fromMarketplace?.marketplaceReference.githubRepo;
    if (marketplaceLabel && githubRepo) {
      const url = `https://github.com/${githubRepo}`;
      const link = $("a.marketplace-link", { href: url }, marketplaceLabel);
      this.transientDisposables.add(addDisposableListener(link, EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openerService.open(URI.parse(url));
      }));
      reset(template.marketplace, link);
    } else {
      reset(template.marketplace, marketplaceLabel);
    }
    const currentItem = derived((reader) => {
      const allPlugins = this.agentPluginService.plugins.read(reader);
      let currentItem2 = item;
      if (item.kind === AgentPluginItemKind.Marketplace) {
        const expectedUri = this.pluginInstallService.getPluginInstallUri({
          name: item.name,
          description: item.description,
          version: "",
          source: item.source,
          sourceDescriptor: item.sourceDescriptor,
          marketplace: item.marketplace,
          marketplaceReference: item.marketplaceReference,
          marketplaceType: item.marketplaceType
        });
        const installedPlugin = allPlugins.find((p) => p.uri.toString() === expectedUri.toString());
        if (installedPlugin) {
          currentItem2 = this.installedPluginToItem(installedPlugin);
        }
      } else {
        const stillInstalled = allPlugins.find((p) => p.uri.toString() === item.plugin.uri.toString());
        if (!stillInstalled) {
          if (item.plugin.fromMarketplace) {
            const mp = item.plugin.fromMarketplace;
            currentItem2 = {
              kind: AgentPluginItemKind.Marketplace,
              name: item.name,
              description: mp.description,
              source: mp.source,
              sourceDescriptor: mp.sourceDescriptor,
              marketplace: mp.marketplace,
              marketplaceReference: mp.marketplaceReference,
              marketplaceType: mp.marketplaceType,
              readmeUri: mp.readmeUri
            };
          } else {
            return;
          }
        } else {
          stillInstalled.enablement.read(reader);
          currentItem2 = this.installedPluginToItem(stillInstalled);
        }
      }
      return currentItem2;
    });
    const storedPlugin = currentItem.map((item2, r) => {
      if (!item2 || item2.kind === AgentPluginItemKind.Marketplace) {
        return void 0;
      }
      return this.pluginMarketplaceService.installedPlugins.read(r).find((e) => e.pluginUri.toString() === item2.plugin.uri.toString())?.plugin ?? item2.plugin.fromMarketplace;
    });
    const actionDisposables = this.transientDisposables.add(new DisposableStore());
    this.transientDisposables.add(autorun((reader) => {
      actionDisposables.clear();
      template.actionBar.clear();
      const current = currentItem.read(reader);
      if (!current) {
        return;
      }
      this.pluginMarketplaceService.lastFetchedPlugins.read(reader);
      const actions = this.getItemActions(current, storedPlugin.read(reader));
      if (actions.length > 0) {
        template.actionBar.push(actions, { icon: true, label: true });
      }
      for (const action of actions) {
        actionDisposables.add(action);
      }
      if (current.kind === AgentPluginItemKind.Installed) {
        actionDisposables.add(this.instantiationService.createInstance(
          EnablementStatusWidget,
          template.statusContainer,
          current.plugin.enablement,
          pluginEnablementLabels
        ));
      }
    }));
    this.activeElement = await this.openDetails(item, template, token);
  }
  getItemActions(item, storedPlugin) {
    if (item.kind === AgentPluginItemKind.Marketplace) {
      return [this.instantiationService.createInstance(InstallPluginAction, item)];
    }
    const workspaceService = this.instantiationService.invokeFunction((a) => a.get(IWorkspaceContextService));
    const actions = [];
    if (storedPlugin) {
      const cachedMarketplace = this.pluginMarketplaceService.lastFetchedPlugins.get();
      const key = `${storedPlugin.marketplaceReference.canonicalId}::${storedPlugin.name}`;
      const livePlugin = cachedMarketplace.find(
        (mp) => `${mp.marketplaceReference.canonicalId}::${mp.name}` === key
      );
      if (livePlugin && hasSourceChanged(storedPlugin.sourceDescriptor, livePlugin.sourceDescriptor)) {
        actions.push(this.instantiationService.createInstance(UpdatePluginEditorAction, item.plugin, livePlugin));
      }
    }
    if (isPluginPolicyBlocked(item.plugin)) {
      const notificationService = this.instantiationService.invokeFunction((a) => a.get(INotificationService));
      actions.push(createPolicyBlockedEnableAction(item.plugin, notificationService));
    } else {
      actions.push(createEnablePluginDropDown(item.plugin, this.agentPluginService.enablementModel, workspaceService));
      actions.push(createDisablePluginDropDown(item.plugin, this.agentPluginService.enablementModel, workspaceService));
    }
    const uninstallAction = createUninstallPluginAction(item.plugin);
    if (uninstallAction) {
      actions.push(uninstallAction);
    }
    return actions;
  }
  installedPluginToItem(plugin) {
    const name = plugin.label;
    const description = plugin.fromMarketplace?.description ?? this.labelService.getUriLabel(dirname(plugin.uri), { relative: true });
    const marketplace = plugin.fromMarketplace?.marketplace;
    return { kind: AgentPluginItemKind.Installed, name, description, marketplace, plugin };
  }
  async fetchReadme(item, token) {
    let readmeUri;
    if (item.kind === AgentPluginItemKind.Installed) {
      readmeUri = joinPath(item.plugin.uri, "README.md");
    } else {
      readmeUri = item.readmeUri;
    }
    if (!readmeUri) {
      return "";
    }
    if (readmeUri.scheme === Schemas.file || readmeUri.scheme === Schemas.vscodeRemote) {
      try {
        const content = await this.fileService.readFile(readmeUri);
        return content.value.toString();
      } catch {
        return "";
      }
    }
    if (readmeUri.scheme === Schemas.https) {
      let rawUrl = readmeUri.toString();
      const githubBlobMatch = rawUrl.match(/^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/blob\/(?<rest>.+)$/);
      if (githubBlobMatch?.groups) {
        rawUrl = `https://raw.githubusercontent.com/${githubBlobMatch.groups["owner"]}/${githubBlobMatch.groups["repo"]}/${githubBlobMatch.groups["rest"]}`;
      }
      try {
        const context = await this.requestService.request({ type: "GET", url: rawUrl, callSite: "agentPluginEditor.fetchReadme" }, token);
        const text = await asText(context);
        return text ?? "";
      } catch {
        return "";
      }
    }
    return "";
  }
  async openDetails(item, template, token) {
    const details = append(template.content, $(".details"));
    const readmeContainer = append(details, $(".content-container"));
    const layout = () => details.classList.toggle("narrow", this.dimension !== void 0 && this.dimension.width < 500);
    layout();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    return this.openMarkdown(this.pluginReadme.get(), localize("noReadme", "No README available."), readmeContainer, 0 /* Readme */, localize("Readme title", "Readme"), token);
  }
  async openMarkdown(cacheResult, noContentCopy, container, webviewIndex, title, token) {
    try {
      const body = await this.renderMarkdown(cacheResult, container, token);
      if (token.isCancellationRequested) {
        return null;
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
      webview.claim(this, this.window, void 0);
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
        const body2 = await this.renderMarkdown(cacheResult, container);
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
  async renderMarkdown(cacheResult, container, token) {
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
  loadContents(loadingTask, container) {
    container.classList.add("loading");
    const result = this.contentDisposables.add(loadingTask());
    const onDone = () => container.classList.remove("loading");
    result.promise.then(onDone, onDone);
    return result.promise;
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
  get activeWebview() {
    if (!this.activeElement || !this.activeElement.runFindAction) {
      return void 0;
    }
    return this.activeElement;
  }
  layout(dimension) {
    this.dimension = dimension;
    this.layoutParticipants.forEach((p) => p.layout());
  }
};
AgentPluginEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IWebviewService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IRequestService),
  __decorateParam(11, IAgentPluginService),
  __decorateParam(12, IPluginInstallService),
  __decorateParam(13, IPluginMarketplaceService),
  __decorateParam(14, ILabelService),
  __decorateParam(15, IContextMenuService)
], AgentPluginEditor);
let UpdatePluginEditorAction = class extends Action {
  constructor(plugin, liveMarketplacePlugin, pluginInstallService, pluginMarketplaceService) {
    super(UpdatePluginEditorAction.ID, localize("update", "Update"), "extension-action label prominent install");
    this.plugin = plugin;
    this.liveMarketplacePlugin = liveMarketplacePlugin;
    this.pluginInstallService = pluginInstallService;
    this.pluginMarketplaceService = pluginMarketplaceService;
  }
  static {
    this.ID = "agentPlugin.editor.update";
  }
  async run() {
    if (await this.pluginInstallService.updatePlugin(this.liveMarketplacePlugin)) {
      this.pluginMarketplaceService.addInstalledPlugin(this.plugin.uri, this.liveMarketplacePlugin);
    }
  }
};
UpdatePluginEditorAction = __decorateClass([
  __decorateParam(2, IPluginInstallService),
  __decorateParam(3, IPluginMarketplaceService)
], UpdatePluginEditorAction);
export {
  AgentPluginEditor
};
