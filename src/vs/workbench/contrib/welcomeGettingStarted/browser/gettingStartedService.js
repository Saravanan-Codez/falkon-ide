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
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Emitter } from "../../../../base/common/event.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Memento } from "../../../common/memento.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { URI } from "../../../../base/common/uri.js";
import { joinPath } from "../../../../base/common/resources.js";
import { FileAccess } from "../../../../base/common/network.js";
import { EXTENSION_INSTALL_DEP_PACK_CONTEXT, EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT, IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { walkthroughs } from "../common/gettingStartedContent.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { walkthroughsExtensionPoint } from "./gettingStartedExtensionPoint.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { dirname } from "../../../../base/common/path.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { localize, localize2 } from "../../../../nls.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { checkGlobFileExists } from "../../../services/extensions/common/workspaceContains.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { asWebviewUri } from "../../webview/common/webview.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { extensionDefaultIcon } from "../../../services/extensionManagement/common/extensionsIcons.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { GettingStartedInput } from "./gettingStartedInput.js";
const HasMultipleNewFileEntries = new RawContextKey("hasMultipleNewFileEntries", false);
const IWalkthroughsService = createDecorator("walkthroughsService");
const hiddenEntriesConfigurationKey = "workbench.welcomePage.hiddenCategories";
const walkthroughMetadataConfigurationKey = "workbench.welcomePage.walkthroughMetadata";
const BUILT_IN_SOURCE = localize("builtin", "Built-In");
const DAYS = 24 * 60 * 60 * 1e3;
const NEW_WALKTHROUGH_TIME = 7 * DAYS;
let WalkthroughsService = class extends Disposable {
  constructor(storageService, commandService, instantiationService, workspaceContextService, contextService, userDataSyncEnablementService, configurationService, extensionManagementService, hostService, viewsService, telemetryService, tasExperimentService, layoutService, editorService) {
    super();
    this.storageService = storageService;
    this.commandService = commandService;
    this.instantiationService = instantiationService;
    this.workspaceContextService = workspaceContextService;
    this.contextService = contextService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.configurationService = configurationService;
    this.extensionManagementService = extensionManagementService;
    this.hostService = hostService;
    this.viewsService = viewsService;
    this.telemetryService = telemetryService;
    this.tasExperimentService = tasExperimentService;
    this.layoutService = layoutService;
    this.editorService = editorService;
    this._onDidAddWalkthrough = this._register(new Emitter());
    this.onDidAddWalkthrough = this._onDidAddWalkthrough.event;
    this._onDidRemoveWalkthrough = this._register(new Emitter());
    this.onDidRemoveWalkthrough = this._onDidRemoveWalkthrough.event;
    this._onDidChangeWalkthrough = this._register(new Emitter());
    this.onDidChangeWalkthrough = this._onDidChangeWalkthrough.event;
    this._onDidProgressStep = this._register(new Emitter());
    this.onDidProgressStep = this._onDidProgressStep.event;
    this.sessionEvents = /* @__PURE__ */ new Set();
    this.completionListeners = /* @__PURE__ */ new Map();
    this.gettingStartedContributions = /* @__PURE__ */ new Map();
    this.steps = /* @__PURE__ */ new Map();
    this.sessionInstalledExtensions = /* @__PURE__ */ new Set();
    this.categoryVisibilityContextKeys = /* @__PURE__ */ new Set();
    this.stepCompletionContextKeyExpressions = /* @__PURE__ */ new Set();
    this.stepCompletionContextKeys = /* @__PURE__ */ new Set();
    this.metadata = new Map(
      JSON.parse(
        this.storageService.get(walkthroughMetadataConfigurationKey, StorageScope.PROFILE, "[]")
      )
    );
    this.memento = new Memento("gettingStartedService", this.storageService);
    this.stepProgress = this.memento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    this.initCompletionEventListeners();
    HasMultipleNewFileEntries.bindTo(this.contextService).set(false);
    this.registerWalkthroughs();
  }
  registerWalkthroughs() {
    walkthroughs.forEach(async (category, index) => {
      this._registerWalkthrough({
        ...category,
        icon: { type: "icon", icon: category.icon },
        order: walkthroughs.length - index,
        source: BUILT_IN_SOURCE,
        when: ContextKeyExpr.deserialize(category.when) ?? ContextKeyExpr.true(),
        steps: category.content.steps.map((step, index2) => {
          return {
            ...step,
            completionEvents: step.completionEvents ?? [],
            description: parseDescription(step.description),
            category: category.id,
            order: index2,
            when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
            media: step.media.type === "image" ? {
              type: "image",
              altText: step.media.altText,
              path: convertInternalMediaPathsToBrowserURIs(step.media.path)
            } : step.media.type === "svg" ? {
              type: "svg",
              altText: step.media.altText,
              path: convertInternalMediaPathToFileURI(step.media.path).with({ query: JSON.stringify({ moduleId: "vs/workbench/contrib/welcomeGettingStarted/common/media/" + step.media.path }) })
            } : step.media.type === "markdown" ? {
              type: "markdown",
              path: convertInternalMediaPathToFileURI(step.media.path).with({ query: JSON.stringify({ moduleId: "vs/workbench/contrib/welcomeGettingStarted/common/media/" + step.media.path }) }),
              base: FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"),
              root: FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/")
            } : {
              type: "video",
              path: convertRelativeMediaPathsToWebviewURIs(FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"), step.media.path),
              altText: step.media.altText,
              root: FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"),
              poster: step.media.poster ? convertRelativeMediaPathsToWebviewURIs(FileAccess.asFileUri("vs/workbench/contrib/welcomeGettingStarted/common/media/"), step.media.poster) : void 0
            }
          };
        })
      });
    });
    walkthroughsExtensionPoint.setHandler((_, { added, removed }) => {
      added.map((e) => this.registerExtensionWalkthroughContributions(e.description));
      removed.map((e) => this.unregisterExtensionWalkthroughContributions(e.description));
    });
  }
  initCompletionEventListeners() {
    this._register(this.commandService.onDidExecuteCommand((command) => this.progressByEvent(`onCommand:${command.commandId}`)));
    this.extensionManagementService.getInstalled().then((installed) => {
      installed.forEach((ext) => this.progressByEvent(`extensionInstalled:${ext.identifier.id.toLowerCase()}`));
    });
    this._register(this.extensionManagementService.onDidInstallExtensions((result) => {
      for (const e of result) {
        const skipWalkthrough = e?.context?.[EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT] || e?.context?.[EXTENSION_INSTALL_DEP_PACK_CONTEXT];
        if (!skipWalkthrough) {
          this.sessionInstalledExtensions.add(e.identifier.id.toLowerCase());
        }
        this.progressByEvent(`extensionInstalled:${e.identifier.id.toLowerCase()}`);
      }
    }));
    this._register(this.contextService.onDidChangeContext((event) => {
      if (event.affectsSome(this.stepCompletionContextKeys)) {
        this.stepCompletionContextKeyExpressions.forEach((expression) => {
          if (event.affectsSome(new Set(expression.keys())) && this.contextService.contextMatchesRules(expression)) {
            this.progressByEvent(`onContext:` + expression.serialize());
          }
        });
      }
    }));
    this._register(this.viewsService.onDidChangeViewVisibility((e) => {
      if (e.visible) {
        this.progressByEvent("onView:" + e.id);
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      e.affectedKeys.forEach((key) => {
        this.progressByEvent("onSettingChanged:" + key);
      });
    }));
    if (this.userDataSyncEnablementService.isEnabled()) {
      this.progressByEvent("onEvent:sync-enabled");
    }
    this._register(this.userDataSyncEnablementService.onDidChangeEnablement(() => {
      if (this.userDataSyncEnablementService.isEnabled()) {
        this.progressByEvent("onEvent:sync-enabled");
      }
    }));
  }
  markWalkthroughOpened(id) {
    const walkthrough = this.gettingStartedContributions.get(id);
    const prior = this.metadata.get(id);
    if (prior && walkthrough) {
      this.metadata.set(id, { ...prior, manaullyOpened: true, stepIDs: walkthrough.steps.map((s) => s.id) });
    }
    this.storageService.store(walkthroughMetadataConfigurationKey, JSON.stringify([...this.metadata.entries()]), StorageScope.PROFILE, StorageTarget.USER);
  }
  async registerExtensionWalkthroughContributions(extension) {
    const convertExtensionPathToFileURI = (path) => path.startsWith("https://") ? URI.parse(path, true) : FileAccess.uriToFileUri(joinPath(extension.extensionLocation, path));
    const convertExtensionRelativePathsToBrowserURIs = (path) => {
      const convertPath = (path2) => path2.startsWith("https://") ? URI.parse(path2, true) : FileAccess.uriToBrowserUri(joinPath(extension.extensionLocation, path2));
      if (typeof path === "string") {
        const converted = convertPath(path);
        return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
      } else {
        return {
          hcDark: convertPath(path.hc),
          hcLight: convertPath(path.hcLight ?? path.light),
          light: convertPath(path.light),
          dark: convertPath(path.dark)
        };
      }
    };
    if (!extension.contributes?.walkthroughs?.length) {
      return;
    }
    let sectionToOpen;
    let sectionToOpenIndex = Math.min();
    await Promise.all(extension.contributes?.walkthroughs?.map(async (walkthrough, index) => {
      const categoryID = extension.identifier.value + "#" + walkthrough.id;
      const isNewlyInstalled = !this.metadata.get(categoryID);
      if (isNewlyInstalled) {
        this.metadata.set(categoryID, { firstSeen: +/* @__PURE__ */ new Date(), stepIDs: walkthrough.steps?.map((s) => s.id) ?? [], manaullyOpened: false });
      }
      const override = await Promise.race([
        this.tasExperimentService?.getTreatment(`gettingStarted.overrideCategory.${extension.identifier.value + "." + walkthrough.id}.when`),
        new Promise((resolve) => setTimeout(() => resolve(walkthrough.when), 5e3))
      ]);
      if (this.sessionInstalledExtensions.has(extension.identifier.value.toLowerCase()) && this.contextService.contextMatchesRules(ContextKeyExpr.deserialize(override ?? walkthrough.when) ?? ContextKeyExpr.true())) {
        this.sessionInstalledExtensions.delete(extension.identifier.value.toLowerCase());
        if (index < sectionToOpenIndex && isNewlyInstalled) {
          sectionToOpen = categoryID;
          sectionToOpenIndex = index;
        }
      }
      const steps = (walkthrough.steps ?? []).map((step, index2) => {
        const description = parseDescription(step.description || "");
        const fullyQualifiedID = extension.identifier.value + "#" + walkthrough.id + "#" + step.id;
        let media;
        if (!step.media) {
          throw Error("missing media in walkthrough step: " + walkthrough.id + "@" + step.id);
        }
        if (step.media.image) {
          const altText = step.media.altText;
          if (altText === void 0) {
            console.error("Walkthrough item:", fullyQualifiedID, "is missing altText for its media element.");
          }
          media = { type: "image", altText, path: convertExtensionRelativePathsToBrowserURIs(step.media.image) };
        } else if (step.media.markdown) {
          media = {
            type: "markdown",
            path: convertExtensionPathToFileURI(step.media.markdown),
            base: convertExtensionPathToFileURI(dirname(step.media.markdown)),
            root: FileAccess.uriToFileUri(extension.extensionLocation)
          };
        } else if (step.media.svg) {
          media = {
            type: "svg",
            path: convertExtensionPathToFileURI(step.media.svg),
            altText: step.media.svg
          };
        } else if (step.media.video) {
          const baseURI = FileAccess.uriToFileUri(extension.extensionLocation);
          media = {
            type: "video",
            path: convertRelativeMediaPathsToWebviewURIs(baseURI, step.media.video),
            root: FileAccess.uriToFileUri(extension.extensionLocation),
            altText: step.media.altText,
            poster: step.media.poster ? convertRelativeMediaPathsToWebviewURIs(baseURI, step.media.poster) : void 0
          };
        } else {
          throw new Error("Unknown walkthrough format detected for " + fullyQualifiedID);
        }
        return {
          description,
          media,
          completionEvents: step.completionEvents?.filter((x) => typeof x === "string") ?? [],
          id: fullyQualifiedID,
          title: step.title,
          when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
          category: categoryID,
          order: index2
        };
      });
      let isFeatured = false;
      if (walkthrough.featuredFor) {
        const folders = this.workspaceContextService.getWorkspace().folders.map((f) => f.uri);
        const token = new CancellationTokenSource();
        setTimeout(() => token.cancel(), 2e3);
        isFeatured = await this.instantiationService.invokeFunction((a) => checkGlobFileExists(a, folders, walkthrough.featuredFor, token.token));
      }
      const iconStr = walkthrough.icon ?? extension.icon;
      const walkthoughDescriptor = {
        description: walkthrough.description,
        title: walkthrough.title,
        id: categoryID,
        isFeatured,
        source: extension.displayName ?? extension.name,
        order: 0,
        walkthroughPageTitle: extension.displayName ?? extension.name,
        steps,
        icon: iconStr ? {
          type: "image",
          path: FileAccess.uriToBrowserUri(joinPath(extension.extensionLocation, iconStr)).toString(true)
        } : {
          icon: extensionDefaultIcon,
          type: "icon"
        },
        when: ContextKeyExpr.deserialize(override ?? walkthrough.when) ?? ContextKeyExpr.true()
      };
      this._registerWalkthrough(walkthoughDescriptor);
      this._onDidAddWalkthrough.fire(this.resolveWalkthrough(walkthoughDescriptor));
    }));
    this.storageService.store(walkthroughMetadataConfigurationKey, JSON.stringify([...this.metadata.entries()]), StorageScope.PROFILE, StorageTarget.USER);
    const hadLastFoucs = await this.hostService.hadLastFocus();
    const startupEditor = this.configurationService.getValue("workbench.startupEditor");
    if (hadLastFoucs && sectionToOpen && this.configurationService.getValue("workbench.welcomePage.walkthroughs.openOnInstall") && startupEditor !== "agentSessionsWelcomePage") {
      this.telemetryService.publicLog2("gettingStarted.didAutoOpenWalkthrough", { id: sectionToOpen });
      const activeEditor = this.editorService.activeEditor;
      if (activeEditor instanceof GettingStartedInput) {
        this.commandService.executeCommand("workbench.action.keepEditor");
      }
      this.commandService.executeCommand("workbench.action.openWalkthrough", sectionToOpen, {
        inactive: this.layoutService.hasFocus(Parts.EDITOR_PART)
        // do not steal the active editor away
      });
    }
  }
  unregisterExtensionWalkthroughContributions(extension) {
    if (!extension.contributes?.walkthroughs?.length) {
      return;
    }
    extension.contributes?.walkthroughs?.forEach((section) => {
      const categoryID = extension.identifier.value + "#" + section.id;
      section.steps.forEach((step) => {
        const fullyQualifiedID = extension.identifier.value + "#" + section.id + "#" + step.id;
        this.steps.delete(fullyQualifiedID);
      });
      this.gettingStartedContributions.delete(categoryID);
      this._onDidRemoveWalkthrough.fire(categoryID);
    });
  }
  getWalkthrough(id) {
    const walkthrough = this.gettingStartedContributions.get(id);
    if (!walkthrough) {
      throw Error("Trying to get unknown walkthrough: " + id);
    }
    return this.resolveWalkthrough(walkthrough);
  }
  getWalkthroughs() {
    const registeredCategories = [...this.gettingStartedContributions.values()];
    const categoriesWithCompletion = registeredCategories.map((category) => {
      return {
        ...category,
        content: {
          type: "steps",
          steps: category.steps
        }
      };
    }).filter((category) => category.content.type !== "steps" || category.content.steps.length).filter((category) => category.id !== "NewWelcomeExperience").map((category) => this.resolveWalkthrough(category));
    return categoriesWithCompletion;
  }
  resolveWalkthrough(category) {
    const stepsWithProgress = category.steps.map((step) => this.getStepProgress(step));
    const hasOpened = this.metadata.get(category.id)?.manaullyOpened;
    const firstSeenDate = this.metadata.get(category.id)?.firstSeen;
    const isNew = firstSeenDate && firstSeenDate > +/* @__PURE__ */ new Date() - NEW_WALKTHROUGH_TIME;
    const lastStepIDs = this.metadata.get(category.id)?.stepIDs;
    const rawCategory = this.gettingStartedContributions.get(category.id);
    if (!rawCategory) {
      throw Error("Could not find walkthrough with id " + category.id);
    }
    const currentStepIds = rawCategory.steps.map((s) => s.id);
    const hasNewSteps = lastStepIDs && (currentStepIds.length !== lastStepIDs.length || currentStepIds.some((id, index) => id !== lastStepIDs[index]));
    let recencyBonus = 0;
    if (firstSeenDate) {
      const currentDate = +/* @__PURE__ */ new Date();
      const timeSinceFirstSeen = currentDate - firstSeenDate;
      recencyBonus = Math.max(0, (NEW_WALKTHROUGH_TIME - timeSinceFirstSeen) / NEW_WALKTHROUGH_TIME);
    }
    return {
      ...category,
      recencyBonus,
      steps: stepsWithProgress,
      newItems: !!hasNewSteps,
      newEntry: !!(isNew && !hasOpened)
    };
  }
  getStepProgress(step) {
    return {
      ...step,
      done: false,
      ...this.stepProgress[step.id]
    };
  }
  progressStep(id) {
    const oldProgress = this.stepProgress[id];
    if (!oldProgress || oldProgress.done !== true) {
      this.stepProgress[id] = { done: true };
      this.memento.saveMemento();
      const step = this.getStep(id);
      if (!step) {
        throw Error("Tried to progress unknown step");
      }
      this._onDidProgressStep.fire(this.getStepProgress(step));
    }
  }
  deprogressStep(id) {
    delete this.stepProgress[id];
    this.memento.saveMemento();
    const step = this.getStep(id);
    this._onDidProgressStep.fire(this.getStepProgress(step));
  }
  progressByEvent(event) {
    if (this.sessionEvents.has(event)) {
      return;
    }
    this.sessionEvents.add(event);
    this.completionListeners.get(event)?.forEach((id) => this.progressStep(id));
  }
  registerWalkthrough(walkthoughDescriptor) {
    this._registerWalkthrough({
      ...walkthoughDescriptor,
      steps: walkthoughDescriptor.steps.map((step) => ({ ...step, description: parseDescription(step.description) }))
    });
  }
  _registerWalkthrough(walkthroughDescriptor) {
    const oldCategory = this.gettingStartedContributions.get(walkthroughDescriptor.id);
    if (oldCategory) {
      console.error(`Skipping attempt to overwrite walkthrough. (${walkthroughDescriptor.id})`);
      return;
    }
    this.gettingStartedContributions.set(walkthroughDescriptor.id, walkthroughDescriptor);
    walkthroughDescriptor.steps.forEach((step) => {
      if (this.steps.has(step.id)) {
        throw Error("Attempting to register step with id " + step.id + " twice. Second is dropped.");
      }
      this.steps.set(step.id, step);
      step.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
      this.registerDoneListeners(step);
    });
    walkthroughDescriptor.when.keys().forEach((key) => this.categoryVisibilityContextKeys.add(key));
  }
  registerDoneListeners(step) {
    if (step.doneOn) {
      console.error(`wakthrough step`, step, `uses deprecated 'doneOn' property. Adopt 'completionEvents' to silence this warning`);
      return;
    }
    if (!step.completionEvents.length) {
      step.completionEvents = coalesce(
        step.description.filter((linkedText) => linkedText.nodes.length === 1).flatMap((linkedText) => linkedText.nodes.filter(((node) => typeof node !== "string")).map(({ href }) => {
          if (href.startsWith("command:")) {
            return "onCommand:" + href.slice("command:".length, href.includes("?") ? href.indexOf("?") : void 0);
          }
          if (href.startsWith("https://") || href.startsWith("http://")) {
            return "onLink:" + href;
          }
          return void 0;
        }))
      );
    }
    if (!step.completionEvents.length) {
      step.completionEvents.push("stepSelected");
    }
    for (let event of step.completionEvents) {
      const [_, eventType, argument] = /^([^:]*):?(.*)$/.exec(event) ?? [];
      if (!eventType) {
        console.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
        continue;
      }
      switch (eventType) {
        case "onLink":
        case "onEvent":
        case "onView":
        case "onSettingChanged":
          break;
        case "onContext": {
          const expression = ContextKeyExpr.deserialize(argument);
          if (expression) {
            this.stepCompletionContextKeyExpressions.add(expression);
            expression.keys().forEach((key) => this.stepCompletionContextKeys.add(key));
            event = eventType + ":" + expression.serialize();
            if (this.contextService.contextMatchesRules(expression)) {
              this.sessionEvents.add(event);
            }
          } else {
            console.error("Unable to parse context key expression:", expression, "in walkthrough step", step.id);
          }
          break;
        }
        case "onStepSelected":
        case "stepSelected":
          event = "stepSelected:" + step.id;
          break;
        case "onCommand":
          event = eventType + ":" + argument.replace(/^toSide:/, "");
          break;
        case "onExtensionInstalled":
        case "extensionInstalled":
          event = "extensionInstalled:" + argument.toLowerCase();
          break;
        default:
          console.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
          continue;
      }
      this.registerCompletionListener(event, step);
    }
  }
  registerCompletionListener(event, step) {
    if (!this.completionListeners.has(event)) {
      this.completionListeners.set(event, /* @__PURE__ */ new Set());
    }
    this.completionListeners.get(event)?.add(step.id);
  }
  getStep(id) {
    const step = this.steps.get(id);
    if (!step) {
      throw Error("Attempting to access step which does not exist in registry " + id);
    }
    return step;
  }
};
WalkthroughsService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IUserDataSyncEnablementService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IExtensionManagementService),
  __decorateParam(8, IHostService),
  __decorateParam(9, IViewsService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IWorkbenchAssignmentService),
  __decorateParam(12, IWorkbenchLayoutService),
  __decorateParam(13, IEditorService)
], WalkthroughsService);
const parseDescription = (desc) => desc.split("\n").filter((x) => x).map((text) => parseLinkedText(text));
const convertInternalMediaPathToFileURI = (path) => path.startsWith("https://") ? URI.parse(path, true) : FileAccess.asFileUri(`vs/workbench/contrib/welcomeGettingStarted/common/media/${path}`);
const convertInternalMediaPathToBrowserURI = (path) => path.startsWith("https://") ? URI.parse(path, true) : FileAccess.asBrowserUri(`vs/workbench/contrib/welcomeGettingStarted/common/media/${path}`);
const convertInternalMediaPathsToBrowserURIs = (path) => {
  if (typeof path === "string") {
    const converted = convertInternalMediaPathToBrowserURI(path);
    return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
  } else {
    return {
      hcDark: convertInternalMediaPathToBrowserURI(path.hc),
      hcLight: convertInternalMediaPathToBrowserURI(path.hcLight ?? path.light),
      light: convertInternalMediaPathToBrowserURI(path.light),
      dark: convertInternalMediaPathToBrowserURI(path.dark)
    };
  }
};
const convertRelativeMediaPathsToWebviewURIs = (basePath, path) => {
  const convertPath = (path2) => path2.startsWith("https://") ? URI.parse(path2, true) : asWebviewUri(joinPath(basePath, path2));
  if (typeof path === "string") {
    const converted = convertPath(path);
    return { hcDark: converted, hcLight: converted, dark: converted, light: converted };
  } else {
    return {
      hcDark: convertPath(path.hc),
      hcLight: convertPath(path.hcLight ?? path.light),
      light: convertPath(path.light),
      dark: convertPath(path.dark)
    };
  }
};
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "resetGettingStartedProgress",
      category: localize2("developer", "Developer"),
      title: localize2("resetWelcomePageWalkthroughProgress", "Reset Welcome Page Walkthrough Progress"),
      f1: true,
      metadata: {
        description: localize2("resetGettingStartedProgressDescription", "Reset the progress of all Walkthrough steps on the Welcome Page to make them appear as if they are being viewed for the first time, providing a fresh start to the getting started experience.")
      }
    });
  }
  run(accessor) {
    const gettingStartedService = accessor.get(IWalkthroughsService);
    const storageService = accessor.get(IStorageService);
    storageService.store(
      hiddenEntriesConfigurationKey,
      JSON.stringify([]),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
    storageService.store(
      walkthroughMetadataConfigurationKey,
      JSON.stringify([]),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
    const memento = new Memento("gettingStartedService", accessor.get(IStorageService));
    const record = memento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        try {
          gettingStartedService.deprogressStep(key);
        } catch (e) {
          console.error(e);
        }
      }
    }
    memento.saveMemento();
  }
});
registerSingleton(IWalkthroughsService, WalkthroughsService, InstantiationType.Delayed);
export {
  HasMultipleNewFileEntries,
  IWalkthroughsService,
  WalkthroughsService,
  convertInternalMediaPathToFileURI,
  hiddenEntriesConfigurationKey,
  parseDescription,
  walkthroughMetadataConfigurationKey
};
