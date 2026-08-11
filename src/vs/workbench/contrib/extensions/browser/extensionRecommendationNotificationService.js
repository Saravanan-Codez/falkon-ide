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
import { distinct } from "../../../../base/common/arrays.js";
import { createCancelablePromise, Promises, raceCancellablePromises, raceCancellation, timeout } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { isString } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { RecommendationsNotificationResult, RecommendationSource, RecommendationSourceToString } from "../../../../platform/extensionRecommendations/common/extensionRecommendations.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IUserDataSyncEnablementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { EnablementState, IWorkbenchExtensionManagementService, IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionIgnoredRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
const ignoreImportantExtensionRecommendationStorageKey = "extensionsAssistant/importantRecommendationsIgnore";
const donotShowWorkspaceRecommendationsStorageKey = "extensionsAssistant/workspaceRecommendationsIgnore";
class RecommendationsNotification extends Disposable {
  constructor(severity, message, choices, notificationService) {
    super();
    this.severity = severity;
    this.message = message;
    this.choices = choices;
    this.notificationService = notificationService;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this.cancelled = false;
    this.onDidCloseDisposable = this._register(new MutableDisposable());
    this.onDidChangeVisibilityDisposable = this._register(new MutableDisposable());
  }
  show() {
    if (!this.notificationHandle) {
      this.updateNotificationHandle(this.notificationService.prompt(this.severity, this.message, this.choices, { sticky: true, priority: NotificationPriority.OPTIONAL, onCancel: () => this.cancelled = true }));
    }
  }
  hide() {
    if (this.notificationHandle) {
      this.onDidCloseDisposable.clear();
      this.notificationHandle.close();
      this.cancelled = false;
      this.updateNotificationHandle(this.notificationService.prompt(this.severity, this.message, this.choices, { priority: NotificationPriority.SILENT, onCancel: () => this.cancelled = true }));
    }
  }
  isCancelled() {
    return this.cancelled;
  }
  updateNotificationHandle(notificationHandle) {
    this.onDidCloseDisposable.clear();
    this.onDidChangeVisibilityDisposable.clear();
    this.notificationHandle = notificationHandle;
    this.onDidCloseDisposable.value = this.notificationHandle.onDidClose(() => {
      this.onDidCloseDisposable.dispose();
      this.onDidChangeVisibilityDisposable.dispose();
      this._onDidClose.fire();
      this._onDidClose.dispose();
      this._onDidChangeVisibility.dispose();
    });
    this.onDidChangeVisibilityDisposable.value = this.notificationHandle.onDidChangeVisibility((e) => this._onDidChangeVisibility.fire(e));
  }
}
let ExtensionRecommendationNotificationService = class extends Disposable {
  constructor(configurationService, storageService, notificationService, telemetryService, extensionsWorkbenchService, extensionManagementService, extensionEnablementService, extensionIgnoredRecommendationsService, userDataSyncEnablementService, workbenchEnvironmentService, uriIdentityService) {
    super();
    this.configurationService = configurationService;
    this.storageService = storageService;
    this.notificationService = notificationService;
    this.telemetryService = telemetryService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionManagementService = extensionManagementService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionIgnoredRecommendationsService = extensionIgnoredRecommendationsService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.workbenchEnvironmentService = workbenchEnvironmentService;
    this.uriIdentityService = uriIdentityService;
    this.recommendedExtensions = [];
    this.recommendationSources = [];
    this.pendingNotificaitons = [];
  }
  // Ignored Important Recommendations
  get ignoredRecommendations() {
    return distinct([...JSON.parse(this.storageService.get(ignoreImportantExtensionRecommendationStorageKey, StorageScope.PROFILE, "[]"))].map((i) => i.toLowerCase()));
  }
  hasToIgnoreRecommendationNotifications() {
    const config = this.configurationService.getValue("extensions");
    return config.ignoreRecommendations || !!config.showRecommendationsOnlyOnDemand;
  }
  async promptImportantExtensionsInstallNotification(extensionRecommendations) {
    const ignoredRecommendations = [...this.extensionIgnoredRecommendationsService.ignoredRecommendations, ...this.ignoredRecommendations];
    const extensions = extensionRecommendations.extensions.filter((id) => !ignoredRecommendations.includes(id));
    if (!extensions.length) {
      return RecommendationsNotificationResult.Ignored;
    }
    return this.promptRecommendationsNotification({ ...extensionRecommendations, extensions }, {
      onDidInstallRecommendedExtensions: (extensions2) => extensions2.forEach((extension) => this.telemetryService.publicLog2("extensionRecommendations:popup", { userReaction: "install", extensionId: extension.identifier.id, source: RecommendationSourceToString(extensionRecommendations.source) })),
      onDidShowRecommendedExtensions: (extensions2) => extensions2.forEach((extension) => this.telemetryService.publicLog2("extensionRecommendations:popup", { userReaction: "show", extensionId: extension.identifier.id, source: RecommendationSourceToString(extensionRecommendations.source) })),
      onDidCancelRecommendedExtensions: (extensions2) => extensions2.forEach((extension) => this.telemetryService.publicLog2("extensionRecommendations:popup", { userReaction: "cancelled", extensionId: extension.identifier.id, source: RecommendationSourceToString(extensionRecommendations.source) })),
      onDidNeverShowRecommendedExtensionsAgain: (extensions2) => {
        for (const extension of extensions2) {
          this.addToImportantRecommendationsIgnore(extension.identifier.id);
          this.telemetryService.publicLog2("extensionRecommendations:popup", { userReaction: "neverShowAgain", extensionId: extension.identifier.id, source: RecommendationSourceToString(extensionRecommendations.source) });
        }
        this.notificationService.prompt(
          Severity.Info,
          localize("ignoreExtensionRecommendations", "Do you want to ignore all extension recommendations?"),
          [{
            label: localize("ignoreAll", "Yes, Ignore All"),
            run: () => this.setIgnoreRecommendationsConfig(true)
          }, {
            label: localize("no", "No"),
            run: () => this.setIgnoreRecommendationsConfig(false)
          }]
        );
      }
    });
  }
  async promptWorkspaceRecommendations(recommendations) {
    if (this.storageService.getBoolean(donotShowWorkspaceRecommendationsStorageKey, StorageScope.WORKSPACE, false)) {
      return;
    }
    let installed = await this.extensionManagementService.getInstalled();
    installed = installed.filter((l) => this.extensionEnablementService.getEnablementState(l) !== EnablementState.DisabledByExtensionKind);
    recommendations = recommendations.filter((recommendation) => installed.every(
      (local) => isString(recommendation) ? !areSameExtensions({ id: recommendation }, local.identifier) : !this.uriIdentityService.extUri.isEqual(recommendation, local.location)
    ));
    if (!recommendations.length) {
      return;
    }
    await this.promptRecommendationsNotification({ extensions: recommendations, source: RecommendationSource.WORKSPACE, name: localize({ key: "this repository", comment: ["this repository means the current repository that is opened"] }, "this repository") }, {
      onDidInstallRecommendedExtensions: () => this.telemetryService.publicLog2("extensionWorkspaceRecommendations:popup", { userReaction: "install" }),
      onDidShowRecommendedExtensions: () => this.telemetryService.publicLog2("extensionWorkspaceRecommendations:popup", { userReaction: "show" }),
      onDidCancelRecommendedExtensions: () => this.telemetryService.publicLog2("extensionWorkspaceRecommendations:popup", { userReaction: "cancelled" }),
      onDidNeverShowRecommendedExtensionsAgain: () => {
        this.telemetryService.publicLog2("extensionWorkspaceRecommendations:popup", { userReaction: "neverShowAgain" });
        this.storageService.store(donotShowWorkspaceRecommendationsStorageKey, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    });
  }
  async promptRecommendationsNotification({ extensions: extensionIds, source, name, searchValue }, recommendationsNotificationActions) {
    if (this.hasToIgnoreRecommendationNotifications()) {
      return RecommendationsNotificationResult.Ignored;
    }
    if (source === RecommendationSource.EXE && this.workbenchEnvironmentService.remoteAuthority) {
      return RecommendationsNotificationResult.IncompatibleWindow;
    }
    if (source === RecommendationSource.EXE && (this.recommendationSources.includes(RecommendationSource.EXE) || this.recommendationSources.length >= 2)) {
      return RecommendationsNotificationResult.TooMany;
    }
    this.recommendationSources.push(source);
    if (source === RecommendationSource.EXE && extensionIds.every((id) => isString(id) && this.recommendedExtensions.includes(id))) {
      return RecommendationsNotificationResult.Ignored;
    }
    const extensions = await this.getInstallableExtensions(extensionIds);
    if (!extensions.length) {
      return RecommendationsNotificationResult.Ignored;
    }
    this.recommendedExtensions = distinct([...this.recommendedExtensions, ...extensionIds.filter(isString)]);
    let extensionsMessage = "";
    if (extensions.length === 1) {
      extensionsMessage = localize("extensionFromPublisher", "'{0}' extension from {1}", extensions[0].displayName, extensions[0].publisherDisplayName);
    } else {
      const publishers = [...extensions.reduce((result, extension) => result.add(extension.publisherDisplayName), /* @__PURE__ */ new Set())];
      if (publishers.length > 2) {
        extensionsMessage = localize("extensionsFromMultiplePublishers", "extensions from {0}, {1} and others", publishers[0], publishers[1]);
      } else if (publishers.length === 2) {
        extensionsMessage = localize("extensionsFromPublishers", "extensions from {0} and {1}", publishers[0], publishers[1]);
      } else {
        extensionsMessage = localize("extensionsFromPublisher", "extensions from {0}", publishers[0]);
      }
    }
    let message = localize("recommended", "Do you want to install the recommended {0} for {1}?", extensionsMessage, name);
    if (source === RecommendationSource.EXE) {
      message = localize({ key: "exeRecommended", comment: ["Placeholder string is the name of the software that is installed."] }, "You have {0} installed on your system. Do you want to install the recommended {1} for it?", name, extensionsMessage);
    }
    if (!searchValue) {
      searchValue = source === RecommendationSource.WORKSPACE ? "@recommended" : extensions.map((extensionId) => `@id:${extensionId.identifier.id}`).join(" ");
    }
    const donotShowAgainLabel = source === RecommendationSource.WORKSPACE ? localize("donotShowAgain", "Don't Show Again for this Repository") : extensions.length > 1 ? localize("donotShowAgainExtension", "Don't Show Again for these Extensions") : localize("donotShowAgainExtensionSingle", "Don't Show Again for this Extension");
    return raceCancellablePromises([
      this._registerP(this.showRecommendationsNotification(extensions, message, searchValue, donotShowAgainLabel, source, recommendationsNotificationActions)),
      this._registerP(this.waitUntilRecommendationsAreInstalled(extensions))
    ]);
  }
  showRecommendationsNotification(extensions, message, searchValue, donotShowAgainLabel, source, { onDidInstallRecommendedExtensions, onDidShowRecommendedExtensions, onDidCancelRecommendedExtensions, onDidNeverShowRecommendedExtensionsAgain }) {
    return createCancelablePromise(async (token) => {
      let accepted = false;
      const choices = [];
      const installExtensions = async (isMachineScoped) => {
        this.extensionsWorkbenchService.openSearch(searchValue);
        onDidInstallRecommendedExtensions(extensions);
        const galleryExtensions = [], resourceExtensions = [];
        for (const extension of extensions) {
          if (extension.gallery) {
            galleryExtensions.push(extension.gallery);
          } else if (extension.resourceExtension) {
            resourceExtensions.push(extension);
          }
        }
        await Promises.settled([
          Promises.settled(extensions.map((extension) => this.extensionsWorkbenchService.open(extension, { pinned: true }))),
          galleryExtensions.length ? this.extensionManagementService.installGalleryExtensions(galleryExtensions.map((e) => ({ extension: e, options: { isMachineScoped } }))) : Promise.resolve(),
          resourceExtensions.length ? Promise.allSettled(resourceExtensions.map((r) => this.extensionsWorkbenchService.install(r))) : Promise.resolve()
        ]);
      };
      choices.push({
        label: localize("install", "Install"),
        run: () => installExtensions(false),
        menu: this.userDataSyncEnablementService.isEnabled() && this.userDataSyncEnablementService.isResourceEnabled(SyncResource.Extensions) ? [{
          label: localize("install and do no sync", "Install (Do not sync)"),
          run: () => installExtensions(true)
        }] : void 0
      });
      choices.push(...[{
        label: localize("show recommendations", "Show Recommendations"),
        run: async () => {
          onDidShowRecommendedExtensions(extensions);
          for (const extension of extensions) {
            this.extensionsWorkbenchService.open(extension, { pinned: true });
          }
          this.extensionsWorkbenchService.openSearch(searchValue);
        }
      }, {
        label: donotShowAgainLabel,
        isSecondary: true,
        run: () => {
          onDidNeverShowRecommendedExtensionsAgain(extensions);
        }
      }]);
      try {
        accepted = await this.doShowRecommendationsNotification(Severity.Info, message, choices, source, token);
      } catch (error) {
        if (!isCancellationError(error)) {
          throw error;
        }
      }
      if (accepted) {
        return RecommendationsNotificationResult.Accepted;
      } else {
        onDidCancelRecommendedExtensions(extensions);
        return RecommendationsNotificationResult.Cancelled;
      }
    });
  }
  waitUntilRecommendationsAreInstalled(extensions) {
    const installedExtensions = [];
    const disposables = new DisposableStore();
    return createCancelablePromise(async (token) => {
      disposables.add(token.onCancellationRequested((e) => disposables.dispose()));
      return new Promise((c, e) => {
        disposables.add(this.extensionManagementService.onInstallExtension((e2) => {
          installedExtensions.push(e2.identifier.id.toLowerCase());
          if (extensions.every((e3) => installedExtensions.includes(e3.identifier.id.toLowerCase()))) {
            c(RecommendationsNotificationResult.Accepted);
          }
        }));
      });
    });
  }
  /**
   * Show recommendations in Queue
   * At any time only one recommendation is shown
   * If a new recommendation comes in
   * 		=> If no recommendation is visible, show it immediately
   *		=> Otherwise, add to the pending queue
   * 			=> If it is not exe based and has higher or same priority as current, hide the current notification after showing it for 3s.
   * 			=> Otherwise wait until the current notification is hidden.
   */
  async doShowRecommendationsNotification(severity, message, choices, source, token) {
    const disposables = new DisposableStore();
    try {
      const recommendationsNotification = disposables.add(new RecommendationsNotification(severity, message, choices, this.notificationService));
      disposables.add(Event.once(Event.filter(recommendationsNotification.onDidChangeVisibility, (e) => !e))(() => this.showNextNotification()));
      if (this.visibleNotification) {
        const index = this.pendingNotificaitons.length;
        disposables.add(token.onCancellationRequested(() => this.pendingNotificaitons.splice(index, 1)));
        this.pendingNotificaitons.push({ recommendationsNotification, source, token });
        if (source !== RecommendationSource.EXE && source <= this.visibleNotification.source) {
          this.hideVisibleNotification(3e3);
        }
      } else {
        this.visibleNotification = { recommendationsNotification, source, from: Date.now() };
        recommendationsNotification.show();
      }
      await raceCancellation(new Promise((c) => disposables.add(Event.once(recommendationsNotification.onDidClose)(c))), token);
      return !recommendationsNotification.isCancelled();
    } finally {
      disposables.dispose();
    }
  }
  showNextNotification() {
    const index = this.getNextPendingNotificationIndex();
    const [nextNotificaiton] = index > -1 ? this.pendingNotificaitons.splice(index, 1) : [];
    timeout(nextNotificaiton ? 500 : 0).then(() => {
      this.unsetVisibileNotification();
      if (nextNotificaiton) {
        this.visibleNotification = { recommendationsNotification: nextNotificaiton.recommendationsNotification, source: nextNotificaiton.source, from: Date.now() };
        nextNotificaiton.recommendationsNotification.show();
      }
    });
  }
  /**
   * Return the recent high priroity pending notification
   */
  getNextPendingNotificationIndex() {
    let index = this.pendingNotificaitons.length - 1;
    if (this.pendingNotificaitons.length) {
      for (let i = 0; i < this.pendingNotificaitons.length; i++) {
        if (this.pendingNotificaitons[i].source <= this.pendingNotificaitons[index].source) {
          index = i;
        }
      }
    }
    return index;
  }
  hideVisibleNotification(timeInMillis) {
    if (this.visibleNotification && !this.hideVisibleNotificationPromise) {
      const visibleNotification = this.visibleNotification;
      this.hideVisibleNotificationPromise = timeout(Math.max(timeInMillis - (Date.now() - visibleNotification.from), 0));
      this.hideVisibleNotificationPromise.then(() => visibleNotification.recommendationsNotification.hide());
    }
  }
  unsetVisibileNotification() {
    this.hideVisibleNotificationPromise?.cancel();
    this.hideVisibleNotificationPromise = void 0;
    this.visibleNotification = void 0;
  }
  async getInstallableExtensions(recommendations) {
    const result = [];
    if (recommendations.length) {
      const galleryExtensions = [];
      const resourceExtensions = [];
      for (const recommendation of recommendations) {
        if (typeof recommendation === "string") {
          galleryExtensions.push(recommendation);
        } else {
          resourceExtensions.push(recommendation);
        }
      }
      if (galleryExtensions.length) {
        const extensions = await this.extensionsWorkbenchService.getExtensions(galleryExtensions.map((id) => ({ id })), { source: "install-recommendations" }, CancellationToken.None);
        for (const extension of extensions) {
          if (extension.gallery && await this.extensionManagementService.canInstall(extension.gallery) === true) {
            result.push(extension);
          }
        }
      }
      if (resourceExtensions.length) {
        const extensions = await this.extensionsWorkbenchService.getResourceExtensions(resourceExtensions, true);
        for (const extension of extensions) {
          if (await this.extensionsWorkbenchService.canInstall(extension) === true) {
            result.push(extension);
          }
        }
      }
    }
    return result;
  }
  addToImportantRecommendationsIgnore(id) {
    const importantRecommendationsIgnoreList = [...this.ignoredRecommendations];
    if (!importantRecommendationsIgnoreList.includes(id.toLowerCase())) {
      importantRecommendationsIgnoreList.push(id.toLowerCase());
      this.storageService.store(ignoreImportantExtensionRecommendationStorageKey, JSON.stringify(importantRecommendationsIgnoreList), StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  setIgnoreRecommendationsConfig(configVal) {
    this.configurationService.updateValue("extensions.ignoreRecommendations", configVal);
  }
  _registerP(o) {
    this._register(toDisposable(() => o.cancel()));
    return o;
  }
};
ExtensionRecommendationNotificationService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IExtensionsWorkbenchService),
  __decorateParam(5, IWorkbenchExtensionManagementService),
  __decorateParam(6, IWorkbenchExtensionEnablementService),
  __decorateParam(7, IExtensionIgnoredRecommendationsService),
  __decorateParam(8, IUserDataSyncEnablementService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IUriIdentityService)
], ExtensionRecommendationNotificationService);
export {
  ExtensionRecommendationNotificationService
};
