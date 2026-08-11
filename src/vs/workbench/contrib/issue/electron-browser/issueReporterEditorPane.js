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
import "../browser/media/issueReporterOverlay.css";
import { $, append, clearNode } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { EditorActivation } from "../../../../platform/editor/common/editor.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-browser/environmentService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { decodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { URI } from "../../../../base/common/uri.js";
import { FileAccess } from "../../../../base/common/network.js";
import { IssueReporterOverlay } from "../browser/issueReporterOverlay.js";
import { IRecordingService, RecordingState } from "../browser/recordingService.js";
import { IScreenshotService } from "../browser/screenshotService.js";
import { IIssueFormService } from "../common/issue.js";
import { IProcessService } from "../../../../platform/process/common/process.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import product from "../../../../platform/product/common/product.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { ChatMessageRole, ILanguageModelsService, getTextResponseFromStream } from "../../chat/common/languageModels.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { isMacintosh } from "../../../../base/common/platform.js";
const IssueReporterOpenContext = new RawContextKey("issueReporterOpen", false);
let IssueReporterEditorPane = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, recordingService, screenshotService, logService, fileService, environmentService, editorService, issueFormService, processService, experimentService, contextMenuService, contextViewService, markdownRendererService, languageModelsService, notificationService, openerService, updateService, keybindingService, editorGroupsService, extensionService, configurationService) {
    super(IssueReporterEditorPane.ID, group, telemetryService, themeService, storageService);
    this.recordingService = recordingService;
    this.screenshotService = screenshotService;
    this.logService = logService;
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.editorService = editorService;
    this.issueFormService = issueFormService;
    this.processService = processService;
    this.experimentService = experimentService;
    this.contextMenuService = contextMenuService;
    this.contextViewService = contextViewService;
    this.markdownRendererService = markdownRendererService;
    this.languageModelsService = languageModelsService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.updateService = updateService;
    this.keybindingService = keybindingService;
    this.editorGroupsService = editorGroupsService;
    this.extensionService = extensionService;
    this.configurationService = configurationService;
    this.inputDisposables = this._register(new DisposableStore());
    IssueReporterEditorPane.liveInstances.add(this);
    this._register({ dispose: () => IssueReporterEditorPane.liveInstances.delete(this) });
  }
  static {
    this.ID = "workbench.editor.issueReporter";
  }
  static {
    /**
     * Live registry of issue reporter panes so commands can target the wizard
     * even when its tab is not the active editor in its group.
     * (IEditorService.visibleEditorPanes only exposes the active pane per group.)
     */
    this.liveInstances = /* @__PURE__ */ new Set();
  }
  static getAnyLiveInstance() {
    for (const inst of IssueReporterEditorPane.liveInstances) {
      if (inst.wizard) {
        return inst;
      }
    }
    return void 0;
  }
  getWizard() {
    return this.wizard;
  }
  /**
   * Bring this pane's tab to the front of its group and activate that group
   * so the wizard receives keyboard focus.
   */
  async revealAndActivate() {
    const input = this.wizardInput;
    if (!input) {
      return;
    }
    this.editorGroupsService.activateGroup(this.group);
    await this.editorService.openEditor(input, { activation: EditorActivation.ACTIVATE }, this.group);
  }
  createEditor(parent) {
    this.container = append(parent, $("div.issue-reporter-editor-tab"));
    this.container.style.height = "100%";
    this.container.style.overflow = "auto";
  }
  shouldShowUpdateBanner() {
    return this.updateService.state.type === StateType.AvailableForDownload || this.updateService.state.type === StateType.Ready || this.updateService.state.type === StateType.Downloaded;
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (token.isCancellationRequested || !this.container) {
      return;
    }
    this.wizardInput = input;
    if (this.wizard && this.container.contains(this.wizard.getPanel())) {
      this.wizard.reparentFloatingBar();
      this.wizard.showFloatingBar();
      this.wizard.setUpdateAvailable(this.shouldShowUpdateBanner());
      this.restoreAttachmentsFromInput(input);
      return;
    }
    this.inputDisposables.clear();
    clearNode(this.container);
    const data = input.data;
    if (!data) {
      const msg = append(this.container, $("p"));
      msg.textContent = localize("noData", "No issue reporter data available.");
      return;
    }
    this.wizard = new IssueReporterOverlay(
      data,
      this.recordingService.isSupported,
      this.container,
      this.contextViewService,
      this.contextMenuService,
      this.markdownRendererService,
      true,
      (extensionId) => this.issueFormService.sendReporterMenu(extensionId),
      async (url) => {
        await this.openerService.open(URI.parse(url), { openExternal: true });
      },
      this.shouldShowUpdateBanner(),
      () => this.refreshPerformanceInfo(),
      (commandId) => this.keybindingService.lookupKeybinding(commandId)
    );
    this.inputDisposables.add(this.wizard);
    this.inputDisposables.add(this.updateService.onStateChange(() => this.wizard?.setUpdateAvailable(this.shouldShowUpdateBanner())));
    input.hasUserInputFn = () => this.wizard?.hasUnsavedChanges() ?? false;
    this.inputDisposables.add(this.wizard.onDidClose(() => {
      input.hasUserInputFn = void 0;
      this.group.closeEditor(this.input);
    }));
    this.inputDisposables.add(input.onWillDispose(() => {
      this.destroyWizard();
    }));
    this.wizard.show();
    this.restoreAttachmentsFromInput(input);
    this.inputDisposables.add(this.wizard.onDidChangeAttachments(() => {
      input.savedScreenshots = this.wizard?.getScreenshots().slice();
      input.savedRecordings = this.wizard?.getRecordings().slice();
    }));
    void this.populateSystemInfo();
    this.inputDisposables.add(this.wizard.onDidRequestScreenshot(async () => {
      try {
        const shouldHide = this.wizard?.shouldHideToolbarForCapture ?? true;
        if (shouldHide) {
          this.wizard?.hideFloatingBar();
          await new Promise((r) => setTimeout(r, 100));
        }
        const dataUrl = await this.screenshotService.captureScreenshot();
        if (shouldHide) {
          setTimeout(() => this.wizard?.showFloatingBar(), 1e3);
        }
        if (!dataUrl || !this.wizard) {
          return;
        }
        const img = await new Promise((resolve, reject) => {
          const image = mainWindow.document.createElement("img");
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = dataUrl;
        });
        this.wizard.addScreenshot({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
        await this.revealAndActivate();
      } catch (err) {
        setTimeout(() => this.wizard?.showFloatingBar(), 1e3);
        this.logService.error("[IssueReporterEditorPane] Screenshot failed:", err);
      }
    }));
    this.inputDisposables.add(this.wizard.onDidRequestStartRecording(async () => {
      const permissionState = await this.recordingService.getScreenCapturePermissionStatus();
      if (permissionState === "denied" || permissionState === "restricted") {
        this.showScreenRecordingPermissionNotification();
        this.wizard?.setRecordingState(RecordingState.Idle);
        return;
      }
      try {
        await this.recordingService.startRecording("video/mp4");
        this.wizard?.setRecordingState(RecordingState.Recording);
      } catch (err) {
        this.logService.error("[IssueReporterEditorPane] Recording failed:", err);
        this.wizard?.setRecordingState(RecordingState.Idle);
        const postState = await this.recordingService.getScreenCapturePermissionStatus();
        if (postState === "denied" || postState === "restricted") {
          this.showScreenRecordingPermissionNotification();
        }
      }
    }));
    this.inputDisposables.add(this.wizard.onDidRequestStopRecording(async () => {
      try {
        const recordingData = await this.recordingService.stopRecording();
        if (recordingData) {
          await this.saveRecordingAndAdd(recordingData);
        }
        this.wizard?.setRecordingState(RecordingState.Idle);
      } catch (err) {
        this.logService.error("[IssueReporterEditorPane] Stop recording failed:", err);
        this.wizard?.setRecordingState(RecordingState.Idle);
      }
    }));
    this.inputDisposables.add(this.recordingService.onDidChangeState(async (state) => {
      if (state === RecordingState.Stopped && this.wizard?.recordingState === RecordingState.Recording) {
        try {
          const recordingData = await this.recordingService.stopRecording();
          if (recordingData) {
            await this.saveRecordingAndAdd(recordingData);
            if (recordingData.stoppedBySize) {
              this.notificationService.notify({
                severity: Severity.Warning,
                message: localize("recordingTooLarge", "Recording stopped automatically: the 100 MB upload limit was reached.")
              });
            }
          }
        } catch (err) {
          this.logService.error("[IssueReporterEditorPane] Auto-stop recording failed:", err);
        }
        this.wizard?.setRecordingState(RecordingState.Idle);
      }
    }));
    this.inputDisposables.add(this.wizard.onDidRequestOpenScreenshot(async (screenshot) => {
      try {
        const dataUrl = screenshot.annotatedDataUrl ?? screenshot.dataUrl;
        const commaIndex = dataUrl.indexOf(",");
        if (commaIndex === -1) {
          return;
        }
        const extension = dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
        const folder = URI.joinPath(this.environmentService.tmpDir, "issue-screenshots");
        const target = URI.joinPath(folder, `screenshot-${Date.now()}.${extension}`);
        await this.fileService.createFolder(folder);
        await this.fileService.writeFile(target, decodeBase64(dataUrl.substring(commaIndex + 1)));
        await this.editorService.openEditor({ resource: target });
      } catch (err) {
        this.logService.error("[IssueReporterEditorPane] Open screenshot failed:", err);
      }
    }));
    this.inputDisposables.add(this.wizard.onDidRequestOpenRecording(async (filePath) => {
      try {
        await this.editorService.openEditor({ resource: URI.file(filePath) });
      } catch (err) {
        this.logService.error("[IssueReporterEditorPane] Open recording failed:", err);
      }
    }));
    this.inputDisposables.add(this.wizard.onDidSubmit(async ({ title, body }) => {
      if (!this.wizard) {
        return;
      }
      const opened = await this.issueFormService.submitIssue(this.wizard, data, title, body);
      if (opened) {
        this.wizard.markPreviewOpened();
        this.wizard.showCloseButton();
      }
    }));
    this.inputDisposables.add(this.wizard.onDidRequestGenerateTitle(async (description) => {
      try {
        await this.extensionService.whenInstalledExtensionsRegistered();
        const modelIds = await this.languageModelsService.selectLanguageModels({ vendor: "copilot", id: "copilot-utility-small" });
        if (modelIds.length === 0) {
          this.logService.warn("[IssueReporterEditorPane] No language models available for title generation");
          this.wizard?.resetGenerateButton();
          return;
        }
        const modelId = modelIds[0];
        const response = await this.languageModelsService.sendChatRequest(
          modelId,
          void 0,
          [{
            role: ChatMessageRole.User,
            content: [{
              type: "text",
              value: `Generate a concise issue title (max 10 words, no quotes, no prefix like "Bug:" or "Feature:") for this bug report description:

${description}`
            }]
          }],
          {},
          CancellationToken.None
        );
        const title = (await getTextResponseFromStream(response)).trim().replace(/^["']|["']$/g, "");
        if (title && this.wizard) {
          this.wizard.setGeneratedTitle(title);
        } else {
          this.wizard?.resetGenerateButton();
        }
      } catch (err) {
        this.logService.error("[IssueReporterEditorPane] Title generation failed:", err);
        this.wizard?.resetGenerateButton();
      }
    }));
  }
  async fetchPerformanceInfo(options) {
    if (!this.wizard) {
      return;
    }
    try {
      const performanceInfo = await this.processService.getPerformanceInfo(options);
      this.wizard.updateModel({
        processInfo: performanceInfo.processInfo,
        workspaceInfo: performanceInfo.workspaceInfo
      });
    } catch (err) {
      this.logService.error("[IssueReporterEditorPane] Failed to fetch performance info:", err);
    } finally {
      this.wizard?.markPerformanceInfoLoaded();
    }
  }
  async refreshPerformanceInfo() {
    await this.fetchPerformanceInfo({ skipCache: true, unbounded: true });
  }
  async populateSystemInfo() {
    if (!this.wizard) {
      return;
    }
    const input = this.input;
    const data = input?.data;
    try {
      const vscodeVersion = `${product.nameShort} ${!!product.darwinUniversalAssetId ? `${product.version} (Universal)` : product.version} (${product.commit || "Commit unknown"}, ${product.date || "Date unknown"})`;
      const systemInfo = await this.processService.getSystemInfo();
      this.wizard.updateModel({
        versionInfo: { vscodeVersion, os: systemInfo.os },
        systemInfo,
        systemInfoWeb: navigator.userAgent
      });
      const fullScan = this.configurationService.getValue("issueReporter.wizard.fullWorkspaceScan") !== false;
      await this.fetchPerformanceInfo({ unbounded: fullScan });
    } catch (err) {
      this.logService.error("[IssueReporterEditorPane] Failed to collect system info:", err);
      this.wizard?.markPerformanceInfoLoaded();
    }
    try {
      const experiments = await this.experimentService.getCurrentExperiments();
      this.wizard?.updateModel({ experimentInfo: experiments?.join("\n") ?? localize("noExperiments", "No current experiments.") });
    } catch {
    }
    await data?.whenExtensionsLoaded;
    if (data && data.enabledExtensions.length > 0) {
      const nonTheme = data.enabledExtensions.filter((e) => !e.isTheme && !e.isBuiltin);
      const themeCount = data.enabledExtensions.filter((e) => e.isTheme).length;
      this.wizard?.updateModel({
        allExtensions: data.enabledExtensions,
        enabledNonThemeExtesions: nonTheme,
        numberOfThemeExtesions: themeCount
      });
    }
    await data?.whenDataComplete;
    if (data) {
      this.wizard?.updateModel({
        isInstallationPure: data.isInstallationPure
      });
    }
  }
  restoreAttachmentsFromInput(input) {
    if (!this.wizard) {
      return;
    }
    if (input.savedScreenshots?.length || input.savedRecordings?.length) {
      this.wizard.restoreAttachments(input.savedScreenshots ?? [], input.savedRecordings ?? []);
    }
  }
  destroyWizard() {
    if (this.recordingService.state === RecordingState.Recording) {
      this.recordingService.discardRecording();
    }
    this.inputDisposables.clear();
    this.wizard = void 0;
    this.wizardInput = void 0;
    if (this.container) {
      clearNode(this.container);
    }
  }
  /**
   * Surface a notification telling the user how to grant Screen Recording
   * permission. On macOS, includes a deep-link to System Settings.
   */
  showScreenRecordingPermissionNotification() {
    if (isMacintosh) {
      this.notificationService.prompt(
        Severity.Warning,
        localize("screenRecordingPermissionDenied", "{0} needs Screen Recording permission to record videos. Grant access in System Settings, then click Record again.", product.nameShort),
        [
          {
            label: localize("openSystemSettings", "Open System Settings"),
            run: () => {
              this.recordingService.openScreenCapturePermissionSettings();
            }
          }
        ]
      );
    } else {
      this.notificationService.warn(
        localize("screenRecordingPermissionDeniedGeneric", "Screen recording permission was denied. Allow {0} to record the screen and try again.", product.nameShort)
      );
    }
  }
  focus() {
    super.focus();
    this.wizard?.focus();
  }
  async saveRecordingAndAdd(data) {
    try {
      const extension = data.mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const fileName = `vscode-recording-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.${extension}`;
      const folder = URI.joinPath(this.environmentService.tmpDir, "issue-recordings");
      const target = URI.joinPath(folder, fileName);
      const arrayBuffer = await data.blob.arrayBuffer();
      await this.fileService.createFolder(folder);
      await this.fileService.writeFile(target, VSBuffer.wrap(new Uint8Array(arrayBuffer)));
      this.logService.info(`[IssueReporterEditorPane] Recording saved to ${target.toString()}`);
      const thumbnailDataUrl = await this.generateVideoThumbnail(target);
      this.wizard?.addRecording(target.fsPath, data.durationMs, thumbnailDataUrl);
    } catch (err) {
      this.logService.error("[IssueReporterEditorPane] Failed to save recording:", err);
    }
  }
  generateVideoThumbnail(fileUri) {
    const browserUri = FileAccess.uriToBrowserUri(URI.file(fileUri.fsPath));
    return new Promise((resolve) => {
      const video = mainWindow.document.createElement("video");
      const timeout = setTimeout(() => finish(void 0), 5e3);
      let resolved = false;
      const finish = (result) => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(timeout);
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
        resolve(result);
      };
      const captureFrame = () => {
        try {
          if (!video.videoWidth || !video.videoHeight) {
            finish(void 0);
            return;
          }
          const canvas = mainWindow.document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            finish(void 0);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          finish(void 0);
        }
      };
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:320px;height:240px;opacity:0;pointer-events:none;";
      mainWindow.document.body.appendChild(video);
      video.src = browserUri.toString(true);
      video.addEventListener("loadeddata", () => {
        video.pause();
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (duration > 0.5) {
          video.addEventListener("seeked", () => captureFrame(), { once: true });
          try {
            video.currentTime = Math.min(0.5, duration / 2);
          } catch {
            captureFrame();
          }
          return;
        }
        captureFrame();
      }, { once: true });
      video.addEventListener("error", () => finish(void 0), { once: true });
      video.load();
    });
  }
  layout(dimension) {
    if (this.container) {
      this.container.style.width = `${dimension.width}px`;
      this.container.style.height = `${dimension.height}px`;
    }
  }
};
IssueReporterEditorPane = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IRecordingService),
  __decorateParam(5, IScreenshotService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IFileService),
  __decorateParam(8, INativeWorkbenchEnvironmentService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IIssueFormService),
  __decorateParam(11, IProcessService),
  __decorateParam(12, IWorkbenchAssignmentService),
  __decorateParam(13, IContextMenuService),
  __decorateParam(14, IContextViewService),
  __decorateParam(15, IMarkdownRendererService),
  __decorateParam(16, ILanguageModelsService),
  __decorateParam(17, INotificationService),
  __decorateParam(18, IOpenerService),
  __decorateParam(19, IUpdateService),
  __decorateParam(20, IKeybindingService),
  __decorateParam(21, IEditorGroupsService),
  __decorateParam(22, IExtensionService),
  __decorateParam(23, IConfigurationService)
], IssueReporterEditorPane);
export {
  IssueReporterEditorPane,
  IssueReporterOpenContext
};
