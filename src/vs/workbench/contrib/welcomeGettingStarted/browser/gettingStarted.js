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
import { $, addDisposableListener, append, clearNode, reset } from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { coalesce, equals } from "../../../../base/common/arrays.js";
import { Delayer, Throttler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { splitRecentLabel } from "../../../../base/common/labels.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { parse } from "../../../../base/common/marshalling.js";
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import { OS } from "../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import "./media/gettingStarted.css";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../platform/storage/common/storage.js";
import { firstSessionDateStorageKey, ITelemetryService, TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { getTelemetryLevel } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { defaultButtonStyles, defaultKeybindingLabelStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspacesService, isRecentFolder, isRecentWorkspace } from "../../../../platform/workspaces/common/workspaces.js";
import { OpenRecentAction } from "../../../browser/actions/windowActions.js";
import { OpenFileFolderAction, OpenFolderAction, OpenFolderViaWorkspaceAction } from "../../../browser/actions/workspaceActions.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { WorkbenchStateContext } from "../../../common/contextkeys.js";
import { IWebviewService } from "../../webview/browser/webview.js";
import "./gettingStartedColors.js";
import { GettingStartedDetailsRenderer } from "./gettingStartedDetailsRenderer.js";
import { gettingStartedCheckedCodicon, gettingStartedUncheckedCodicon } from "./gettingStartedIcons.js";
import { GettingStartedInput } from "./gettingStartedInput.js";
import { IWalkthroughsService, hiddenEntriesConfigurationKey, parseDescription } from "./gettingStartedService.js";
import { restoreWalkthroughsConfigurationKey } from "./startupPage.js";
import { startEntries } from "../common/gettingStartedContent.js";
import { GroupsOrder, IEditorGroupsService, preferredSideBySideGroupDirection } from "../../../services/editor/common/editorGroupsService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IWorkbenchThemeService } from "../../../services/themes/common/workbenchThemeService.js";
import { GettingStartedIndexList } from "./gettingStartedList.js";
import { canShowAgentsBanner, createAgentsBanner } from "../../chat/browser/agentSessions/agentSessionsBanner.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibleViewAction } from "../../accessibility/browser/accessibleViewActions.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
const SLIDE_TRANSITION_TIME_MS = 250;
const configurationKey = "workbench.startupEditor";
const allWalkthroughsHiddenContext = new RawContextKey("allWalkthroughsHidden", false);
const inWelcomeContext = new RawContextKey("inWelcome", false);
const parsedStartEntries = startEntries.map((e, i) => ({
  command: e.content.command,
  description: e.description,
  icon: { type: "icon", icon: e.icon },
  id: e.id,
  order: i,
  title: e.title,
  when: ContextKeyExpr.deserialize(e.when) ?? ContextKeyExpr.true()
}));
const REDUCED_MOTION_KEY = "workbench.welcomePage.preferReducedMotion";
let GettingStartedPage = class extends EditorPane {
  constructor(group, commandService, productService, keybindingService, gettingStartedService, configurationService, telemetryService, languageService, fileService, openerService, themeService, storageService, extensionService, instantiationService, notificationService, groupsService, contextService, quickInputService, workspacesService, labelService, hostService, webviewService, workspaceContextService, accessibilityService, markdownRendererService, chatEntitlementService) {
    super(GettingStartedPage.ID, group, telemetryService, themeService, storageService);
    this.commandService = commandService;
    this.productService = productService;
    this.keybindingService = keybindingService;
    this.gettingStartedService = gettingStartedService;
    this.configurationService = configurationService;
    this.languageService = languageService;
    this.fileService = fileService;
    this.openerService = openerService;
    this.themeService = themeService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.instantiationService = instantiationService;
    this.notificationService = notificationService;
    this.groupsService = groupsService;
    this.quickInputService = quickInputService;
    this.workspacesService = workspacesService;
    this.labelService = labelService;
    this.hostService = hostService;
    this.webviewService = webviewService;
    this.workspaceContextService = workspaceContextService;
    this.accessibilityService = accessibilityService;
    this.markdownRendererService = markdownRendererService;
    this.chatEntitlementService = chatEntitlementService;
    this.inProgressScroll = Promise.resolve();
    this.dispatchListeners = new DisposableStore();
    this.stepDisposables = new DisposableStore();
    this.detailsPageDisposables = new DisposableStore();
    this.mediaDisposables = new DisposableStore();
    this.detailsScrollbar = this._register(new MutableDisposable());
    this.buildSlideThrottle = this._register(new Throttler());
    this.recentlyOpenedList = this._register(new MutableDisposable());
    this.startList = this._register(new MutableDisposable());
    this.gettingStartedList = this._register(new MutableDisposable());
    this.showFeaturedWalkthrough = true;
    this.currentMediaComponent = void 0;
    this.currentMediaType = void 0;
    this.container = $(
      ".gettingStartedContainer",
      {
        role: "document",
        tabindex: 0,
        "aria-label": localize("welcomeAriaLabel", "Overview of how to get up to speed with your editor.")
      }
    );
    this.stepMediaComponent = $(".getting-started-media");
    this.stepMediaComponent.id = generateUuid();
    this.categoriesSlideDisposables = this._register(new DisposableStore());
    this.detailsRenderer = new GettingStartedDetailsRenderer(this.fileService, this.notificationService, this.extensionService, this.languageService);
    this.contextService = this._register(contextService.createScoped(this.container));
    inWelcomeContext.bindTo(this.contextService).set(true);
    this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
    this._register(this.dispatchListeners);
    const rerender = () => {
      this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
      if (this.currentWalkthrough) {
        const existingSteps = this.currentWalkthrough.steps.map((step) => step.id);
        const newCategory = this.gettingStartedCategories.find((category) => this.currentWalkthrough?.id === category.id);
        if (newCategory) {
          const newSteps = newCategory.steps.map((step) => step.id);
          if (!equals(newSteps, existingSteps)) {
            this.buildSlideThrottle.queue(() => this.buildCategoriesSlide());
          }
        }
      } else {
        this.buildSlideThrottle.queue(() => this.buildCategoriesSlide());
      }
    };
    this._register(this.gettingStartedService.onDidAddWalkthrough(rerender));
    this._register(this.gettingStartedService.onDidRemoveWalkthrough(rerender));
    this.recentlyOpened = this.workspacesService.getRecentlyOpened();
    this._register(workspacesService.onDidChangeRecentlyOpened(() => {
      this.recentlyOpened = workspacesService.getRecentlyOpened();
      this.refreshRecentlyOpened();
    }));
    this._register(this.gettingStartedService.onDidChangeWalkthrough((category) => {
      const ourCategory = this.gettingStartedCategories.find((c) => c.id === category.id);
      if (!ourCategory) {
        return;
      }
      ourCategory.title = category.title;
      ourCategory.description = category.description;
      this.container.querySelectorAll(`[x-category-title-for="${category.id}"]`).forEach((step) => step.innerText = ourCategory.title);
      this.container.querySelectorAll(`[x-category-description-for="${category.id}"]`).forEach((step) => step.innerText = ourCategory.description);
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(REDUCED_MOTION_KEY)) {
        this.container.classList.toggle("animatable", this.shouldAnimate());
      }
    }));
    this._register(this.gettingStartedService.onDidProgressStep((step) => {
      const category = this.gettingStartedCategories.find((c) => c.id === step.category);
      if (!category) {
        throw Error("Could not find category with ID: " + step.category);
      }
      const ourStep = category.steps.find((_step) => _step.id === step.id);
      if (!ourStep) {
        throw Error("Could not find step with ID: " + step.id);
      }
      const stats = this.getWalkthroughCompletionStats(category);
      if (!ourStep.done && stats.stepsComplete === stats.stepsTotal - 1) {
        this.hideCategory(category.id);
      }
      ourStep.done = step.done;
      if (category.id === this.currentWalkthrough?.id) {
        const badgeelements = assertReturnsDefined(this.window.document.querySelectorAll(`[data-done-step-id="${step.id}"]`));
        badgeelements.forEach((badgeelement) => {
          if (step.done) {
            badgeelement.setAttribute("aria-checked", "true");
            badgeelement.parentElement?.setAttribute("aria-checked", "true");
            badgeelement.classList.remove(...ThemeIcon.asClassNameArray(gettingStartedUncheckedCodicon));
            badgeelement.classList.add("complete", ...ThemeIcon.asClassNameArray(gettingStartedCheckedCodicon));
            badgeelement.setAttribute("aria-label", localize("stepDone", "{0}: Completed", step.title));
          } else {
            badgeelement.setAttribute("aria-checked", "false");
            badgeelement.parentElement?.setAttribute("aria-checked", "false");
            badgeelement.classList.remove("complete", ...ThemeIcon.asClassNameArray(gettingStartedCheckedCodicon));
            badgeelement.classList.add(...ThemeIcon.asClassNameArray(gettingStartedUncheckedCodicon));
            badgeelement.setAttribute("aria-label", localize("stepNotDone", "{0}: Not completed", step.title));
          }
        });
        if (step.done) {
          status(localize("stepAutoCompleted", "Step {0} completed", step.title));
        }
      }
      this.updateCategoryProgress();
    }));
    this._register(this.storageService.onWillSaveState((e) => {
      if (e.reason !== WillSaveStateReason.SHUTDOWN) {
        return;
      }
      if (this.workspaceContextService.getWorkspace().folders.length !== 0) {
        return;
      }
      if (!this.editorInput || !this.currentWalkthrough || !this.editorInput.selectedCategory || !this.editorInput.selectedStep) {
        return;
      }
      const editorPane = this.groupsService.activeGroup.activeEditorPane;
      if (!(editorPane instanceof GettingStartedPage)) {
        return;
      }
      const restoreData = { folder: UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, category: this.editorInput.selectedCategory, step: this.editorInput.selectedStep };
      this.storageService.store(
        restoreWalkthroughsConfigurationKey,
        JSON.stringify(restoreData),
        StorageScope.PROFILE,
        StorageTarget.MACHINE
      );
    }));
  }
  static {
    this.ID = "gettingStartedPage";
  }
  get editorInput() {
    return this._input;
  }
  // remove when 'workbench.welcomePage.preferReducedMotion' deprecated
  shouldAnimate() {
    if (this.configurationService.getValue(REDUCED_MOTION_KEY)) {
      return false;
    }
    if (this.accessibilityService.isMotionReduced()) {
      return false;
    }
    return true;
  }
  getWalkthroughCompletionStats(walkthrough) {
    const activeSteps = walkthrough.steps.filter((s) => this.contextService.contextMatchesRules(s.when));
    return {
      stepsComplete: activeSteps.filter((s) => s.done).length,
      stepsTotal: activeSteps.length
    };
  }
  async setInput(newInput, options, context, token) {
    await super.setInput(newInput, options, context, token);
    const selectedCategory = options?.selectedCategory ?? newInput.selectedCategory;
    const selectedStep = options?.selectedStep ?? newInput.selectedStep;
    await this.applyInput({ ...options, selectedCategory, selectedStep });
  }
  async setOptions(options) {
    super.setOptions(options);
    if (!this.editorInput) {
      return;
    }
    if (this.editorInput.selectedCategory !== options?.selectedCategory || this.editorInput.selectedStep !== options?.selectedStep) {
      await this.applyInput(options);
    }
  }
  async applyInput(options) {
    if (!this.editorInput) {
      return;
    }
    this.editorInput.showTelemetryNotice = options?.showTelemetryNotice ?? true;
    this.editorInput.selectedCategory = options?.selectedCategory;
    this.editorInput.selectedStep = options?.selectedStep;
    this.editorInput.returnToCommand = options?.returnToCommand;
    this.container.classList.remove("animatable");
    await this.buildCategoriesSlide(options?.preserveFocus);
    if (this.shouldAnimate()) {
      setTimeout(() => this.container.classList.add("animatable"), 0);
    }
  }
  async makeCategoryVisibleWhenAvailable(categoryID, stepId) {
    this.scrollToCategory(categoryID, stepId);
  }
  registerDispatchListeners() {
    this.dispatchListeners.clear();
    this.container.querySelectorAll("[x-dispatch]").forEach((element) => {
      const dispatch = element.getAttribute("x-dispatch") ?? "";
      let command, argument;
      if (dispatch.startsWith("openLink:https")) {
        [command, argument] = ["openLink", dispatch.replace("openLink:", "")];
      } else {
        [command, argument] = dispatch.split(":");
      }
      if (command) {
        this.dispatchListeners.add(addDisposableListener(element, "click", (e) => {
          e.stopPropagation();
          this.runDispatchCommand(command, argument);
        }));
        this.dispatchListeners.add(addDisposableListener(element, "keyup", (e) => {
          const keyboardEvent = new StandardKeyboardEvent(e);
          e.stopPropagation();
          switch (keyboardEvent.keyCode) {
            case KeyCode.Enter:
            case KeyCode.Space:
              this.runDispatchCommand(command, argument);
              return;
          }
        }));
      }
    });
  }
  async runDispatchCommand(command, argument) {
    this.commandService.executeCommand("workbench.action.keepEditor");
    this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command, argument, walkthroughId: this.currentWalkthrough?.id });
    switch (command) {
      case "scrollPrev": {
        this.scrollPrev();
        break;
      }
      case "skip": {
        this.runSkip();
        break;
      }
      case "showMoreRecents": {
        this.commandService.executeCommand(OpenRecentAction.ID);
        break;
      }
      case "seeAllWalkthroughs": {
        await this.openWalkthroughSelector();
        break;
      }
      case "openFolder": {
        if (this.contextService.contextMatchesRules(ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("workspace")))) {
          this.commandService.executeCommand(OpenFolderViaWorkspaceAction.ID);
        } else {
          this.commandService.executeCommand("workbench.action.files.openFolder");
        }
        break;
      }
      case "selectCategory": {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "selectCategory", argument, walkthroughId: this.currentWalkthrough?.id });
        this.scrollToCategory(argument);
        this.gettingStartedService.markWalkthroughOpened(argument);
        break;
      }
      case "selectStartEntry": {
        const selected = startEntries.find((e) => e.id === argument);
        if (selected) {
          this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "selectStartEntry", argument, walkthroughId: this.currentWalkthrough?.id });
          this.runStepCommand(selected.content.command);
        } else {
          throw Error("could not find start entry with id: " + argument);
        }
        break;
      }
      case "hideCategory": {
        this.hideCategory(argument);
        break;
      }
      // Use selectTask over selectStep to keep telemetry consistant:https://github.com/microsoft/vscode/issues/122256
      case "selectTask": {
        this.selectStep(argument);
        break;
      }
      case "toggleStepCompletion": {
        this.toggleStepCompletion(argument);
        break;
      }
      case "allDone": {
        this.markAllStepsComplete();
        break;
      }
      case "nextSection": {
        const next = this.currentWalkthrough?.next;
        if (next) {
          this.prevWalkthrough = this.currentWalkthrough;
          this.scrollToCategory(next);
        } else {
          console.error("Error scrolling to next section of", this.currentWalkthrough);
        }
        break;
      }
      case "openLink": {
        this.openerService.open(argument);
        break;
      }
      default: {
        console.error("Dispatch to", command, argument, "not defined");
        break;
      }
    }
  }
  hideCategory(categoryId) {
    const selectedCategory = this.gettingStartedCategories.find((category) => category.id === categoryId);
    if (!selectedCategory) {
      throw Error("Could not find category with ID " + categoryId);
    }
    this.setHiddenCategories([...this.getHiddenCategories().add(categoryId)]);
    this.gettingStartedList.value?.rerender();
  }
  markAllStepsComplete() {
    if (this.currentWalkthrough) {
      this.currentWalkthrough?.steps.forEach((step) => {
        if (!step.done) {
          this.gettingStartedService.progressStep(step.id);
        }
      });
      this.hideCategory(this.currentWalkthrough?.id);
      this.scrollPrev();
    } else {
      throw Error("No walkthrough opened");
    }
  }
  toggleStepCompletion(argument) {
    const stepToggle = assertReturnsDefined(this.currentWalkthrough?.steps.find((step) => step.id === argument));
    if (stepToggle.done) {
      this.gettingStartedService.deprogressStep(argument);
    } else {
      this.gettingStartedService.progressStep(argument);
    }
  }
  async openWalkthroughSelector() {
    const selection = await this.quickInputService.pick(this.gettingStartedCategories.filter((c) => this.contextService.contextMatchesRules(c.when)).map((x) => ({
      id: x.id,
      label: x.title,
      detail: x.description,
      description: x.source
    })), { canPickMany: false, matchOnDescription: true, matchOnDetail: true, title: localize("pickWalkthroughs", "Open Walkthrough...") });
    if (selection) {
      this.runDispatchCommand("selectCategory", selection.id);
    }
  }
  getHiddenCategories() {
    return new Set(JSON.parse(this.storageService.get(hiddenEntriesConfigurationKey, StorageScope.PROFILE, "[]")));
  }
  setHiddenCategories(hidden) {
    this.storageService.store(
      hiddenEntriesConfigurationKey,
      JSON.stringify(hidden),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
  }
  async buildMediaComponent(stepId, forceRebuild = false) {
    if (!this.currentWalkthrough) {
      throw Error("no walkthrough selected");
    }
    const stepToExpand = assertReturnsDefined(this.currentWalkthrough.steps.find((step) => step.id === stepId));
    if (!forceRebuild && this.currentMediaComponent === stepId) {
      return;
    }
    this.currentMediaComponent = stepId;
    this.stepDisposables.clear();
    this.stepDisposables.add({
      dispose: () => {
        this.currentMediaComponent = void 0;
      }
    });
    if (this.currentMediaType !== stepToExpand.media.type) {
      this.mediaDisposables.clear();
      this.currentMediaType = stepToExpand.media.type;
      this.mediaDisposables.add(toDisposable(() => {
        this.currentMediaType = void 0;
      }));
      clearNode(this.stepMediaComponent);
      if (stepToExpand.media.type === "svg") {
        this.webview = this.mediaDisposables.add(this.webviewService.createWebviewElement({ title: void 0, options: { disableServiceWorker: true }, contentOptions: {}, extension: void 0 }));
        this.webview.mountTo(this.stepMediaComponent, this.window);
      } else if (stepToExpand.media.type === "markdown") {
        this.webview = this.mediaDisposables.add(this.webviewService.createWebviewElement({ options: {}, contentOptions: { localResourceRoots: [stepToExpand.media.root], allowScripts: true }, title: "", extension: void 0 }));
        this.webview.mountTo(this.stepMediaComponent, this.window);
      } else if (stepToExpand.media.type === "video") {
        this.webview = this.mediaDisposables.add(this.webviewService.createWebviewElement({ options: {}, contentOptions: { localResourceRoots: [stepToExpand.media.root], allowScripts: true }, title: "", extension: void 0 }));
        this.webview.mountTo(this.stepMediaComponent, this.window);
      }
    }
    if (stepToExpand.media.type === "image") {
      this.stepsContent.classList.add("image");
      this.stepsContent.classList.remove("markdown");
      this.stepsContent.classList.remove("video");
      const media = stepToExpand.media;
      const mediaElement = $("img");
      clearNode(this.stepMediaComponent);
      this.stepMediaComponent.appendChild(mediaElement);
      mediaElement.setAttribute("alt", media.altText);
      this.updateMediaSourceForColorMode(mediaElement, media.path);
      this.stepDisposables.add(addDisposableListener(this.stepMediaComponent, "click", () => {
        const hrefs = stepToExpand.description.map((lt) => lt.nodes.filter((node) => typeof node !== "string").map((node) => node.href)).flat();
        if (hrefs.length === 1) {
          const href = hrefs[0];
          if (href.startsWith("http")) {
            this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "runStepAction", argument: href, walkthroughId: this.currentWalkthrough?.id });
            this.openerService.open(href);
          }
        }
      }));
      this.stepDisposables.add(this.themeService.onDidColorThemeChange(() => this.updateMediaSourceForColorMode(mediaElement, media.path)));
    } else if (stepToExpand.media.type === "svg") {
      this.stepsContent.classList.add("image");
      this.stepsContent.classList.remove("markdown");
      this.stepsContent.classList.remove("video");
      const media = stepToExpand.media;
      this.webview.setHtml(await this.detailsRenderer.renderSVG(media.path));
      let isDisposed = false;
      this.stepDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.stepDisposables.add(this.themeService.onDidColorThemeChange(async () => {
        const body = await this.detailsRenderer.renderSVG(media.path);
        if (!isDisposed) {
          this.webview.setHtml(body);
        }
      }));
      this.stepDisposables.add(addDisposableListener(this.stepMediaComponent, "click", () => {
        const hrefs = stepToExpand.description.map((lt) => lt.nodes.filter((node) => typeof node !== "string").map((node) => node.href)).flat();
        if (hrefs.length === 1) {
          const href = hrefs[0];
          if (href.startsWith("http")) {
            this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "runStepAction", argument: href, walkthroughId: this.currentWalkthrough?.id });
            this.openerService.open(href);
          }
        }
      }));
      this.stepDisposables.add(this.webview.onDidClickLink((link) => {
        if (matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.command)) {
          this.openerService.open(link, { allowCommands: true });
        }
      }));
    } else if (stepToExpand.media.type === "markdown") {
      this.stepsContent.classList.remove("image");
      this.stepsContent.classList.add("markdown");
      this.stepsContent.classList.remove("video");
      const media = stepToExpand.media;
      const rawHTML = await this.detailsRenderer.renderMarkdown(media.path, media.base);
      this.webview.setHtml(rawHTML);
      const serializedContextKeyExprs = rawHTML.match(/checked-on=\"([^'][^"]*)\"/g)?.map((attr) => attr.slice('checked-on="'.length, -1).replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
      const postTrueKeysMessage = () => {
        const enabledContextKeys = serializedContextKeyExprs?.filter((expr) => this.contextService.contextMatchesRules(ContextKeyExpr.deserialize(expr)));
        if (enabledContextKeys) {
          this.webview.postMessage({
            enabledContextKeys
          });
        }
      };
      if (serializedContextKeyExprs) {
        const contextKeyExprs = coalesce(serializedContextKeyExprs.map((expr) => ContextKeyExpr.deserialize(expr)));
        const watchingKeys = new Set(contextKeyExprs.flatMap((expr) => expr.keys()));
        this.stepDisposables.add(this.contextService.onDidChangeContext((e) => {
          if (e.affectsSome(watchingKeys)) {
            postTrueKeysMessage();
          }
        }));
      }
      let isDisposed = false;
      this.stepDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.stepDisposables.add(this.webview.onDidClickLink((link) => {
        if (matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.command)) {
          const toSide = link.startsWith("command:toSide:");
          if (toSide) {
            link = link.replace("command:toSide:", "command:");
            this.focusSideEditorGroup();
          }
          this.openerService.open(link, { allowCommands: true, openToSide: toSide });
        }
      }));
      if (rawHTML.indexOf("<code>") >= 0) {
        this.stepDisposables.add(this.themeService.onDidColorThemeChange(async () => {
          const body = await this.detailsRenderer.renderMarkdown(media.path, media.base);
          if (!isDisposed) {
            this.webview.setHtml(body);
            postTrueKeysMessage();
          }
        }));
      }
      const layoutDelayer = new Delayer(50);
      this.layoutMarkdown = () => {
        layoutDelayer.trigger(() => {
          this.webview.postMessage({ layoutMeNow: true });
        });
      };
      this.stepDisposables.add(layoutDelayer);
      this.stepDisposables.add({ dispose: () => this.layoutMarkdown = void 0 });
      postTrueKeysMessage();
      this.stepDisposables.add(this.webview.onMessage(async (e) => {
        const message = e.message;
        if (message.startsWith("command:")) {
          this.openerService.open(message, { allowCommands: true });
        } else if (message.startsWith("setTheme:")) {
          const themeId = message.slice("setTheme:".length);
          const theme = (await this.themeService.getColorThemes()).find((theme2) => theme2.settingsId === themeId);
          if (theme) {
            this.themeService.setColorTheme(theme.id, ConfigurationTarget.USER);
          }
        } else {
          console.error("Unexpected message", message);
        }
      }));
    } else if (stepToExpand.media.type === "video") {
      this.stepsContent.classList.add("video");
      this.stepsContent.classList.remove("markdown");
      this.stepsContent.classList.remove("image");
      const media = stepToExpand.media;
      const themeType = this.themeService.getColorTheme().type;
      const videoPath = media.path[themeType];
      const videoPoster = media.poster ? media.poster[themeType] : void 0;
      const altText = media.altText ? media.altText : localize("videoAltText", "Video for {0}", stepToExpand.title);
      const rawHTML = await this.detailsRenderer.renderVideo(videoPath, videoPoster, altText);
      this.webview.setHtml(rawHTML);
      let isDisposed = false;
      this.stepDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.stepDisposables.add(this.themeService.onDidColorThemeChange(async () => {
        const themeType2 = this.themeService.getColorTheme().type;
        const videoPath2 = media.path[themeType2];
        const videoPoster2 = media.poster ? media.poster[themeType2] : void 0;
        const body = await this.detailsRenderer.renderVideo(videoPath2, videoPoster2, altText);
        if (!isDisposed) {
          this.webview.setHtml(body);
        }
      }));
    }
  }
  async selectStepLoose(id) {
    if (!this.editorInput) {
      return;
    }
    if (id.startsWith(`${this.editorInput.selectedCategory}#`)) {
      this.selectStep(id);
    } else {
      const toSelect = this.editorInput.selectedCategory + "#" + id;
      this.selectStep(toSelect);
    }
  }
  provideScreenReaderUpdate() {
    if (this.configurationService.getValue(AccessibilityVerbositySettingId.Walkthrough)) {
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibleViewAction.id)?.getAriaLabel();
      return kbLabel ? localize("acessibleViewHint", "Inspect this in the accessible view ({0}).\n", kbLabel) : localize("acessibleViewHintNoKbOpen", "Inspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.\n");
    }
    return "";
  }
  async selectStep(id, delayFocus = true, preserveFocus) {
    if (!this.editorInput) {
      return;
    }
    if (id) {
      let stepElement = this.container.querySelector(`[data-step-id="${id}"]`);
      if (!stepElement) {
        stepElement = this.container.querySelector(`[data-step-id]`);
        if (!stepElement) {
          return;
        }
        id = assertReturnsDefined(stepElement.getAttribute("data-step-id"));
      }
      stepElement.parentElement?.querySelectorAll(".expanded").forEach((node) => {
        if (node.getAttribute("data-step-id") !== id) {
          node.classList.remove("expanded");
          node.setAttribute("aria-expanded", "false");
          const codiconElement2 = node.querySelector(".codicon");
          if (codiconElement2) {
            codiconElement2.removeAttribute("tabindex");
          }
        }
      });
      if (!preserveFocus) {
        setTimeout(() => stepElement.focus(), delayFocus && this.shouldAnimate() ? SLIDE_TRANSITION_TIME_MS : 0);
      }
      this.editorInput.selectedStep = id;
      stepElement.classList.add("expanded");
      stepElement.setAttribute("aria-expanded", "true");
      this.buildMediaComponent(id, true);
      const codiconElement = stepElement.querySelector(".codicon");
      if (codiconElement) {
        codiconElement.setAttribute("tabindex", "0");
      }
      this.gettingStartedService.progressByEvent("stepSelected:" + id);
      const step = this.currentWalkthrough?.steps?.find((step2) => step2.id === id);
      if (step) {
        stepElement.setAttribute("aria-label", `${this.provideScreenReaderUpdate()} ${step.title}`);
      }
    } else {
      this.editorInput.selectedStep = void 0;
    }
    this.detailsPageScrollbar?.scanDomNode();
    this.detailsScrollbar.value?.scanDomNode();
  }
  updateMediaSourceForColorMode(element, sources) {
    const themeType = this.themeService.getColorTheme().type;
    const src = sources[themeType].toString(true).replace(/ /g, "%20");
    element.srcset = src.toLowerCase().endsWith(".svg") ? src : src + " 1.5x";
  }
  createEditor(parent) {
    if (this.detailsPageScrollbar) {
      this.detailsPageScrollbar.dispose();
    }
    if (this.categoriesPageScrollbar) {
      this.categoriesPageScrollbar.dispose();
    }
    this.categoriesSlide = $(".gettingStartedSlideCategories.gettingStartedSlide");
    const prevButton = $("button.prev-button.button-link", { "x-dispatch": "scrollPrev" }, $("span.scroll-button.codicon.codicon-chevron-left"), $("span.moreText", {}, localize("goBack", "Go Back")));
    this.stepsSlide = $(".gettingStartedSlideDetails.gettingStartedSlide", {}, prevButton);
    this.stepsContent = $(".gettingStartedDetailsContent", {});
    this.detailsPageScrollbar = this._register(new DomScrollableElement(this.stepsContent, { className: "full-height-scrollable", vertical: ScrollbarVisibility.Hidden }));
    this.categoriesPageScrollbar = this._register(new DomScrollableElement(this.categoriesSlide, { className: "full-height-scrollable categoriesScrollbar", vertical: ScrollbarVisibility.Hidden }));
    this.stepsSlide.appendChild(this.detailsPageScrollbar.getDomNode());
    const gettingStartedPage = $(".gettingStarted", {}, this.categoriesPageScrollbar.getDomNode(), this.stepsSlide);
    this.container.appendChild(gettingStartedPage);
    this.categoriesPageScrollbar.scanDomNode();
    this.detailsPageScrollbar.scanDomNode();
    parent.appendChild(this.container);
  }
  async buildCategoriesSlide(preserveFocus) {
    this.categoriesSlideDisposables.clear();
    const showOnStartupCheckbox = new Toggle({
      icon: Codicon.check,
      actionClassName: "getting-started-checkbox",
      isChecked: this.configurationService.getValue(configurationKey) === "welcomePage",
      title: localize("checkboxTitle", "When checked, this page will be shown on startup."),
      ...defaultToggleStyles
    });
    showOnStartupCheckbox.domNode.id = "showOnStartup";
    const showOnStartupLabel = $("label.caption", { for: "showOnStartup" }, localize("welcomePage.showOnStartup", "Show welcome page on startup"));
    const onShowOnStartupChanged = () => {
      if (showOnStartupCheckbox.checked) {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "showOnStartupChecked", argument: void 0, walkthroughId: this.currentWalkthrough?.id });
        this.configurationService.updateValue(configurationKey, "welcomePage");
      } else {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "showOnStartupUnchecked", argument: void 0, walkthroughId: this.currentWalkthrough?.id });
        this.configurationService.updateValue(configurationKey, "none");
      }
    };
    this.categoriesSlideDisposables.add(showOnStartupCheckbox);
    this.categoriesSlideDisposables.add(showOnStartupCheckbox.onChange(() => {
      onShowOnStartupChanged();
    }));
    this.categoriesSlideDisposables.add(addDisposableListener(showOnStartupLabel, "click", () => {
      showOnStartupCheckbox.checked = !showOnStartupCheckbox.checked;
      onShowOnStartupChanged();
    }));
    const header = $(
      ".header",
      {},
      $("h1.product-name.caption", {}, this.productService.nameLong),
      $("p.subtitle.description", {}, localize({ key: "gettingStarted.editingEvolved", comment: ["Shown as subtitle on the Welcome page."] }, "Editing evolved"))
    );
    const leftColumn = $(".categories-column.categories-column-left", {});
    const rightColumn = $(".categories-column.categories-column-right", {});
    const startList = this.buildStartList();
    const recentList = this.buildRecentlyOpenedList();
    const gettingStartedList = this.buildGettingStartedWalkthroughsList();
    const footerChildren = [];
    if (canShowAgentsBanner(this.chatEntitlementService)) {
      const agentsBanner = createAgentsBanner(
        {
          cssClass: "getting-started-category.agents-banner",
          source: "welcomePage"
        },
        this.commandService,
        this.telemetryService
      );
      this.categoriesSlideDisposables.add(agentsBanner.disposables);
      footerChildren.push(agentsBanner.element);
    }
    footerChildren.push($(
      "p.showOnStartup",
      {},
      showOnStartupCheckbox.domNode,
      showOnStartupLabel
    ));
    const footer = $(".footer", {}, ...footerChildren);
    const layoutLists = () => {
      if (gettingStartedList.itemCount) {
        this.container.classList.remove("noWalkthroughs");
        reset(rightColumn, gettingStartedList.getDomElement());
      } else {
        this.container.classList.add("noWalkthroughs");
        reset(rightColumn);
      }
      setTimeout(() => this.categoriesPageScrollbar?.scanDomNode(), 50);
      layoutRecentList();
    };
    const layoutRecentList = () => {
      if (this.container.classList.contains("noWalkthroughs")) {
        recentList.setLimit(10);
        reset(leftColumn, startList.getDomElement());
        reset(rightColumn, recentList.getDomElement());
      } else {
        recentList.setLimit(5);
        reset(leftColumn, startList.getDomElement(), recentList.getDomElement());
      }
    };
    gettingStartedList.onDidChange(layoutLists);
    layoutLists();
    reset(this.categoriesSlide, $(".gettingStartedCategoriesContainer", {}, header, leftColumn, rightColumn, footer));
    this.categoriesPageScrollbar?.scanDomNode();
    this.updateCategoryProgress();
    this.registerDispatchListeners();
    const editorInput = this.editorInput;
    if (editorInput?.selectedCategory) {
      this.currentWalkthrough = this.gettingStartedCategories.find((category) => category.id === editorInput.selectedCategory);
      if (!this.currentWalkthrough) {
        this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
        this.currentWalkthrough = this.gettingStartedCategories.find((category) => category.id === editorInput.selectedCategory);
        if (this.currentWalkthrough) {
          this.buildCategorySlide(editorInput.selectedCategory, editorInput.selectedStep, preserveFocus);
          this.setSlide("details");
          return;
        }
      } else {
        this.buildCategorySlide(editorInput.selectedCategory, editorInput.selectedStep, preserveFocus);
        this.setSlide("details");
        return;
      }
    }
    if (this.editorInput?.showTelemetryNotice && this.productService.openToWelcomeMainPage) {
      const telemetryNotice = $("p.telemetry-notice");
      this.buildTelemetryFooter(telemetryNotice);
      footer.appendChild(telemetryNotice);
    } else if (!this.productService.openToWelcomeMainPage && this.showFeaturedWalkthrough && this.storageService.isNew(StorageScope.APPLICATION) && !this.configurationService.getValue("workbench.welcomePage.experimentalOnboarding")) {
      const firstSessionDateString = this.storageService.get(firstSessionDateStorageKey, StorageScope.APPLICATION) || (/* @__PURE__ */ new Date()).toUTCString();
      const daysSinceFirstSession = (+/* @__PURE__ */ new Date() - +new Date(firstSessionDateString)) / 1e3 / 60 / 60 / 24;
      const fistContentBehaviour = daysSinceFirstSession < 1 ? "openToFirstCategory" : "index";
      if (fistContentBehaviour === "openToFirstCategory") {
        const first = this.gettingStartedCategories.filter((c) => !c.when || this.contextService.contextMatchesRules(c.when))[0];
        if (first && this.editorInput) {
          this.currentWalkthrough = first;
          this.editorInput.selectedCategory = this.currentWalkthrough?.id;
          this.editorInput.walkthroughPageTitle = this.currentWalkthrough.walkthroughPageTitle;
          this.buildCategorySlide(this.editorInput.selectedCategory, void 0, preserveFocus);
          this.setSlide(
            "details",
            true
            /* firstLaunch */
          );
          return;
        }
      }
    }
    this.setSlide("categories");
  }
  buildRecentlyOpenedList() {
    const renderRecent = (recent) => {
      let fullPath;
      let windowOpenable;
      let resourceUri;
      if (isRecentFolder(recent)) {
        windowOpenable = { folderUri: recent.folderUri };
        fullPath = recent.label || this.labelService.getWorkspaceLabel(recent.folderUri, { verbose: Verbosity.LONG });
        resourceUri = recent.folderUri;
      } else {
        fullPath = recent.label || this.labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
        windowOpenable = { workspaceUri: recent.workspace.configPath };
        resourceUri = recent.workspace.configPath;
      }
      const { name, parentPath } = splitRecentLabel(fullPath);
      const li = $("li");
      const link = $("button.button-link");
      link.innerText = name;
      link.title = fullPath;
      link.setAttribute("aria-label", localize("welcomePage.openFolderWithPath", "Open folder {0} with path {1}", name, parentPath));
      link.addEventListener("click", (e) => {
        this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "openRecent", argument: void 0, walkthroughId: this.currentWalkthrough?.id });
        this.hostService.openWindow([windowOpenable], {
          forceNewWindow: e.ctrlKey || e.metaKey,
          remoteAuthority: recent.remoteAuthority || null
          // local window if remoteAuthority is not set or can not be deducted from the openable
        });
        e.preventDefault();
        e.stopPropagation();
      });
      li.appendChild(link);
      const span = $("span");
      span.classList.add("path");
      span.classList.add("detail");
      span.innerText = parentPath;
      span.title = fullPath;
      li.appendChild(span);
      const deleteButton = $("a.codicon.codicon-close.hide-category-button.recently-opened-delete-button", {
        "tabindex": 0,
        "role": "button",
        "title": localize("welcomePage.removeRecent", "Remove from Recently Opened"),
        "aria-label": localize("welcomePage.removeRecentAriaLabel", "Remove {0} from Recently Opened", name)
      });
      const handleDelete = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.workspacesService.removeRecentlyOpened([resourceUri]);
      };
      deleteButton.addEventListener("click", handleDelete);
      deleteButton.addEventListener("keydown", async (e) => {
        const event = new StandardKeyboardEvent(e);
        if (event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) {
          await handleDelete(e);
        }
      });
      li.appendChild(deleteButton);
      return li;
    };
    const recentlyOpenedList = this.recentlyOpenedList.value = new GettingStartedIndexList(
      {
        title: localize("recent", "Recent"),
        klass: "recently-opened",
        limit: 5,
        empty: $(
          ".empty-recent",
          {},
          localize("noRecents", "You have no recent folders,"),
          $("button.button-link", { "x-dispatch": "openFolder" }, localize("openFolder", "open a folder")),
          localize("toStart", "to start.")
        ),
        more: $(
          ".more",
          {},
          $(
            "button.button-link",
            {
              "x-dispatch": "showMoreRecents",
              title: localize("show more recents", "Show All Recent Folders {0}", this.getKeybindingLabel(OpenRecentAction.ID))
            },
            localize("showAll", "More...")
          )
        ),
        renderElement: renderRecent,
        contextService: this.contextService
      }
    );
    recentlyOpenedList.onDidChange(() => this.registerDispatchListeners());
    this.recentlyOpened.then(({ workspaces }) => {
      const workspacesWithID = this.filterRecentlyOpened(workspaces);
      const updateEntries = () => {
        recentlyOpenedList.setEntries(workspacesWithID);
      };
      updateEntries();
      recentlyOpenedList.register(this.labelService.onDidChangeFormatters(() => updateEntries()));
    }).catch(onUnexpectedError);
    return recentlyOpenedList;
  }
  filterRecentlyOpened(workspaces) {
    return workspaces.filter((recent) => !this.workspaceContextService.isCurrentWorkspace(isRecentWorkspace(recent) ? recent.workspace : recent.folderUri)).map((recent) => ({ ...recent, id: isRecentWorkspace(recent) ? recent.workspace.id : recent.folderUri.toString() }));
  }
  refreshRecentlyOpened() {
    if (!this.recentlyOpenedList.value) {
      return;
    }
    this.recentlyOpened.then(({ workspaces }) => {
      const workspacesWithID = this.filterRecentlyOpened(workspaces);
      this.recentlyOpenedList.value?.setEntries(workspacesWithID);
    }).catch(onUnexpectedError);
  }
  buildStartList() {
    const renderStartEntry = (entry) => $(
      "li",
      {},
      $(
        "button.button-link",
        {
          "x-dispatch": "selectStartEntry:" + entry.id,
          title: entry.description + " " + this.getKeybindingLabel(entry.command)
        },
        this.iconWidgetFor(entry),
        $("span", {}, entry.title)
      )
    );
    const startList = this.startList.value = new GettingStartedIndexList(
      {
        title: localize("start", "Start"),
        klass: "start-container",
        limit: 10,
        renderElement: renderStartEntry,
        rankElement: (e) => -e.order,
        contextService: this.contextService
      }
    );
    startList.setEntries(parsedStartEntries);
    startList.onDidChange(() => this.registerDispatchListeners());
    return startList;
  }
  buildGettingStartedWalkthroughsList() {
    const renderGetttingStaredWalkthrough = (category) => {
      const renderNewBadge = (category.newItems || category.newEntry) && !category.isFeatured;
      const newBadge = $(".new-badge", {});
      if (category.newEntry) {
        reset(newBadge, $(".new-category", {}, localize("new", "New")));
      } else if (category.newItems) {
        reset(newBadge, $(".new-items", {}, localize({ key: "newItems", comment: ["Shown when a list of items has changed based on an update from a remote source"] }, "Updated")));
      }
      const featuredBadge = $(".featured-badge", {});
      const descriptionContent = $(".description-content", {});
      if (category.isFeatured && this.showFeaturedWalkthrough) {
        reset(featuredBadge, $(".featured", {}, $("span.featured-icon.codicon.codicon-star-full")));
        reset(descriptionContent, ...renderLabelWithIcons(category.description));
      }
      const titleContent = $("h3.category-title.max-lines-3", { "x-category-title-for": category.id });
      reset(titleContent, ...renderLabelWithIcons(category.title));
      return $(
        "button.getting-started-category" + (category.isFeatured && this.showFeaturedWalkthrough ? ".featured" : ""),
        {
          "x-dispatch": "selectCategory:" + category.id,
          "title": category.description
        },
        featuredBadge,
        $(
          ".main-content",
          {},
          this.iconWidgetFor(category),
          titleContent,
          renderNewBadge ? newBadge : $(".no-badge"),
          $("a.codicon.codicon-close.hide-category-button", {
            "tabindex": 0,
            "x-dispatch": "hideCategory:" + category.id,
            "title": localize("close", "Hide"),
            "role": "button",
            "aria-label": localize("closeAriaLabel", "Hide")
          })
        ),
        descriptionContent,
        $(
          ".category-progress",
          { "x-data-category-id": category.id },
          $(
            ".progress-bar-outer",
            { "role": "progressbar" },
            $(".progress-bar-inner")
          )
        )
      );
    };
    const rankWalkthrough = (e) => {
      let rank = e.order;
      if (e.isFeatured) {
        rank += 7;
      }
      if (e.newEntry) {
        rank += 3;
      }
      if (e.newItems) {
        rank += 2;
      }
      if (e.recencyBonus) {
        rank += 4 * e.recencyBonus;
      }
      if (this.getHiddenCategories().has(e.id)) {
        rank = null;
      }
      return rank;
    };
    const gettingStartedList = this.gettingStartedList.value = new GettingStartedIndexList(
      {
        title: localize("walkthroughs", "Walkthroughs"),
        klass: "getting-started",
        limit: 5,
        footer: $("span.button-link.see-all-walkthroughs", { "x-dispatch": "seeAllWalkthroughs", "tabindex": 0 }, localize("showAll", "More...")),
        renderElement: renderGetttingStaredWalkthrough,
        rankElement: rankWalkthrough,
        contextService: this.contextService
      }
    );
    gettingStartedList.onDidChange(() => {
      const hidden = this.getHiddenCategories();
      const someWalkthroughsHidden = hidden.size || gettingStartedList.itemCount < this.gettingStartedCategories.filter((c) => this.contextService.contextMatchesRules(c.when)).length;
      this.container.classList.toggle("someWalkthroughsHidden", !!someWalkthroughsHidden);
      this.registerDispatchListeners();
      allWalkthroughsHiddenContext.bindTo(this.contextService).set(gettingStartedList.itemCount === 0);
      this.updateCategoryProgress();
    });
    gettingStartedList.setEntries(this.gettingStartedCategories);
    allWalkthroughsHiddenContext.bindTo(this.contextService).set(gettingStartedList.itemCount === 0);
    return gettingStartedList;
  }
  layout(size) {
    this.detailsScrollbar.value?.scanDomNode();
    this.categoriesPageScrollbar?.scanDomNode();
    this.detailsPageScrollbar?.scanDomNode();
    this.startList.value?.layout(size);
    this.gettingStartedList.value?.layout(size);
    this.recentlyOpenedList.value?.layout(size);
    if (this.editorInput?.selectedStep && this.currentMediaType) {
      this.mediaDisposables.clear();
      this.stepDisposables.clear();
      this.buildMediaComponent(this.editorInput.selectedStep);
    }
    this.layoutMarkdown?.();
    this.container.classList.toggle("height-constrained", size.height <= 600);
    this.container.classList.toggle("width-constrained", size.width <= 400);
    this.container.classList.toggle("width-semi-constrained", size.width <= 950);
    this.categoriesPageScrollbar?.scanDomNode();
    this.detailsPageScrollbar?.scanDomNode();
    this.detailsScrollbar.value?.scanDomNode();
  }
  updateCategoryProgress() {
    this.window.document.querySelectorAll(".category-progress").forEach((element) => {
      const categoryID = element.getAttribute("x-data-category-id");
      const category = this.gettingStartedCategories.find((c) => c.id === categoryID);
      if (!category) {
        return;
      }
      const stats = this.getWalkthroughCompletionStats(category);
      const bar = assertReturnsDefined(element.querySelector(".progress-bar-inner"));
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuenow", "" + stats.stepsComplete);
      bar.setAttribute("aria-valuemax", "" + stats.stepsTotal);
      const progress = stats.stepsComplete / stats.stepsTotal * 100;
      bar.style.width = `${progress}%`;
      element.parentElement.classList.toggle("no-progress", stats.stepsComplete === 0);
      if (stats.stepsTotal === stats.stepsComplete) {
        bar.title = localize("gettingStarted.allStepsComplete", "All {0} steps complete!", stats.stepsComplete);
      } else {
        bar.title = localize("gettingStarted.someStepsComplete", "{0} of {1} steps complete", stats.stepsComplete, stats.stepsTotal);
      }
    });
  }
  async scrollToCategory(categoryID, stepId) {
    if (!this.gettingStartedCategories.some((c) => c.id === categoryID)) {
      this.gettingStartedCategories = this.gettingStartedService.getWalkthroughs();
    }
    const ourCategory = this.gettingStartedCategories.find((c) => c.id === categoryID);
    if (!ourCategory) {
      throw Error("Could not find category with ID: " + categoryID);
    }
    this.inProgressScroll = this.inProgressScroll.then(async () => {
      if (!this.editorInput) {
        return;
      }
      reset(this.stepsContent);
      this.editorInput.selectedCategory = categoryID;
      this.editorInput.selectedStep = stepId;
      this.editorInput.walkthroughPageTitle = ourCategory.walkthroughPageTitle;
      this.currentWalkthrough = ourCategory;
      this.buildCategorySlide(categoryID, stepId);
      this.setSlide("details");
    });
  }
  iconWidgetFor(category) {
    const widget = category.icon.type === "icon" ? $(ThemeIcon.asCSSSelector(category.icon.icon)) : $("img.category-icon", { src: category.icon.path });
    widget.classList.add("icon-widget");
    return widget;
  }
  focusSideEditorGroup() {
    const fullSize = this.groupsService.getPart(this.group).contentDimension;
    if (!fullSize || fullSize.width <= 700 || this.container.classList.contains("width-constrained") || this.container.classList.contains("width-semi-constrained")) {
      return;
    }
    if (this.groupsService.count === 1) {
      const editorGroupSplitDirection = preferredSideBySideGroupDirection(this.configurationService);
      const sideGroup = this.groupsService.addGroup(this.groupsService.groups[0], editorGroupSplitDirection);
      this.groupsService.activateGroup(sideGroup);
    }
    const nonGettingStartedGroup = this.groupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find((group) => !(group.activeEditor instanceof GettingStartedInput));
    if (nonGettingStartedGroup) {
      this.groupsService.activateGroup(nonGettingStartedGroup);
      nonGettingStartedGroup.focus();
    }
  }
  runStepCommand(href) {
    const isCommand = href.startsWith("command:");
    const toSide = href.startsWith("command:toSide:");
    const command = href.replace(/command:(toSide:)?/, "command:");
    this.telemetryService.publicLog2("gettingStarted.ActionExecuted", { command: "runStepAction", argument: href, walkthroughId: this.currentWalkthrough?.id });
    if (toSide) {
      this.focusSideEditorGroup();
    }
    if (isCommand) {
      const commandURI = URI.parse(command);
      let args = [];
      try {
        args = parse(decodeURIComponent(commandURI.query));
      } catch {
        try {
          args = parse(commandURI.query);
        } catch {
        }
      }
      if (!Array.isArray(args)) {
        args = [args];
      }
      if ((commandURI.path === OpenFileFolderAction.ID.toString() || commandURI.path === OpenFolderAction.ID.toString()) && this.workspaceContextService.getWorkspace().folders.length === 0) {
        const selectedStepIndex = this.currentWalkthrough?.steps.findIndex((step) => step.id === this.editorInput?.selectedStep);
        if (selectedStepIndex !== void 0 && selectedStepIndex > -1 && this.currentWalkthrough?.steps.slice(selectedStepIndex + 1).some((step) => !step.done)) {
          const restoreData = { folder: UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, category: this.editorInput?.selectedCategory, step: this.editorInput?.selectedStep };
          this.storageService.store(
            restoreWalkthroughsConfigurationKey,
            JSON.stringify(restoreData),
            StorageScope.PROFILE,
            StorageTarget.MACHINE
          );
        }
      }
      this.commandService.executeCommand(commandURI.path, ...args).then((result) => {
        const toOpen = result?.openFolder;
        if (toOpen) {
          if (!URI.isUri(toOpen)) {
            console.warn("Warn: Running walkthrough command", href, "yielded non-URI `openFolder` result", toOpen, ". It will be disregarded.");
            return;
          }
          const restoreData = { folder: toOpen.toString(), category: this.editorInput?.selectedCategory, step: this.editorInput?.selectedStep };
          this.storageService.store(
            restoreWalkthroughsConfigurationKey,
            JSON.stringify(restoreData),
            StorageScope.PROFILE,
            StorageTarget.MACHINE
          );
          this.hostService.openWindow([{ folderUri: toOpen }]);
        }
      });
    } else {
      this.openerService.open(command, { allowCommands: true });
    }
    if (!isCommand && (href.startsWith("https://") || href.startsWith("http://"))) {
      this.gettingStartedService.progressByEvent("onLink:" + href);
    }
  }
  buildMarkdownDescription(container, text) {
    while (container.firstChild) {
      container.firstChild.remove();
    }
    for (const linkedText of text) {
      if (linkedText.nodes.length === 1 && typeof linkedText.nodes[0] !== "string") {
        const node = linkedText.nodes[0];
        const buttonContainer = append(container, $(".button-container"));
        const button = new Button(buttonContainer, { title: node.title, supportIcons: true, ...defaultButtonStyles });
        const isCommand = node.href.startsWith("command:");
        const command = node.href.replace(/command:(toSide:)?/, "command:");
        button.label = node.label;
        button.onDidClick((e) => {
          e.stopPropagation();
          e.preventDefault();
          this.runStepCommand(node.href);
        }, null, this.detailsPageDisposables);
        if (isCommand) {
          const keybinding = this.getKeyBinding(command);
          if (keybinding) {
            const shortcutMessage = $("span.shortcut-message", {}, localize("gettingStarted.keyboardTip", "Tip: Use keyboard shortcut "));
            container.appendChild(shortcutMessage);
            const label = new KeybindingLabel(shortcutMessage, OS, { ...defaultKeybindingLabelStyles });
            label.set(keybinding);
            this.detailsPageDisposables.add(label);
          }
        }
        this.detailsPageDisposables.add(button);
      } else {
        const p = append(container, $("p"));
        for (const node of linkedText.nodes) {
          if (typeof node === "string") {
            const labelWithIcon = renderLabelWithIcons(node);
            for (const element of labelWithIcon) {
              if (typeof element === "string") {
                p.appendChild(renderFormattedText(element, { renderCodeSegments: true }, $("span")));
              } else {
                p.appendChild(element);
              }
            }
          } else {
            const nodeWithTitle = matchesScheme(node.href, Schemas.http) || matchesScheme(node.href, Schemas.https) ? { ...node, title: node.href } : node;
            const link = this.instantiationService.createInstance(Link, p, nodeWithTitle, { opener: (href) => this.runStepCommand(href) });
            this.detailsPageDisposables.add(link);
          }
        }
      }
    }
    return container;
  }
  clearInput() {
    this.stepDisposables.clear();
    super.clearInput();
  }
  buildCategorySlide(categoryID, selectedStep, preserveFocus) {
    if (!this.editorInput) {
      return;
    }
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      this.extensionService.activateByEvent(`onWalkthrough:${categoryID.replace(/[^#]+#/, "")}`);
    });
    this.detailsPageDisposables.clear();
    this.mediaDisposables.clear();
    const category = this.gettingStartedCategories.find((category2) => category2.id === categoryID);
    if (!category) {
      throw Error("could not find category with ID " + categoryID);
    }
    const descriptionContainer = $(".category-description.description.max-lines-3", { "x-category-description-for": category.id });
    this.buildMarkdownDescription(descriptionContainer, parseDescription(category.description));
    const categoryDescriptorComponent = $(
      ".getting-started-category",
      {},
      $(
        ".category-description-container",
        {},
        $("h2.category-title.max-lines-3", { "x-category-title-for": category.id }, ...renderLabelWithIcons(category.title)),
        descriptionContainer
      )
    );
    const stepListContainer = $(".step-list-container");
    this.detailsPageDisposables.add(addDisposableListener(stepListContainer, "keydown", (e) => {
      const event = new StandardKeyboardEvent(e);
      const currentStepIndex = () => category.steps.findIndex((e2) => e2.id === this.editorInput?.selectedStep);
      if (event.keyCode === KeyCode.UpArrow) {
        const toExpand2 = category.steps.filter((step, index) => index < currentStepIndex() && this.contextService.contextMatchesRules(step.when));
        if (toExpand2.length) {
          this.selectStep(toExpand2[toExpand2.length - 1].id, false);
        }
      }
      if (event.keyCode === KeyCode.DownArrow) {
        const toExpand2 = category.steps.find((step, index) => index > currentStepIndex() && this.contextService.contextMatchesRules(step.when));
        if (toExpand2) {
          this.selectStep(toExpand2.id, false);
        }
      }
    }));
    let renderedSteps = void 0;
    const contextKeysToWatch = new Set(category.steps.flatMap((step) => step.when.keys()));
    const buildStepList = () => {
      category.steps.sort((a, b) => a.order - b.order);
      const toRender = category.steps.filter((step) => this.contextService.contextMatchesRules(step.when));
      if (equals(renderedSteps, toRender, (a, b) => a.id === b.id)) {
        return;
      }
      renderedSteps = toRender;
      reset(stepListContainer, ...renderedSteps.map((step) => {
        const codicon = $(
          ".codicon" + (step.done ? ".complete" + ThemeIcon.asCSSSelector(gettingStartedCheckedCodicon) : ThemeIcon.asCSSSelector(gettingStartedUncheckedCodicon)),
          {
            "data-done-step-id": step.id,
            "x-dispatch": "toggleStepCompletion:" + step.id,
            "role": "checkbox",
            "aria-checked": step.done ? "true" : "false",
            "aria-label": step.done ? localize("stepDone", "{0}: Completed", step.title) : localize("stepNotDone", "{0}: Not completed", step.title)
          }
        );
        const container = $(".step-description-container", { "x-step-description-for": step.id });
        this.buildMarkdownDescription(container, step.description);
        const stepTitle = $("h3.step-title.max-lines-3", { "x-step-title-for": step.id });
        reset(stepTitle, ...renderLabelWithIcons(step.title));
        const stepDescription = $(
          ".step-container",
          {},
          stepTitle,
          container
        );
        if (step.media.type === "image") {
          stepDescription.appendChild(
            $(".image-description", { "aria-label": localize("imageShowing", "Image showing {0}", step.media.altText) })
          );
        } else if (step.media.type === "video") {
          stepDescription.appendChild(
            $(".video-description", { "aria-label": localize("videoShowing", "Video showing {0}", step.media.altText) })
          );
        }
        return $(
          "button.getting-started-step",
          {
            "x-dispatch": "selectTask:" + step.id,
            "data-step-id": step.id,
            "aria-expanded": "false",
            "aria-checked": step.done ? "true" : "false",
            "role": "button"
          },
          codicon,
          stepDescription
        );
      }));
    };
    buildStepList();
    this.detailsPageDisposables.add(this.contextService.onDidChangeContext((e) => {
      if (e.affectsSome(contextKeysToWatch) && this.currentWalkthrough && this.editorInput) {
        buildStepList();
        this.registerDispatchListeners();
        this.selectStep(this.editorInput.selectedStep, false);
      }
    }));
    const showNextCategory = this.gettingStartedCategories.find((_category) => _category.id === category.next);
    const stepsContainer = $(
      ".getting-started-detail-container",
      { "role": "list" },
      stepListContainer,
      $(
        ".done-next-container",
        {},
        $("button.button-link.all-done", { "x-dispatch": "allDone" }, $("span.codicon.codicon-check-all"), localize("allDone", "Mark Done")),
        ...showNextCategory ? [$("button.button-link.next", { "x-dispatch": "nextSection" }, localize("nextOne", "Next Section"), $("span.codicon.codicon-arrow-right"))] : []
      )
    );
    this.detailsScrollbar.value = new DomScrollableElement(stepsContainer, { className: "steps-container" });
    const stepListComponent = this.detailsScrollbar.value.getDomNode();
    const categoryFooter = $(".getting-started-footer");
    if (this.editorInput.showTelemetryNotice && getTelemetryLevel(this.configurationService) !== TelemetryLevel.NONE && this.productService.enableTelemetry) {
      this.buildTelemetryFooter(categoryFooter);
    }
    reset(this.stepsContent, categoryDescriptorComponent, stepListComponent, this.stepMediaComponent, categoryFooter);
    const toExpand = category.steps.find((step) => this.contextService.contextMatchesRules(step.when) && !step.done) ?? category.steps[0];
    this.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus);
    this.detailsScrollbar.value?.scanDomNode();
    this.detailsPageScrollbar?.scanDomNode();
    this.registerDispatchListeners();
  }
  buildTelemetryFooter(parent) {
    const privacyStatementCopy = localize("privacy statement", "privacy statement");
    const privacyStatementButton = `[${privacyStatementCopy}](command:workbench.action.openPrivacyStatementUrl)`;
    const optOutCopy = localize("optOut", "opt out");
    const optOutButton = `[${optOutCopy}](command:settings.filterByTelemetry)`;
    const text = localize(
      { key: "footer", comment: ['fist substitution is "vs code", second is "privacy statement", third is "opt out".'] },
      "{0} collects usage data. Read our {1} and learn how to {2}.",
      this.productService.nameShort,
      privacyStatementButton,
      optOutButton
    );
    const renderedContents = this.detailsPageDisposables.add(this.markdownRendererService.render({ value: text, isTrusted: true }));
    parent.append(renderedContents.element);
  }
  getKeybindingLabel(command) {
    command = command.replace(/^command:/, "");
    const label = this.keybindingService.lookupKeybinding(command)?.getLabel();
    if (!label) {
      return "";
    } else {
      return `(${label})`;
    }
  }
  getKeyBinding(command) {
    command = command.replace(/^command:/, "");
    return this.keybindingService.lookupKeybinding(command);
  }
  async scrollPrev() {
    this.inProgressScroll = this.inProgressScroll.then(async () => {
      if (this.prevWalkthrough && this.prevWalkthrough !== this.currentWalkthrough) {
        this.currentWalkthrough = this.prevWalkthrough;
        this.prevWalkthrough = void 0;
        this.makeCategoryVisibleWhenAvailable(this.currentWalkthrough.id);
      } else if (this.editorInput?.returnToCommand) {
        this.commandService.executeCommand(this.editorInput.returnToCommand);
      } else {
        this.currentWalkthrough = void 0;
        if (this.editorInput) {
          this.editorInput.selectedCategory = void 0;
          this.editorInput.selectedStep = void 0;
          this.editorInput.showTelemetryNotice = false;
          this.editorInput.walkthroughPageTitle = void 0;
        }
        if (this.gettingStartedCategories.length !== this.gettingStartedList.value?.itemCount) {
          this.buildCategoriesSlide();
        }
        this.selectStep(void 0);
        this.setSlide("categories");
        this.container.focus();
      }
    });
  }
  runSkip() {
    this.commandService.executeCommand("workbench.action.closeActiveEditor");
  }
  escape() {
    if (this.editorInput?.selectedCategory) {
      this.scrollPrev();
    } else {
      this.runSkip();
    }
  }
  setSlide(toEnable, firstLaunch = false) {
    const slideManager = assertReturnsDefined(this.container.querySelector(".gettingStarted"));
    if (toEnable === "categories") {
      slideManager.classList.remove("showDetails");
      slideManager.classList.add("showCategories");
      this.container.querySelector(".prev-button.button-link").style.display = "none";
      this.container.querySelector(".gettingStartedSlideDetails").querySelectorAll("button").forEach((button) => button.disabled = true);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("button").forEach((button) => button.disabled = false);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("input").forEach((button) => button.disabled = false);
    } else {
      slideManager.classList.add("showDetails");
      slideManager.classList.remove("showCategories");
      const prevButton = this.container.querySelector(".prev-button.button-link");
      prevButton.style.display = this.editorInput?.showWelcome || this.editorInput?.returnToCommand || this.prevWalkthrough ? "block" : "none";
      const moreTextElement = prevButton.querySelector(".moreText");
      moreTextElement.textContent = firstLaunch ? localize("welcome", "Welcome") : localize("goBack", "Go Back");
      this.container.querySelector(".gettingStartedSlideDetails").querySelectorAll("button").forEach((button) => button.disabled = false);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("button").forEach((button) => button.disabled = true);
      this.container.querySelector(".gettingStartedSlideCategories").querySelectorAll("input").forEach((button) => button.disabled = true);
    }
  }
  focus() {
    super.focus();
    const active = this.container.ownerDocument.activeElement;
    let parent = this.container.parentElement;
    while (parent && parent !== active) {
      parent = parent.parentElement;
    }
    if (parent) {
      this.container.focus();
    }
  }
};
GettingStartedPage = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IWalkthroughsService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, IWorkbenchThemeService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IExtensionService),
  __decorateParam(13, IInstantiationService),
  __decorateParam(14, INotificationService),
  __decorateParam(15, IEditorGroupsService),
  __decorateParam(16, IContextKeyService),
  __decorateParam(17, IQuickInputService),
  __decorateParam(18, IWorkspacesService),
  __decorateParam(19, ILabelService),
  __decorateParam(20, IHostService),
  __decorateParam(21, IWebviewService),
  __decorateParam(22, IWorkspaceContextService),
  __decorateParam(23, IAccessibilityService),
  __decorateParam(24, IMarkdownRendererService),
  __decorateParam(25, IChatEntitlementService)
], GettingStartedPage);
class GettingStartedInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    return JSON.stringify({ selectedCategory: editorInput.selectedCategory, selectedStep: editorInput.selectedStep });
  }
  deserialize(instantiationService, serializedEditorInput) {
    return instantiationService.invokeFunction((accessor) => {
      try {
        const { selectedCategory, selectedStep } = JSON.parse(serializedEditorInput);
        return new GettingStartedInput({ selectedCategory, selectedStep });
      } catch {
      }
      return new GettingStartedInput({});
    });
  }
}
export {
  GettingStartedInputSerializer,
  GettingStartedPage,
  allWalkthroughsHiddenContext,
  inWelcomeContext
};
