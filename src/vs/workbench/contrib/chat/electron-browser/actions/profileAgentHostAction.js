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
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { getErrorMessage } from "../../../../../base/common/errors.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from "../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IAgentHostService } from "../../../../../platform/agentHost/common/agentService.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IV8InspectProfilingService, Utils } from "../../../../../platform/profiling/common/profiling.js";
import { IsSessionsWindowContext } from "../../../../common/contextkeys.js";
import { IStatusbarService, StatusbarAlignment } from "../../../../services/statusbar/browser/statusbar.js";
import { IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
var AgentHostProfileState = /* @__PURE__ */ ((AgentHostProfileState2) => {
  AgentHostProfileState2["None"] = "none";
  AgentHostProfileState2["Starting"] = "starting";
  AgentHostProfileState2["Running"] = "running";
  AgentHostProfileState2["Stopping"] = "stopping";
  return AgentHostProfileState2;
})(AgentHostProfileState || {});
const CONTEXT_AGENT_HOST_PROFILE_STATE = new RawContextKey("agentHostProfileState", "none" /* None */);
const IAgentHostProfileService = createDecorator("agentHostProfileService");
let AgentHostProfileService = class extends Disposable {
  constructor(agentHostService, profilingService, contextKeyService, statusbarService, fileDialogService, fileService, editorService, environmentService, notificationService, logService) {
    super();
    this.agentHostService = agentHostService;
    this.profilingService = profilingService;
    this.contextKeyService = contextKeyService;
    this.statusbarService = statusbarService;
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
    this.editorService = editorService;
    this.environmentService = environmentService;
    this.notificationService = notificationService;
    this.logService = logService;
    this.statusbarEntry = this._register(new MutableDisposable());
    this.profilingNotification = this._register(new MutableDisposable());
    this.isDisposed = false;
    this.profileState = CONTEXT_AGENT_HOST_PROFILE_STATE.bindTo(contextKeyService);
    this._register(toDisposable(() => {
      this.isDisposed = true;
      const sessionId = this.sessionId;
      this.sessionId = void 0;
      this.profileState.set("none" /* None */);
      if (sessionId) {
        void this.profilingService.stopProfiling(sessionId).catch((error) => {
          this.logService.error("Failed to stop the agent host profiling session during disposal", error);
        });
      }
    }));
  }
  startProfiling() {
    if (this.startPromise) {
      return this.startPromise;
    }
    if (this.sessionId) {
      return Promise.resolve();
    }
    this.profileState.set("starting" /* Starting */);
    this.startPromise = this.doStartProfiling().finally(() => this.startPromise = void 0);
    return this.startPromise;
  }
  async doStartProfiling() {
    try {
      const inspectInfo = await this.agentHostService.getInspectInfo(true);
      if (this.isDisposed) {
        return;
      }
      if (!inspectInfo) {
        this.notificationService.warn(localize("profileAgentHost.noInspectPort", "Could not enable the Node.js inspector for the agent host process."));
        this.profileState.set("none" /* None */);
        return;
      }
      const sessionId = await this.profilingService.startProfiling({ host: inspectInfo.host, port: inspectInfo.port });
      if (this.isDisposed) {
        try {
          await this.profilingService.stopProfiling(sessionId);
        } catch (error) {
          this.logService.error("Failed to stop the agent host profiling session during disposal", error);
        }
        return;
      }
      this.sessionId = sessionId;
      this.profileState.set("running" /* Running */);
      this.statusbarEntry.value = this.statusbarService.addEntry({
        name: localize("profileAgentHost.statusName", "Agent Host Profiler"),
        text: localize("profileAgentHost.statusText", "Profiling Agent Host"),
        ariaLabel: localize("profileAgentHost.statusAriaLabel", "Profiling Agent Host. Activate to stop profiling."),
        tooltip: localize("profileAgentHost.statusTooltip", "Click to stop profiling."),
        command: StopAgentHostProfileAction.ID,
        showProgress: true
      }, "status.agentHostProfiler", StatusbarAlignment.RIGHT);
      if (this.contextKeyService.contextMatchesRules(IsSessionsWindowContext)) {
        const handle = this.notificationService.prompt(
          Severity.Info,
          localize("profileAgentHost.notification", "Profiling the local agent host process."),
          [{
            label: localize("profileAgentHost.stop", "Stop"),
            run: () => void this.stopProfiling()
          }],
          {
            sticky: true,
            onCancel: () => void this.stopProfiling()
          }
        );
        this.profilingNotification.value = toDisposable(() => handle.close());
      }
    } catch (error) {
      const sessionId = this.sessionId;
      this.sessionId = void 0;
      this.statusbarEntry.clear();
      this.profilingNotification.clear();
      if (sessionId) {
        try {
          await this.profilingService.stopProfiling(sessionId);
        } catch (stopError) {
          this.logService.error("Failed to clean up the agent host profiling session", stopError);
        }
      }
      if (this.isDisposed) {
        this.logService.error("Failed to start profiling the agent host during disposal", error);
        return;
      }
      this.profileState.set("none" /* None */);
      this.notificationService.error(localize("profileAgentHost.startFailed", "Failed to start profiling the agent host: {0}", getErrorMessage(error)));
    }
  }
  async stopProfiling() {
    const sessionId = this.sessionId;
    if (!sessionId) {
      return;
    }
    this.sessionId = void 0;
    this.profileState.set("stopping" /* Stopping */);
    this.statusbarEntry.clear();
    this.profilingNotification.clear();
    let profile;
    try {
      profile = await this.profilingService.stopProfiling(sessionId);
    } catch (error) {
      this.profileState.set("none" /* None */);
      this.notificationService.error(localize("profileAgentHost.stopFailed", "Failed to stop profiling the agent host: {0}", getErrorMessage(error)));
      return;
    }
    if (this.isDisposed) {
      return;
    }
    try {
      const profileUri = await this.saveProfile(profile);
      if (profileUri) {
        const editor = {
          resource: profileUri,
          options: {
            revealIfOpened: true,
            override: "jsProfileVisualizer.cpuprofile.table"
          }
        };
        if (this.contextKeyService.contextMatchesRules(IsSessionsWindowContext)) {
          await this.editorService.openEditor(editor);
        } else {
          await this.editorService.openEditor(editor, SIDE_GROUP);
        }
      }
    } catch (error) {
      this.notificationService.error(localize("profileAgentHost.saveFailed", "Failed to save or open the agent host profile: {0}", getErrorMessage(error)));
    } finally {
      this.profileState.set("none" /* None */);
    }
  }
  async saveProfile(profile) {
    let profileUri = await this.fileDialogService.showSaveDialog({
      title: localize("profileAgentHost.saveDialogTitle", "Save Agent Host Profile"),
      availableFileSystems: [Schemas.file],
      defaultUri: joinPath(await this.fileDialogService.defaultFilePath(), `AgentHost-CPU-${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "")}.cpuprofile`),
      filters: [{
        name: localize("profileAgentHost.cpuProfiles", "CPU Profiles"),
        extensions: ["cpuprofile", "txt"]
      }]
    });
    if (!profileUri) {
      return void 0;
    }
    let dataToWrite = profile;
    if (this.environmentService.isBuilt) {
      dataToWrite = Utils.rewriteAbsolutePaths(dataToWrite, "piiRemoved");
      profileUri = URI.file(`${profileUri.fsPath}.txt`);
    }
    await this.fileService.writeFile(profileUri, VSBuffer.fromString(JSON.stringify(dataToWrite, void 0, "	")));
    return profileUri;
  }
};
AgentHostProfileService = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IV8InspectProfilingService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IStatusbarService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IWorkbenchEnvironmentService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, ILogService)
], AgentHostProfileService);
class ProfileAgentHostAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.profileAgentHost";
  }
  constructor() {
    super({
      id: ProfileAgentHostAction.ID,
      title: localize2("profileAgentHost", "Profile Local Agent Host Process"),
      category: Categories.Developer,
      f1: true,
      icon: Codicon.circleFilled,
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.or(
          IsSessionsWindowContext,
          ContextKeyExpr.and(
            ChatContextKeys.enabled,
            AGENT_HOST_ENABLED_CONTEXT_KEY
          )
        ),
        CONTEXT_AGENT_HOST_PROFILE_STATE.notEqualsTo("starting" /* Starting */),
        CONTEXT_AGENT_HOST_PROFILE_STATE.notEqualsTo("running" /* Running */),
        CONTEXT_AGENT_HOST_PROFILE_STATE.notEqualsTo("stopping" /* Stopping */)
      )
    });
  }
  run(accessor) {
    return accessor.get(IAgentHostProfileService).startProfiling();
  }
}
class StopAgentHostProfileAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.stopAgentHostProfile";
  }
  constructor() {
    super({
      id: StopAgentHostProfileAction.ID,
      title: localize2("stopAgentHostProfile", "Stop Local Agent Host Profile"),
      category: Categories.Developer,
      f1: true,
      icon: Codicon.debugStop,
      precondition: CONTEXT_AGENT_HOST_PROFILE_STATE.isEqualTo("running" /* Running */)
    });
  }
  run(accessor) {
    return accessor.get(IAgentHostProfileService).stopProfiling();
  }
}
registerSingleton(IAgentHostProfileService, AgentHostProfileService, InstantiationType.Delayed);
export {
  ProfileAgentHostAction,
  StopAgentHostProfileAction
};
