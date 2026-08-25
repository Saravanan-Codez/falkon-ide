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
import { VSBuffer, streamToBuffer } from "../../../../../base/common/buffer.js";
import { Schemas } from "../../../../../base/common/network.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { hasKey } from "../../../../../base/common/types.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2 } from "../../../../../platform/actions/common/actions.js";
import { agentHostAuthority } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from "../../../../../platform/agentHost/common/agentHostEnablementService.js";
import { IAgentHostService } from "../../../../../platform/agentHost/common/agentService.js";
import { IRemoteAgentHostService, remoteAgentHostLogOutputChannelId, AGENT_HOST_LOG_OUTPUT_CHANNEL_ID } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsWebContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { IChatEntitlementService } from "../../../../services/chat/common/chatEntitlementService.js";
import { IOutputService } from "../../../../services/output/common/output.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { IChatWidgetService } from "../chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { buildLocalCopilotLogsUri, buildRemoteCopilotLogsUri, COPILOT_CLI_LOCAL_AH_SCHEME, getCopilotCliSessionRawId, parseRemoteAuthorityFromScheme, resolveEventsUri } from "../copilotCliEventsUri.js";
import { findRelevantCopilotLogs, getRemoteConnectionForSession, readRemoteAgentHostLog, sanitizeFilePart } from "../chatDebug/agentHostLogSources.js";
import { buildAgentHostCustomizationsUri, buildAgentHostUsageUri } from "../chatDebug/agentHostUsageSidecar.js";
const AGENT_HOST_LOGGER_CHANNEL_ID = AGENT_HOST_LOG_OUTPUT_CHANNEL_ID;
const WINDOW_LOG_CHANNEL_ID = "rendererLog";
const SHARED_PROCESS_LOG_CHANNEL_ID = "shared";
const MAX_REMOTE_COPILOT_LOG_EXPORT_SIZE = 10 * 1024 * 1024;
const IAgentHostDebugLogsExportService = createDecorator("agentHostDebugLogsExportService");
let BrowserAgentHostDebugLogsExportService = class {
  constructor(fileDialogService, fileService) {
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
  }
  async save(exportName, files) {
    return exportFilesToLocalFolder(this.fileDialogService, this.fileService, exportName, files);
  }
};
BrowserAgentHostDebugLogsExportService = __decorateClass([
  __decorateParam(0, IFileDialogService),
  __decorateParam(1, IFileService)
], BrowserAgentHostDebugLogsExportService);
async function collectAgentHostDebugLogs(accessor, activeSession) {
  const pathService = accessor.get(IPathService);
  const agentHostService = accessor.get(IAgentHostService);
  const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
  const outputService = accessor.get(IOutputService);
  const fileService = accessor.get(IFileService);
  const notificationService = accessor.get(INotificationService);
  const textModelService = accessor.get(ITextModelService);
  const productService = accessor.get(IProductService);
  const logService = accessor.get(ILogService);
  const environmentService = accessor.get(IEnvironmentService);
  const userHome = pathService.userHome({ preferLocal: true });
  const eventsResult = resolveEventsUri(
    activeSession?.resource,
    userHome,
    (authority) => remoteAgentHostService.connections.find((c) => agentHostAuthority(c.address) === authority)
  );
  const channelIds = /* @__PURE__ */ new Set();
  let remoteConnection;
  let ahpLogNameFilter;
  if (activeSession) {
    if (activeSession.isLocal) {
      channelIds.add(AGENT_HOST_LOGGER_CHANNEL_ID);
      const localClientId = sanitizeFilePart(agentHostService.clientId);
      ahpLogNameFilter = (name) => name.includes(localClientId);
    } else {
      remoteConnection = getRemoteConnectionForSession(activeSession.resource, remoteAgentHostService.connections);
      if (remoteConnection) {
        channelIds.add(remoteAgentHostLogOutputChannelId(remoteConnection.address));
      }
    }
  } else {
    channelIds.add(AGENT_HOST_LOGGER_CHANNEL_ID);
    for (const connection of remoteAgentHostService.connections) {
      channelIds.add(remoteAgentHostLogOutputChannelId(connection.address));
    }
  }
  channelIds.add(WINDOW_LOG_CHANNEL_ID);
  channelIds.add(SHARED_PROCESS_LOG_CHANNEL_ID);
  const files = [];
  if (eventsResult.kind === "ok") {
    try {
      files.push(await createDebugLogFile("events.jsonl", eventsResult.resource, fileService));
    } catch {
    }
  }
  for (const channelId of channelIds) {
    const channel = outputService.getChannel(channelId);
    const descriptor = outputService.getChannelDescriptor(channelId);
    if (!channel || !descriptor) {
      continue;
    }
    const modelRef = await textModelService.createModelReference(channel.uri);
    try {
      const filename = `${descriptor.label.replace(/[/\\:*?"<>|]/g, "-")}.log`;
      files.push({ path: filename, contents: modelRef.object.textEditorModel.getValue() });
    } finally {
      modelRef.dispose();
    }
  }
  try {
    const ahpDir = joinPath(environmentService.logsHome, "ahp");
    const stat = await fileService.resolve(ahpDir, { resolveMetadata: true });
    for (const child of stat.children ?? []) {
      if (child.isDirectory || !child.name.endsWith(".jsonl") || ahpLogNameFilter && !ahpLogNameFilter(child.name)) {
        continue;
      }
      try {
        files.push(await createDebugLogFile(`ahp/${child.name}`, child.resource, fileService, child.size));
      } catch (error) {
        logService.warn(`[ExportAgentHostDebugLogs] Failed to read AHP log '${child.name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch {
  }
  if (remoteConnection?.defaultDirectory) {
    try {
      const remoteLog = await readRemoteAgentHostLog(remoteConnection, productService.serverDataFolderName, fileService);
      if (remoteLog) {
        files.push({ path: "remote-agenthost.log", contents: remoteLog });
      }
    } catch (error) {
      logService.warn(`[ExportAgentHostDebugLogs] Failed to download remote agenthost.log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const rawSessionId = getCopilotCliSessionRawId(activeSession?.resource);
  const copilotLogsDir = activeSession ? rawSessionId ? activeSession.isLocal ? buildLocalCopilotLogsUri(userHome) : remoteConnection ? buildRemoteCopilotLogsUri(remoteConnection) : void 0 : void 0 : buildLocalCopilotLogsUri(userHome);
  if (copilotLogsDir) {
    const copilotLogFiles = await findRelevantCopilotLogs(copilotLogsDir, rawSessionId, fileService, logService);
    for (const file of copilotLogFiles) {
      try {
        files.push(await createDebugLogFile(file.path, file.resource, fileService, file.size, MAX_REMOTE_COPILOT_LOG_EXPORT_SIZE));
      } catch (error) {
        logService.warn(`[ExportAgentHostDebugLogs] Failed to read Copilot log '${file.path}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (rawSessionId) {
    const sidecars = [
      { path: "usage.jsonl", resource: buildAgentHostUsageUri(environmentService.userRoamingDataHome, rawSessionId) },
      { path: "customizations.json", resource: buildAgentHostCustomizationsUri(environmentService.userRoamingDataHome, rawSessionId) }
    ];
    for (const sidecar of sidecars) {
      try {
        files.push(await createDebugLogFile(sidecar.path, sidecar.resource, fileService));
      } catch {
      }
    }
  }
  if (files.length === 0) {
    notificationService.notify({
      severity: Severity.Warning,
      message: activeSession ? localize("exportDebugLogs.noFiles.activeSession", "No log files were found for the active Agent Host session.") : localize("exportDebugLogs.noFiles.currentWindow", "No Agent Host log files were found for the current window.")
    });
    return void 0;
  }
  const titleSlug = activeSession?.title ? `-${activeSession.title.replace(/[/\\:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)}` : "";
  return { files, exportName: `ah-logs${titleSlug}` };
}
async function exportAgentHostDebugLogs(accessor, activeSession) {
  const exportService = accessor.get(IAgentHostDebugLogsExportService);
  const notificationService = accessor.get(INotificationService);
  const chatEntitlementService = accessor.get(IChatEntitlementService);
  const logs = await collectAgentHostDebugLogs(accessor, activeSession);
  if (!logs) {
    return;
  }
  try {
    const saved = await exportService.save(logs.exportName, logs.files);
    if (saved) {
      notificationService.warn(chatEntitlementService.isInternal ? localize("exportDebugLogs.privacyWarning.internal", "Note: This log may contain personal information such as auth tokens, file contents, or terminal output. It MUST be shared privately via Slack or in an issue filed on the microsoft/vscode-internalbacklog repo.") : localize("exportDebugLogs.privacyWarning", "Note: This log may contain personal information such as auth tokens, file contents, or terminal output. Please consider sharing privately or reviewing the contents carefully before sharing."));
    }
  } catch (error) {
    notificationService.notify({
      severity: Severity.Error,
      message: localize("exportDebugLogs.saveError", "Failed to save debug logs: {0}", error instanceof Error ? error.message : String(error))
    });
  }
}
class ExportAgentHostDebugLogsAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.exportAgentHostDebugLogs";
  }
  constructor() {
    super({
      id: ExportAgentHostDebugLogsAction.ID,
      title: localize2("exportAgentHostDebugLogs", "Export Agent Host Debug Logs..."),
      f1: true,
      category: Categories.Developer,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        IsWebContext.negate(),
        AGENT_HOST_ENABLED_CONTEXT_KEY
      )
    });
  }
  async run(accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const widget = chatWidgetService.lastFocusedWidget;
    const model = widget?.viewModel?.model;
    const activeSession = model ? toActiveAgentHostSession(model.sessionResource, model.title) : void 0;
    await exportAgentHostDebugLogs(accessor, activeSession);
  }
}
function toActiveAgentHostSession(resource, title) {
  if (resource.scheme === COPILOT_CLI_LOCAL_AH_SCHEME) {
    return { resource, title, isLocal: true };
  }
  if (parseRemoteAuthorityFromScheme(resource.scheme)) {
    return { resource, title, isLocal: false };
  }
  return void 0;
}
async function exportFilesToLocalFolder(fileDialogService, fileService, exportName, files) {
  const folders = await fileDialogService.showOpenDialog({
    title: localize("exportDebugLogs.folderDialogTitle", "Select Folder for Agent Host Debug Logs"),
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    availableFileSystems: [Schemas.file]
  });
  const parentFolder = folders?.[0];
  if (!parentFolder) {
    return false;
  }
  const exportFolder = joinPath(parentFolder, exportName);
  await fileService.createFolder(exportFolder);
  for (const file of files) {
    const segments = toSafeRelativePathSegments(file.path);
    if (segments.length === 0) {
      continue;
    }
    let folder = exportFolder;
    for (const segment of segments.slice(0, -1)) {
      folder = joinPath(folder, segment);
      await fileService.createFolder(folder);
    }
    const target = joinPath(folder, segments[segments.length - 1]);
    if (hasKey(file, { contents: true })) {
      await fileService.writeFile(target, VSBuffer.fromString(file.contents));
    } else {
      const source = await fileService.readFileStream(file.resource, { length: file.size });
      await fileService.writeFile(target, source.value);
    }
  }
  return true;
}
async function createDebugLogFile(path, resource, fileService, size, maxInlineSize) {
  if (resource.scheme === Schemas.file) {
    const observedSize = size ?? (await fileService.resolve(resource, { resolveMetadata: true })).size;
    return { path, resource, size: observedSize };
  }
  if (size !== void 0) {
    const readSize = maxInlineSize === void 0 ? size : Math.min(size, maxInlineSize);
    const stream = await fileService.readFileStream(resource, { position: size - readSize, length: readSize });
    const content2 = await streamToBuffer(stream.value);
    return { path, contents: content2.toString() };
  }
  const content = await fileService.readFile(resource);
  return { path, contents: content.value.toString() };
}
function toSafeRelativePathSegments(path) {
  return path.replace(/\\/g, "/").split("/").filter((segment) => {
    return segment.length > 0 && segment !== "." && segment !== "..";
  }).map((segment) => segment.replace(/[/\\:*?"<>|]/g, "-"));
}
export {
  BrowserAgentHostDebugLogsExportService,
  ExportAgentHostDebugLogsAction,
  IAgentHostDebugLogsExportService,
  collectAgentHostDebugLogs,
  exportAgentHostDebugLogs,
  toActiveAgentHostSession
};
