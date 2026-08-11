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
import { $, append, hide, setParentFlowTo, show } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { CheckboxActionViewItem } from "../../../../base/browser/ui/toggle/toggle.js";
import { Action } from "../../../../base/common/actions.js";
import * as arrays from "../../../../base/common/arrays.js";
import { Cache } from "../../../../base/common/cache.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import { isNative } from "../../../../base/common/platform.js";
import { isUndefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import "./media/extensionEditor.css";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { TokenizationRegistry } from "../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { generateTokensCSSForColorMap } from "../../../../editor/common/languages/supports/tokenization.js";
import { localize } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { computeSize, FilterType, IExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { defaultCheckboxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { buttonForeground, buttonHoverBackground, editorBackground, textLinkActiveForeground, textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ExtensionFeaturesTab } from "./extensionFeaturesTab.js";
import {
  ButtonWithDropDownExtensionAction,
  ClearLanguageAction,
  DisableDropDownAction,
  EnableDropDownAction,
  ButtonWithDropdownExtensionActionViewItem,
  DropDownExtensionAction,
  ExtensionEditorManageExtensionAction,
  ExtensionStatusAction,
  ExtensionStatusLabelAction,
  InstallAnotherVersionAction,
  InstallDropdownAction,
  InstallingLabelAction,
  LocalInstallAction,
  MigrateDeprecatedExtensionAction,
  ExtensionRuntimeStateAction,
  RemoteInstallAction,
  SetColorThemeAction,
  SetFileIconThemeAction,
  SetLanguageAction,
  SetProductIconThemeAction,
  ToggleAutoUpdateForExtensionAction,
  UninstallAction,
  UpdateAction,
  WebInstallAction,
  TogglePreReleaseExtensionAction
} from "./extensionsActions.js";
import { Delegate } from "./extensionsList.js";
import { ExtensionData, ExtensionsGridView, ExtensionsTree, getExtensions } from "./extensionsViewer.js";
import { ExtensionRecommendationWidget, ExtensionStatusWidget, ExtensionWidget, InstallCountWidget, RatingsWidget, RemoteBadgeWidget, SponsorWidget, PublisherWidget, onClick, ExtensionKindIndicatorWidget, ExtensionIconWidget } from "./extensionsWidgets.js";
import { ExtensionContainers, ExtensionEditorTab, ExtensionState, IExtensionsWorkbenchService } from "../common/extensions.js";
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from "../../markdown/browser/markdownDocumentRenderer.js";
import { IWebviewService, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from "../../webview/browser/webview.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ByteSize, IFileService } from "../../../../platform/files/common/files.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
import { ShowCurrentReleaseNotesActionId } from "../../update/common/update.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { fromNow } from "../../../../base/common/date.js";
class NavBar extends Disposable {
  constructor(container) {
    super();
    this._onChange = this._register(new Emitter());
    this.onChange = this._onChange.event;
    this._currentId = null;
    const element = append(container, $(".navbar"));
    this.actions = [];
    this.actionbar = this._register(new ActionBar(element));
  }
  get currentId() {
    return this._currentId;
  }
  push(id, label, tooltip) {
    const action = new Action(id, label, void 0, true, () => this.update(id, true));
    action.tooltip = tooltip;
    this.actions.push(action);
    this.actionbar.push(action);
    if (this.actions.length === 1) {
      this.update(id);
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
  update(id, focus) {
    this._currentId = id;
    this._onChange.fire({ id, focus: !!focus });
    this.actions.forEach((a) => a.checked = a.id === id);
  }
  dispose() {
    this.clear();
    super.dispose();
  }
}
var WebviewIndex = /* @__PURE__ */ ((WebviewIndex2) => {
  WebviewIndex2[WebviewIndex2["Readme"] = 0] = "Readme";
  WebviewIndex2[WebviewIndex2["Changelog"] = 1] = "Changelog";
  return WebviewIndex2;
})(WebviewIndex || {});
const CONTEXT_SHOW_PRE_RELEASE_VERSION = new RawContextKey("showPreReleaseVersion", false);
class ExtensionWithDifferentGalleryVersionWidget extends ExtensionWidget {
  constructor() {
    super(...arguments);
    this._gallery = null;
  }
  get gallery() {
    return this._gallery;
  }
  set gallery(gallery) {
    if (this.extension && gallery && !areSameExtensions(this.extension.identifier, gallery.identifier)) {
      return;
    }
    this._gallery = gallery;
    this.update();
  }
}
class VersionWidget extends ExtensionWithDifferentGalleryVersionWidget {
  constructor(container, hoverService) {
    super();
    this.element = append(container, $("code.version", void 0, "pre-release"));
    this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, localize("extension version", "Extension Version")));
    this.render();
  }
  render() {
    if (this.extension?.preRelease) {
      show(this.element);
    } else {
      hide(this.element);
    }
  }
}
let ExtensionEditor = class extends EditorPane {
  constructor(group, telemetryService, instantiationService, extensionsWorkbenchService, extensionGalleryService, themeService, notificationService, openerService, extensionRecommendationsService, storageService, extensionService, webviewService, languageService, contextMenuService, contextKeyService, hoverService) {
    super(ExtensionEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionGalleryService = extensionGalleryService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.extensionRecommendationsService = extensionRecommendationsService;
    this.extensionService = extensionService;
    this.webviewService = webviewService;
    this.languageService = languageService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this._scopedContextKeyService = this._register(new MutableDisposable());
    // Some action bar items use a webview whose vertical scroll position we track in this map
    this.initialScrollProgress = /* @__PURE__ */ new Map();
    // Spot when an ExtensionEditor instance gets reused for a different extension, in which case the vertical scroll positions must be zeroed
    this.currentIdentifier = "";
    this.layoutParticipants = [];
    this.contentDisposables = this._register(new DisposableStore());
    this.transientDisposables = this._register(new DisposableStore());
    this.activeElement = null;
    this.extensionReadme = null;
    this.extensionChangelog = null;
    this.extensionManifest = null;
  }
  static {
    this.ID = "workbench.editor.extension";
  }
  get scopedContextKeyService() {
    return this._scopedContextKeyService.value;
  }
  createEditor(parent) {
    const root = append(parent, $(".extension-editor"));
    this._scopedContextKeyService.value = this.contextKeyService.createScoped(root);
    this._scopedContextKeyService.value.createKey("inExtensionEditor", true);
    this.showPreReleaseVersionContextKey = CONTEXT_SHOW_PRE_RELEASE_VERSION.bindTo(this._scopedContextKeyService.value);
    root.tabIndex = 0;
    root.style.outline = "none";
    root.setAttribute("role", "document");
    const header = append(root, $(".header"));
    const iconContainer = append(header, $(".icon-container"));
    const iconWidget = this.instantiationService.createInstance(ExtensionIconWidget, iconContainer);
    const remoteBadge = this.instantiationService.createInstance(RemoteBadgeWidget, iconContainer, true);
    const details = append(header, $(".details"));
    const title = append(details, $(".title"));
    const name = append(title, $("span.name.clickable", { role: "heading", tabIndex: 0 }));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), name, localize("name", "Extension name")));
    const versionWidget = new VersionWidget(title, this.hoverService);
    const preview = append(title, $("span.preview"));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), preview, localize("preview", "Preview")));
    preview.textContent = localize("preview", "Preview");
    const builtin = append(title, $("span.builtin"));
    builtin.textContent = localize("builtin", "Built-in");
    const subtitle = append(details, $(".subtitle"));
    const subTitleEntryContainers = [];
    const publisherContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(publisherContainer);
    const publisherWidget = this.instantiationService.createInstance(PublisherWidget, publisherContainer, false);
    const extensionKindContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(extensionKindContainer);
    const extensionKindWidget = this.instantiationService.createInstance(ExtensionKindIndicatorWidget, extensionKindContainer, false);
    const installCountContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(installCountContainer);
    const installCountWidget = this.instantiationService.createInstance(InstallCountWidget, installCountContainer, false);
    const ratingsContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(ratingsContainer);
    const ratingsWidget = this.instantiationService.createInstance(RatingsWidget, ratingsContainer, false);
    const sponsorContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(sponsorContainer);
    const sponsorWidget = this.instantiationService.createInstance(SponsorWidget, sponsorContainer);
    const widgets = [
      iconWidget,
      remoteBadge,
      versionWidget,
      publisherWidget,
      extensionKindWidget,
      installCountWidget,
      ratingsWidget,
      sponsorWidget
    ];
    const description = append(details, $(".description"));
    const installAction = this.instantiationService.createInstance(InstallDropdownAction);
    const actions = [
      this.instantiationService.createInstance(ExtensionRuntimeStateAction),
      this.instantiationService.createInstance(ExtensionStatusLabelAction),
      this.instantiationService.createInstance(UpdateAction, true),
      this.instantiationService.createInstance(SetColorThemeAction),
      this.instantiationService.createInstance(SetFileIconThemeAction),
      this.instantiationService.createInstance(SetProductIconThemeAction),
      this.instantiationService.createInstance(SetLanguageAction),
      this.instantiationService.createInstance(ClearLanguageAction),
      this.instantiationService.createInstance(EnableDropDownAction),
      this.instantiationService.createInstance(TogglePreReleaseExtensionAction),
      this.instantiationService.createInstance(DisableDropDownAction),
      this.instantiationService.createInstance(RemoteInstallAction, false),
      this.instantiationService.createInstance(LocalInstallAction),
      this.instantiationService.createInstance(WebInstallAction),
      installAction,
      this.instantiationService.createInstance(InstallingLabelAction),
      this.instantiationService.createInstance(ButtonWithDropDownExtensionAction, "extensions.uninstall", UninstallAction.UninstallClass, [
        [
          this.instantiationService.createInstance(MigrateDeprecatedExtensionAction, false),
          this.instantiationService.createInstance(UninstallAction),
          this.instantiationService.createInstance(InstallAnotherVersionAction, null, true)
        ]
      ]),
      this.instantiationService.createInstance(ToggleAutoUpdateForExtensionAction),
      new ExtensionEditorManageExtensionAction(this.scopedContextKeyService || this.contextKeyService, this.instantiationService)
    ];
    const actionsAndStatusContainer = append(details, $(".actions-status-container"));
    const extensionActionBar = this._register(new ActionBar(actionsAndStatusContainer, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof DropDownExtensionAction) {
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
        if (action instanceof ToggleAutoUpdateForExtensionAction) {
          return new CheckboxActionViewItem(void 0, action, { ...options, icon: true, label: true, checkboxStyles: defaultCheckboxStyles });
        }
        return void 0;
      },
      focusOnlyEnabledItems: true
    }));
    extensionActionBar.push(actions, { icon: true, label: true });
    extensionActionBar.setFocusable(true);
    this._register(Event.any(...actions.map((a) => Event.filter(a.onDidChange, (e) => e.enabled !== void 0)))(() => {
      extensionActionBar.setFocusable(false);
      extensionActionBar.setFocusable(true);
    }));
    const otherExtensionContainers = [];
    const extensionStatusAction = this.instantiationService.createInstance(ExtensionStatusAction);
    const extensionStatusWidget = this._register(this.instantiationService.createInstance(ExtensionStatusWidget, append(actionsAndStatusContainer, $(".status")), extensionStatusAction));
    otherExtensionContainers.push(extensionStatusAction, new class extends ExtensionWidget {
      render() {
        actionsAndStatusContainer.classList.toggle("list-layout", this.extension?.state === ExtensionState.Installed);
      }
    }());
    const recommendationWidget = this.instantiationService.createInstance(ExtensionRecommendationWidget, append(details, $(".recommendation")));
    widgets.push(recommendationWidget);
    this._register(Event.any(extensionStatusWidget.onDidRender, recommendationWidget.onDidRender)(() => {
      if (this.dimension) {
        this.layout(this.dimension);
      }
    }));
    const extensionContainers = this.instantiationService.createInstance(ExtensionContainers, [...actions, ...widgets, ...otherExtensionContainers]);
    for (const disposable of [...actions, ...widgets, ...otherExtensionContainers, extensionContainers]) {
      this._register(disposable);
    }
    const onError = Event.chain(
      extensionActionBar.onDidRun,
      ($2) => $2.map(({ error }) => error).filter((error) => !!error)
    );
    this._register(onError(this.onError, this));
    const body = append(root, $(".body"));
    const navbar = this._register(new NavBar(body));
    const content = append(body, $(".content"));
    content.id = generateUuid();
    this.template = {
      builtin,
      content,
      description,
      header,
      name,
      navbar,
      preview,
      actionsAndStatusContainer,
      extensionActionBar,
      set extension(extension) {
        extensionContainers.extension = extension;
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
      },
      set gallery(gallery) {
        versionWidget.gallery = gallery;
      },
      set manifest(manifest) {
        installAction.manifest = manifest;
      }
    };
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this.updatePreReleaseVersionContext();
    if (this.template) {
      await this.render(input.extension, this.template, !!options?.preserveFocus);
    }
  }
  setOptions(options) {
    const currentOptions = this.options;
    super.setOptions(options);
    this.updatePreReleaseVersionContext();
    if (this.input && this.template && currentOptions?.showPreReleaseVersion !== options?.showPreReleaseVersion) {
      this.render(this.input.extension, this.template, !!options?.preserveFocus);
      return;
    }
    if (options?.tab) {
      this.template?.navbar.switch(options.tab);
    }
  }
  updatePreReleaseVersionContext() {
    let showPreReleaseVersion = this.options?.showPreReleaseVersion;
    if (isUndefined(showPreReleaseVersion)) {
      showPreReleaseVersion = !!this.input.extension.gallery?.properties.isPreReleaseVersion;
    }
    this.showPreReleaseVersionContextKey?.set(showPreReleaseVersion);
  }
  async openTab(tab) {
    if (!this.input || !this.template) {
      return;
    }
    if (this.template.navbar.switch(tab)) {
      return;
    }
    if (tab === ExtensionEditorTab.ExtensionPack) {
      this.template.navbar.switch(ExtensionEditorTab.Readme);
    }
  }
  async getGalleryVersionToShow(extension, preRelease) {
    if (extension.resourceExtension) {
      return null;
    }
    if (extension.local?.source === "resource") {
      return null;
    }
    if (isUndefined(preRelease)) {
      return null;
    }
    if (preRelease === extension.gallery?.properties.isPreReleaseVersion) {
      return null;
    }
    if (preRelease && !extension.hasPreReleaseVersion) {
      return null;
    }
    if (!preRelease && !extension.hasReleaseVersion) {
      return null;
    }
    return (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease, hasPreRelease: extension.hasPreReleaseVersion }], CancellationToken.None))[0] || null;
  }
  async render(extension, template, preserveFocus) {
    this.activeElement = null;
    this.transientDisposables.clear();
    const token = this.transientDisposables.add(new CancellationTokenSource()).token;
    const gallery = await this.getGalleryVersionToShow(extension, this.options?.showPreReleaseVersion);
    if (token.isCancellationRequested) {
      return;
    }
    this.extensionReadme = new Cache(() => gallery ? this.extensionGalleryService.getReadme(gallery, token) : extension.getReadme(token));
    this.extensionChangelog = new Cache(() => gallery ? this.extensionGalleryService.getChangelog(gallery, token) : extension.getChangelog(token));
    this.extensionManifest = new Cache(() => gallery ? this.extensionGalleryService.getManifest(gallery, token) : extension.getManifest(token));
    template.extension = extension;
    template.gallery = gallery;
    template.manifest = null;
    template.name.textContent = extension.displayName;
    template.name.classList.toggle("clickable", !!extension.url);
    template.name.classList.toggle("deprecated", !!extension.deprecationInfo);
    template.preview.style.display = extension.preview ? "inherit" : "none";
    template.builtin.style.display = extension.isBuiltin ? "inherit" : "none";
    template.description.textContent = extension.description;
    if (extension.url) {
      this.transientDisposables.add(onClick(template.name, () => this.openerService.open(URI.parse(extension.url))));
    }
    const manifest = await this.extensionManifest.get().promise;
    if (token.isCancellationRequested) {
      return;
    }
    if (manifest) {
      template.manifest = manifest;
    }
    this.renderNavbar(extension, manifest, template, preserveFocus);
    const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
    let recommendationsData = {};
    if (extRecommendations[extension.identifier.id.toLowerCase()]) {
      recommendationsData = { recommendationReason: extRecommendations[extension.identifier.id.toLowerCase()].reasonId };
    }
    this.telemetryService.publicLog("extensionGallery:openExtension", { ...extension.telemetryData, ...recommendationsData });
  }
  renderNavbar(extension, manifest, template, preserveFocus) {
    template.content.innerText = "";
    template.navbar.clear();
    if (this.currentIdentifier !== extension.identifier.id) {
      this.initialScrollProgress.clear();
      this.currentIdentifier = extension.identifier.id;
    }
    template.navbar.push(ExtensionEditorTab.Readme, localize("details", "Details"), localize("detailstooltip", "Extension details, rendered from the extension's 'README.md' file"));
    if (manifest) {
      template.navbar.push(ExtensionEditorTab.Features, localize("features", "Features"), localize("featurestooltip", "Lists features contributed by this extension"));
    }
    if (extension.hasChangelog()) {
      template.navbar.push(ExtensionEditorTab.Changelog, localize("changelog", "Changelog"), localize("changelogtooltip", "Extension update history, rendered from the extension's 'CHANGELOG.md' file"));
    }
    if (extension.dependencies.length) {
      template.navbar.push(ExtensionEditorTab.Dependencies, localize("dependencies", "Dependencies"), localize("dependenciestooltip", "Lists extensions this extension depends on"));
    }
    if (manifest && manifest.extensionPack?.length && !this.shallRenderAsExtensionPack(manifest)) {
      template.navbar.push(ExtensionEditorTab.ExtensionPack, localize("extensionpack", "Extension Pack"), localize("extensionpacktooltip", "Lists extensions those will be installed together with this extension"));
    }
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
    const details = append(template.content, $(".details"));
    const contentContainer = append(details, $(".content-container"));
    const additionalDetailsContainer = append(details, $(".additional-details-container"));
    const layout = () => details.classList.toggle("narrow", this.dimension && this.dimension.width < 500);
    layout();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    this.renderAdditionalDetails(additionalDetailsContainer, extension);
    switch (id) {
      case ExtensionEditorTab.Readme:
        return this.openDetails(extension, contentContainer, token);
      case ExtensionEditorTab.Features:
        return this.openFeatures(extension, contentContainer, token);
      case ExtensionEditorTab.Changelog:
        return this.openChangelog(extension, contentContainer, token);
      case ExtensionEditorTab.Dependencies:
        return this.openExtensionDependencies(extension, contentContainer, token);
      case ExtensionEditorTab.ExtensionPack:
        return this.openExtensionPack(extension, contentContainer, token);
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
        } else if (matchesScheme(link, Schemas.command) && extension.type === ExtensionType.System) {
          this.openerService.open(link, {
            allowCommands: [
              ShowCurrentReleaseNotesActionId
            ]
          });
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
    const allowedLinkProtocols = [Schemas.http, Schemas.https, Schemas.mailto];
    const content = await renderMarkdownDocument(contents, this.extensionService, this.languageService, {
      sanitizerConfig: {
        allowedLinkProtocols: {
          override: extension.type === ExtensionType.System ? [...allowedLinkProtocols, Schemas.command] : allowedLinkProtocols
        }
      }
    }, token);
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
  async openDetails(extension, contentContainer, token) {
    let activeElement = null;
    const manifest = await this.extensionManifest.get().promise;
    if (manifest && manifest.extensionPack?.length && this.shallRenderAsExtensionPack(manifest)) {
      activeElement = await this.openExtensionPackReadme(extension, manifest, contentContainer, token);
    } else {
      activeElement = await this.openMarkdown(extension, this.extensionReadme.get(), localize("noReadme", "No README available."), contentContainer, 0 /* Readme */, localize("Readme title", "Readme"), token);
    }
    return activeElement;
  }
  shallRenderAsExtensionPack(manifest) {
    return !!manifest.categories?.some((category) => category.toLowerCase() === "extension packs");
  }
  async openExtensionPackReadme(extension, manifest, container, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve(null);
    }
    const extensionPackReadme = append(container, $("div", { class: "extension-pack-readme" }));
    extensionPackReadme.style.margin = "0 auto";
    extensionPackReadme.style.maxWidth = "882px";
    const extensionPack = append(extensionPackReadme, $("div", { class: "extension-pack" }));
    const packCount = manifest.extensionPack.length;
    const headerHeight = 37;
    const contentMinHeight = 200;
    const layout = () => {
      extensionPackReadme.classList.remove("one-row", "two-rows", "three-rows", "more-rows");
      const availableHeight = container.clientHeight;
      const availableForPack = Math.max(availableHeight - headerHeight - contentMinHeight, 0);
      let rowClass = "one-row";
      if (availableForPack >= 302 && packCount > 6) {
        rowClass = "more-rows";
      } else if (availableForPack >= 282 && packCount > 4) {
        rowClass = "three-rows";
      } else if (availableForPack >= 200 && packCount > 2) {
        rowClass = "two-rows";
      } else {
        rowClass = "one-row";
      }
      extensionPackReadme.classList.add(rowClass);
    };
    layout();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    const extensionPackHeader = append(extensionPack, $("div.header"));
    extensionPackHeader.textContent = localize("extension pack", "Extension Pack ({0})", manifest.extensionPack.length);
    const extensionPackContent = append(extensionPack, $("div", { class: "extension-pack-content" }));
    extensionPackContent.setAttribute("tabindex", "0");
    const readmeContent = append(extensionPackReadme, $("div.readme-content"));
    await Promise.all([
      this.renderExtensionPack(manifest, extensionPackContent, token),
      this.openMarkdown(extension, this.extensionReadme.get(), localize("noReadme", "No README available."), readmeContent, 0 /* Readme */, localize("Readme title", "Readme"), token)
    ]);
    return { focus: () => extensionPackContent.focus() };
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
  async openChangelog(extension, contentContainer, token) {
    const activeElement = await this.openMarkdown(extension, this.extensionChangelog.get(), localize("noChangelog", "No Changelog available."), contentContainer, 1 /* Changelog */, localize("Changelog title", "Changelog"), token);
    return activeElement;
  }
  async openFeatures(extension, contentContainer, token) {
    const manifest = await this.loadContents(() => this.extensionManifest.get(), contentContainer);
    if (token.isCancellationRequested) {
      return null;
    }
    if (!manifest) {
      return null;
    }
    const extensionFeaturesTab = this.contentDisposables.add(this.instantiationService.createInstance(ExtensionFeaturesTab, manifest, this.options?.feature));
    const featureLayout = () => extensionFeaturesTab.layout(contentContainer.clientHeight, contentContainer.clientWidth);
    const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout: featureLayout });
    this.contentDisposables.add(toDisposable(removeLayoutParticipant));
    append(contentContainer, extensionFeaturesTab.domNode);
    featureLayout();
    return extensionFeaturesTab.domNode;
  }
  openExtensionDependencies(extension, contentContainer, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve(null);
    }
    if (arrays.isFalsyOrEmpty(extension.dependencies)) {
      append(contentContainer, $("p.nocontent")).textContent = localize("noDependencies", "No Dependencies");
      return Promise.resolve(contentContainer);
    }
    const content = $("div", { class: "subcontent" });
    const scrollableContent = new DomScrollableElement(content, {});
    append(contentContainer, scrollableContent.getDomNode());
    this.contentDisposables.add(scrollableContent);
    const dependenciesTree = this.instantiationService.createInstance(
      ExtensionsTree,
      new ExtensionData(extension, null, (extension2) => extension2.dependencies || [], this.extensionsWorkbenchService),
      content,
      {
        listBackground: editorBackground
      }
    );
    const depLayout = () => {
      scrollableContent.scanDomNode();
      const scrollDimensions = scrollableContent.getScrollDimensions();
      dependenciesTree.layout(scrollDimensions.height);
    };
    const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout: depLayout });
    this.contentDisposables.add(toDisposable(removeLayoutParticipant));
    this.contentDisposables.add(dependenciesTree);
    depLayout();
    return Promise.resolve({ focus() {
      dependenciesTree.domFocus();
    } });
  }
  async openExtensionPack(extension, contentContainer, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve(null);
    }
    const manifest = await this.loadContents(() => this.extensionManifest.get(), contentContainer);
    if (token.isCancellationRequested) {
      return null;
    }
    if (!manifest) {
      return null;
    }
    return this.renderExtensionPack(manifest, contentContainer, token);
  }
  async renderExtensionPack(manifest, parent, token) {
    if (token.isCancellationRequested) {
      return null;
    }
    const content = $("div", { class: "subcontent" });
    const scrollableContent = new DomScrollableElement(content, { useShadows: false });
    append(parent, scrollableContent.getDomNode());
    const extensionsGridView = this.instantiationService.createInstance(ExtensionsGridView, content, new Delegate());
    const extensions = await getExtensions(manifest.extensionPack, this.extensionsWorkbenchService);
    extensionsGridView.setExtensions(extensions);
    scrollableContent.scanDomNode();
    this.contentDisposables.add(scrollableContent);
    this.contentDisposables.add(extensionsGridView);
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout: () => scrollableContent.scanDomNode() })));
    return content;
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
ExtensionEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IExtensionsWorkbenchService),
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IExtensionRecommendationsService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IWebviewService),
  __decorateParam(12, ILanguageService),
  __decorateParam(13, IContextMenuService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IHoverService)
], ExtensionEditor);
let AdditionalDetailsWidget = class extends Disposable {
  constructor(container, extension, hoverService, openerService, userDataProfilesService, remoteAgentService, fileService, uriIdentityService, extensionsWorkbenchService, extensionGalleryManifestService) {
    super();
    this.container = container;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.userDataProfilesService = userDataProfilesService;
    this.remoteAgentService = remoteAgentService;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.disposables = this._register(new DisposableStore());
    this.render(extension);
    this._register(this.extensionsWorkbenchService.onChange((e) => {
      if (e && areSameExtensions(e.identifier, extension.identifier) && e.server === extension.server) {
        this.render(e);
      }
    }));
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
    this.renderCategories(this.container, extension);
    this.renderExtensionResources(this.container, extension);
  }
  renderCategories(container, extension) {
    if (extension.categories.length) {
      const categoriesContainer = append(container, $(".categories-container.additional-details-element"));
      append(categoriesContainer, $(".additional-details-title", void 0, localize("categories", "Categories")));
      const categoriesElement = append(categoriesContainer, $(".categories"));
      this.extensionGalleryManifestService.getExtensionGalleryManifest().then((manifest) => {
        const hasCategoryFilter = manifest?.capabilities.extensionQuery.filtering?.some(({ name }) => name === FilterType.Category);
        for (const category of extension.categories) {
          const categoryElement = append(categoriesElement, $("span.category", { tabindex: "0" }, category));
          if (hasCategoryFilter) {
            categoryElement.classList.add("clickable");
            this.disposables.add(onClick(categoryElement, () => this.extensionsWorkbenchService.openSearch(`@category:"${category}"`)));
          }
        }
      });
    }
  }
  renderExtensionResources(container, extension) {
    const resources = [];
    if (extension.repository) {
      try {
        resources.push([localize("repository", "Repository"), ThemeIcon.fromId(Codicon.repo.id), URI.parse(extension.repository)]);
      } catch (error) {
      }
    }
    if (extension.supportUrl) {
      try {
        resources.push([localize("issues", "Issues"), ThemeIcon.fromId(Codicon.issues.id), URI.parse(extension.supportUrl)]);
      } catch (error) {
      }
    }
    if (extension.licenseUrl) {
      try {
        resources.push([localize("license", "License"), ThemeIcon.fromId(Codicon.linkExternal.id), URI.parse(extension.licenseUrl)]);
      } catch (error) {
      }
    }
    if (extension.publisherUrl) {
      resources.push([extension.publisherDisplayName, ThemeIcon.fromId(Codicon.linkExternal.id), extension.publisherUrl]);
    }
    if (extension.url) {
      resources.push([localize("Marketplace", "Marketplace"), ThemeIcon.fromId(Codicon.linkExternal.id), URI.parse(extension.url)]);
    }
    if (resources.length || extension.publisherSponsorLink) {
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
        $("code", void 0, extension.identifier.id)
      )
    );
    if (extension.type !== ExtensionType.System) {
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("Version", "Version")),
          $("code", void 0, extension.manifest.version)
        )
      );
    }
    if (extension.installedTimestamp) {
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("last updated", "Last Updated")),
          $("div", {
            "title": new Date(extension.installedTimestamp).toString()
          }, fromNow(extension.installedTimestamp, true, true, true))
        )
      );
    }
    if (!extension.isBuiltin && extension.source !== "gallery") {
      const element = $("div", void 0, extension.source === "vsix" ? localize("vsix", "VSIX") : localize("other", "Local"));
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("source", "Source")),
          element
        )
      );
      if (isNative && extension.source === "resource" && extension.location.scheme === Schemas.file) {
        element.classList.add("link");
        element.tabIndex = 0;
        element.setAttribute("role", "link");
        element.title = extension.location.fsPath;
        this.disposables.add(onClick(element, () => this.openerService.open(extension.location, { openExternal: true })));
      }
    }
    if (extension.size) {
      const element = $("div", void 0, ByteSize.formatSize(extension.size));
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", { title: localize("size when installed", "Size when installed") }, localize("size", "Size")),
          element
        )
      );
      if (isNative && extension.location.scheme === Schemas.file) {
        element.classList.add("link");
        element.tabIndex = 0;
        element.setAttribute("role", "link");
        element.title = extension.location.fsPath;
        this.disposables.add(onClick(element, () => this.openerService.open(extension.location, { openExternal: true })));
      }
    }
    this.getCacheLocation(extension).then((cacheLocation) => {
      if (!cacheLocation) {
        return;
      }
      computeSize(cacheLocation, this.fileService).then((cacheSize) => {
        if (!cacheSize) {
          return;
        }
        const element = $("div", void 0, ByteSize.formatSize(cacheSize));
        append(
          installInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", { title: localize("disk space used", "Cache size") }, localize("cache size", "Cache")),
            element
          )
        );
        if (isNative && extension.location.scheme === Schemas.file) {
          element.classList.add("link");
          element.tabIndex = 0;
          element.setAttribute("role", "link");
          element.title = cacheLocation.fsPath;
          this.disposables.add(onClick(element, () => this.openerService.open(cacheLocation.with({ scheme: Schemas.file }), { openExternal: true })));
        }
      });
    });
  }
  async getCacheLocation(extension) {
    let extensionCacheLocation = this.uriIdentityService.extUri.joinPath(this.userDataProfilesService.defaultProfile.globalStorageHome, extension.identifier.id.toLowerCase());
    if (extension.location.scheme === Schemas.vscodeRemote) {
      const environment = await this.remoteAgentService.getEnvironment();
      if (!environment) {
        return void 0;
      }
      extensionCacheLocation = this.uriIdentityService.extUri.joinPath(environment.globalStorageHome, extension.identifier.id.toLowerCase());
    }
    return extensionCacheLocation;
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
            $("code", void 0, extension.identifier.id)
          )
        );
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
      append(
        moreInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("published", "Published")),
          $("div", {
            "title": new Date(gallery.releaseDate).toString()
          }, fromNow(gallery.releaseDate, true, true, true))
        ),
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("last released", "Last Released")),
          $("div", {
            "title": new Date(gallery.lastUpdated).toString()
          }, fromNow(gallery.lastUpdated, true, true, true))
        )
      );
    }
  }
};
AdditionalDetailsWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IRemoteAgentService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IExtensionsWorkbenchService),
  __decorateParam(9, IExtensionGalleryManifestService)
], AdditionalDetailsWidget);
const contextKeyExpr = ContextKeyExpr.and(ContextKeyExpr.equals("activeEditor", ExtensionEditor.ID), EditorContextKeys.focus.toNegated());
registerAction2(class ShowExtensionEditorFindAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.extensioneditor.showfind",
      title: localize("find", "Find"),
      keybinding: {
        when: contextKeyExpr,
        weight: KeybindingWeight.EditorContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyF
      }
    });
  }
  run(accessor) {
    const extensionEditor = getExtensionEditor(accessor);
    extensionEditor?.showFind();
  }
});
registerAction2(class StartExtensionEditorFindNextAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.extensioneditor.findNext",
      title: localize("find next", "Find Next"),
      keybinding: {
        when: ContextKeyExpr.and(
          contextKeyExpr,
          KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED
        ),
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor) {
    const extensionEditor = getExtensionEditor(accessor);
    extensionEditor?.runFindAction(false);
  }
});
registerAction2(class StartExtensionEditorFindPreviousAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.extensioneditor.findPrevious",
      title: localize("find previous", "Find Previous"),
      keybinding: {
        when: ContextKeyExpr.and(
          contextKeyExpr,
          KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED
        ),
        primary: KeyMod.Shift | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor) {
    const extensionEditor = getExtensionEditor(accessor);
    extensionEditor?.runFindAction(true);
  }
});
registerThemingParticipant((theme, collector) => {
  const link = theme.getColor(textLinkForeground);
  if (link) {
    collector.addRule(`.monaco-workbench .extension-editor .content .details .additional-details-container .resources-container a.resource { color: ${link}; }`);
    collector.addRule(`.monaco-workbench .extension-editor .content .feature-contributions a { color: ${link}; }`);
  }
  const activeLink = theme.getColor(textLinkActiveForeground);
  if (activeLink) {
    collector.addRule(`.monaco-workbench .extension-editor .content .details .additional-details-container .resources-container a.resource:hover,
			.monaco-workbench .extension-editor .content .details .additional-details-container .resources-container a.resource:active { color: ${activeLink}; }`);
    collector.addRule(`.monaco-workbench .extension-editor .content .feature-contributions a:hover,
			.monaco-workbench .extension-editor .content .feature-contributions a:active { color: ${activeLink}; }`);
  }
  const buttonHoverBackgroundColor = theme.getColor(buttonHoverBackground);
  if (buttonHoverBackgroundColor) {
    collector.addRule(`.monaco-workbench .extension-editor .content > .details > .additional-details-container .categories-container > .categories > .category.clickable:hover { background-color: ${buttonHoverBackgroundColor}; border-color: ${buttonHoverBackgroundColor}; }`);
  }
  const buttonForegroundColor = theme.getColor(buttonForeground);
  if (buttonForegroundColor) {
    collector.addRule(`.monaco-workbench .extension-editor .content > .details > .additional-details-container .categories-container > .categories > .category.clickable:hover { color: ${buttonForegroundColor}; }`);
  }
});
function getExtensionEditor(accessor) {
  const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
  if (activeEditorPane instanceof ExtensionEditor) {
    return activeEditorPane;
  }
  return null;
}
export {
  ExtensionEditor
};
