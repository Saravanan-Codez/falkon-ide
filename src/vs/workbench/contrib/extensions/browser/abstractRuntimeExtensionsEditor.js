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
import { $, append, clearNode } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { fromNow } from "../../../../base/common/date.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ExtensionIdentifierMap } from "../../../../platform/extensions/common/extensions.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { EnablementState } from "../../../services/extensionManagement/common/extensionManagement.js";
import { LocalWebWorkerRunningLocation } from "../../../services/extensions/common/extensionRunningLocation.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { RuntimeExtensionsInput } from "../common/runtimeExtensionsInput.js";
import { errorIcon, warningIcon } from "./extensionsIcons.js";
import { ExtensionIconWidget } from "./extensionsWidgets.js";
import "./media/runtimeExtensionsEditor.css";
let AbstractRuntimeExtensionsEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, contextKeyService, _extensionsWorkbenchService, _extensionService, _notificationService, _contextMenuService, _instantiationService, storageService, _labelService, _environmentService, _clipboardService, _extensionFeaturesManagementService, _hoverService, _menuService) {
    super(AbstractRuntimeExtensionsEditor.ID, group, telemetryService, themeService, storageService);
    this.contextKeyService = contextKeyService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._extensionService = _extensionService;
    this._notificationService = _notificationService;
    this._contextMenuService = _contextMenuService;
    this._instantiationService = _instantiationService;
    this._labelService = _labelService;
    this._environmentService = _environmentService;
    this._clipboardService = _clipboardService;
    this._extensionFeaturesManagementService = _extensionFeaturesManagementService;
    this._hoverService = _hoverService;
    this._menuService = _menuService;
    this._list = null;
    this._elements = null;
    this._updateSoon = this._register(new RunOnceScheduler(() => this._updateExtensions(), 200));
    this._register(this._extensionService.onDidChangeExtensionsStatus(() => this._updateSoon.schedule()));
    this._register(this._extensionFeaturesManagementService.onDidChangeAccessData(() => this._updateSoon.schedule()));
    this._updateExtensions();
  }
  static {
    this.ID = "workbench.editor.runtimeExtensions";
  }
  async _updateExtensions() {
    this._elements = await this._resolveExtensions();
    this._list?.splice(0, this._list.length, this._elements);
  }
  async _resolveExtensions() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const extensionsDescriptions = this._extensionService.extensions.filter((extension) => {
      return Boolean(extension.main) || Boolean(extension.browser);
    });
    const marketplaceMap = new ExtensionIdentifierMap();
    const marketPlaceExtensions = await this._extensionsWorkbenchService.queryLocal();
    for (const extension of marketPlaceExtensions) {
      marketplaceMap.set(extension.identifier.id, extension);
    }
    const statusMap = this._extensionService.getExtensionsStatus();
    const segments = new ExtensionIdentifierMap();
    const profileInfo = this._getProfileInfo();
    if (profileInfo) {
      let currentStartTime = profileInfo.startTime;
      for (let i = 0, len = profileInfo.deltas.length; i < len; i++) {
        const id = profileInfo.ids[i];
        const delta = profileInfo.deltas[i];
        let extensionSegments = segments.get(id);
        if (!extensionSegments) {
          extensionSegments = [];
          segments.set(id, extensionSegments);
        }
        extensionSegments.push(currentStartTime);
        currentStartTime = currentStartTime + delta;
        extensionSegments.push(currentStartTime);
      }
    }
    let result = [];
    for (let i = 0, len = extensionsDescriptions.length; i < len; i++) {
      const extensionDescription = extensionsDescriptions[i];
      let extProfileInfo = null;
      if (profileInfo) {
        const extensionSegments = segments.get(extensionDescription.identifier) || [];
        let extensionTotalTime = 0;
        for (let j = 0, lenJ = extensionSegments.length / 2; j < lenJ; j++) {
          const startTime = extensionSegments[2 * j];
          const endTime = extensionSegments[2 * j + 1];
          extensionTotalTime += endTime - startTime;
        }
        extProfileInfo = {
          segments: extensionSegments,
          totalTime: extensionTotalTime
        };
      }
      result[i] = {
        originalIndex: i,
        description: extensionDescription,
        marketplaceInfo: marketplaceMap.get(extensionDescription.identifier),
        status: statusMap[extensionDescription.identifier.value],
        profileInfo: extProfileInfo || void 0,
        unresponsiveProfile: this._getUnresponsiveProfile(extensionDescription.identifier)
      };
    }
    result = result.filter((element) => element.status.activationStarted);
    const isUnresponsive = (extension) => extension.unresponsiveProfile === profileInfo;
    const profileTime = (extension) => extension.profileInfo?.totalTime ?? 0;
    const activationTime = (extension) => (extension.status.activationTimes?.codeLoadingTime ?? 0) + (extension.status.activationTimes?.activateCallTime ?? 0);
    result = result.sort((a, b) => {
      if (isUnresponsive(a) || isUnresponsive(b)) {
        return +isUnresponsive(b) - +isUnresponsive(a);
      } else if (profileTime(a) || profileTime(b)) {
        return profileTime(b) - profileTime(a);
      } else if (activationTime(a) || activationTime(b)) {
        return activationTime(b) - activationTime(a);
      }
      return a.originalIndex - b.originalIndex;
    });
    return result;
  }
  createEditor(parent) {
    parent.classList.add("runtime-extensions-editor");
    const TEMPLATE_ID = "runtimeExtensionElementTemplate";
    const delegate = new class {
      getHeight(element) {
        return 70;
      }
      getTemplateId(element) {
        return TEMPLATE_ID;
      }
    }();
    const renderer = {
      templateId: TEMPLATE_ID,
      renderTemplate: (root) => {
        const element = append(root, $(".extension"));
        const iconContainer = append(element, $(".icon-container"));
        const extensionIconWidget = this._instantiationService.createInstance(ExtensionIconWidget, iconContainer);
        const desc = append(element, $("div.desc"));
        const headerContainer = append(desc, $(".header-container"));
        const header = append(headerContainer, $(".header"));
        const name = append(header, $("div.name"));
        const version = append(header, $("span.version"));
        const msgContainer = append(desc, $("div.msg"));
        const actionbar = new ActionBar(desc);
        const listener = actionbar.onDidRun(({ error }) => error && this._notificationService.error(error));
        const timeContainer = append(element, $(".time"));
        const activationTime = append(timeContainer, $("div.activation-time"));
        const profileTime = append(timeContainer, $("div.profile-time"));
        const disposables = [extensionIconWidget, actionbar, listener];
        return {
          root,
          element,
          name,
          version,
          actionbar,
          activationTime,
          profileTime,
          msgContainer,
          set extension(extension) {
            extensionIconWidget.extension = extension || null;
          },
          disposables,
          elementDisposables: []
        };
      },
      renderElement: (element, index, data) => {
        data.elementDisposables = dispose(data.elementDisposables);
        data.extension = element.marketplaceInfo;
        data.root.classList.toggle("odd", index % 2 === 1);
        data.name.textContent = (element.marketplaceInfo?.displayName || element.description.identifier.value).substr(0, 50);
        data.version.textContent = element.description.version;
        const activationTimes = element.status.activationTimes;
        if (activationTimes) {
          const syncTime = activationTimes.codeLoadingTime + activationTimes.activateCallTime;
          data.activationTime.textContent = activationTimes.activationReason.startup ? `Startup Activation: ${syncTime}ms` : `Activation: ${syncTime}ms`;
        } else {
          data.activationTime.textContent = `Activating...`;
        }
        data.actionbar.clear();
        const slowExtensionAction = this._createSlowExtensionAction(element);
        if (slowExtensionAction) {
          data.actionbar.push(slowExtensionAction, { icon: false, label: true });
        }
        if (isNonEmptyArray(element.status.runtimeErrors)) {
          const reportExtensionIssueAction = this._createReportExtensionIssueAction(element);
          if (reportExtensionIssueAction) {
            data.actionbar.push(reportExtensionIssueAction, { icon: false, label: true });
          }
        }
        let title;
        if (activationTimes) {
          const activationId = activationTimes.activationReason.extensionId.value;
          const activationEvent = activationTimes.activationReason.activationEvent;
          if (activationEvent === "*") {
            title = nls.localize({
              key: "starActivation",
              comment: [
                "{0} will be an extension identifier"
              ]
            }, "Activated by {0} on start-up", activationId);
          } else if (/^workspaceContains:/.test(activationEvent)) {
            const fileNameOrGlob = activationEvent.substr("workspaceContains:".length);
            if (fileNameOrGlob.indexOf("*") >= 0 || fileNameOrGlob.indexOf("?") >= 0) {
              title = nls.localize({
                key: "workspaceContainsGlobActivation",
                comment: [
                  "{0} will be a glob pattern",
                  "{1} will be an extension identifier"
                ]
              }, "Activated by {1} because a file matching {0} exists in your workspace", fileNameOrGlob, activationId);
            } else {
              title = nls.localize({
                key: "workspaceContainsFileActivation",
                comment: [
                  "{0} will be a file name",
                  "{1} will be an extension identifier"
                ]
              }, "Activated by {1} because file {0} exists in your workspace", fileNameOrGlob, activationId);
            }
          } else if (/^workspaceContainsTimeout:/.test(activationEvent)) {
            const glob = activationEvent.substr("workspaceContainsTimeout:".length);
            title = nls.localize({
              key: "workspaceContainsTimeout",
              comment: [
                "{0} will be a glob pattern",
                "{1} will be an extension identifier"
              ]
            }, "Activated by {1} because searching for {0} took too long", glob, activationId);
          } else if (activationEvent === "onStartupFinished") {
            title = nls.localize({
              key: "startupFinishedActivation",
              comment: [
                "This refers to an extension. {0} will be an activation event."
              ]
            }, "Activated by {0} after start-up finished", activationId);
          } else if (/^onLanguage:/.test(activationEvent)) {
            const language = activationEvent.substr("onLanguage:".length);
            title = nls.localize("languageActivation", "Activated by {1} because you opened a {0} file", language, activationId);
          } else {
            title = nls.localize({
              key: "workspaceGenericActivation",
              comment: [
                "{0} will be an activation event, like e.g. 'language:typescript', 'debug', etc.",
                "{1} will be an extension identifier"
              ]
            }, "Activated by {1} on {0}", activationEvent, activationId);
          }
        } else {
          title = nls.localize("extensionActivating", "Extension is activating...");
        }
        data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.activationTime, title));
        clearNode(data.msgContainer);
        if (this._getUnresponsiveProfile(element.description.identifier)) {
          const el = $("span", void 0, ...renderLabelWithIcons(` $(alert) Unresponsive`));
          const extensionHostFreezTitle = nls.localize("unresponsive.title", "Extension has caused the extension host to freeze.");
          data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), el, extensionHostFreezTitle));
          data.msgContainer.appendChild(el);
        }
        if (isNonEmptyArray(element.status.runtimeErrors)) {
          const el = $("span", void 0, ...renderLabelWithIcons(`$(bug) ${nls.localize("errors", "{0} uncaught errors", element.status.runtimeErrors.length)}`));
          data.msgContainer.appendChild(el);
        }
        if (element.status.messages && element.status.messages.length > 0) {
          const el = $("span", void 0, ...renderLabelWithIcons(`$(alert) ${element.status.messages[0].message}`));
          data.msgContainer.appendChild(el);
        }
        let extraLabel = null;
        if (element.status.runningLocation && element.status.runningLocation.equals(new LocalWebWorkerRunningLocation(0))) {
          extraLabel = `$(globe) web worker`;
        } else if (element.description.extensionLocation.scheme === Schemas.vscodeRemote) {
          const hostLabel = this._labelService.getHostLabel(Schemas.vscodeRemote, this._environmentService.remoteAuthority);
          if (hostLabel) {
            extraLabel = `$(remote) ${hostLabel}`;
          } else {
            extraLabel = `$(remote) ${element.description.extensionLocation.authority}`;
          }
        } else if (element.status.runningLocation && element.status.runningLocation.affinity > 0) {
          extraLabel = element.status.runningLocation instanceof LocalWebWorkerRunningLocation ? `$(globe) web worker ${element.status.runningLocation.affinity + 1}` : `$(server-process) local process ${element.status.runningLocation.affinity + 1}`;
        }
        if (extraLabel) {
          const el = $("span", void 0, ...renderLabelWithIcons(extraLabel));
          data.msgContainer.appendChild(el);
        }
        const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
        for (const feature of features) {
          const accessData = this._extensionFeaturesManagementService.getAccessData(element.description.identifier, feature.id);
          if (accessData) {
            const status = accessData?.current?.status;
            if (status) {
              data.msgContainer.appendChild($("span", void 0, `${feature.label}: `));
              data.msgContainer.appendChild($("span", void 0, ...renderLabelWithIcons(`$(${status.severity === Severity.Error ? errorIcon.id : warningIcon.id}) ${status.message}`)));
            }
            if (accessData?.accessTimes.length > 0) {
              const element2 = $("span", void 0, `${nls.localize("requests count", "{0} Usage: {1} Requests", feature.label, accessData.accessTimes.length)}${accessData.current ? nls.localize("session requests count", ", {0} Requests (Session)", accessData.current.accessTimes.length) : ""}`);
              if (accessData.current) {
                const title2 = nls.localize("requests count title", "Last request was {0}.", fromNow(accessData.current.lastAccessed, true, true));
                data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), element2, title2));
              }
              data.msgContainer.appendChild(element2);
            }
          }
        }
        if (element.profileInfo) {
          data.profileTime.textContent = `Profile: ${(element.profileInfo.totalTime / 1e3).toFixed(2)}ms`;
        } else {
          data.profileTime.textContent = "";
        }
      },
      disposeTemplate: (data) => {
        data.disposables = dispose(data.disposables);
        data.elementDisposables = dispose(data.elementDisposables);
      }
    };
    this._list = this._register(this._instantiationService.createInstance(
      WorkbenchList,
      "RuntimeExtensions",
      parent,
      delegate,
      [renderer],
      {
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        horizontalScrolling: false,
        overrideStyles: {
          listBackground: editorBackground
        },
        accessibilityProvider: new class {
          getWidgetAriaLabel() {
            return nls.localize("runtimeExtensions", "Runtime Extensions");
          }
          getAriaLabel(element) {
            return element.description.name;
          }
        }()
      }
    ));
    this._list.splice(0, this._list.length, this._elements || void 0);
    this._register(this._list.onContextMenu((e) => {
      if (!e.element) {
        return;
      }
      const actions = [];
      actions.push(new Action(
        "runtimeExtensionsEditor.action.copyId",
        nls.localize("copy id", "Copy id ({0})", e.element.description.identifier.value),
        void 0,
        true,
        () => {
          this._clipboardService.writeText(e.element.description.identifier.value);
        }
      ));
      const reportExtensionIssueAction = this._createReportExtensionIssueAction(e.element);
      if (reportExtensionIssueAction) {
        actions.push(reportExtensionIssueAction);
      }
      actions.push(new Separator());
      if (e.element.marketplaceInfo) {
        actions.push(new Action("runtimeExtensionsEditor.action.disableWorkspace", nls.localize("disable workspace", "Disable (Workspace)"), void 0, true, () => this._extensionsWorkbenchService.setEnablement(e.element.marketplaceInfo, EnablementState.DisabledWorkspace)));
        actions.push(new Action("runtimeExtensionsEditor.action.disable", nls.localize("disable", "Disable"), void 0, true, () => this._extensionsWorkbenchService.setEnablement(e.element.marketplaceInfo, EnablementState.DisabledGlobally)));
      }
      actions.push(new Separator());
      const menuActions = this._menuService.getMenuActions(MenuId.ExtensionEditorContextMenu, this.contextKeyService);
      actions.push(...getContextMenuActions(menuActions).secondary);
      this._contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => actions
      });
    }));
  }
  layout(dimension) {
    this._list?.layout(dimension.height);
  }
};
AbstractRuntimeExtensionsEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IExtensionsWorkbenchService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IClipboardService),
  __decorateParam(13, IExtensionFeaturesManagementService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, IMenuService)
], AbstractRuntimeExtensionsEditor);
class ShowRuntimeExtensionsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.showRuntimeExtensions",
      title: nls.localize2("showRuntimeExtensions", "Show Running Extensions"),
      category: Categories.Developer,
      f1: true,
      menu: {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.equals("viewContainer", "workbench.view.extensions"),
        group: "2_enablement",
        order: 3
      }
    });
  }
  async run(accessor) {
    await accessor.get(IEditorService).openEditor(RuntimeExtensionsInput.instance, { pinned: true });
  }
}
export {
  AbstractRuntimeExtensionsEditor,
  ShowRuntimeExtensionsAction
};
