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
import { Codicon } from "../../../../../base/common/codicons.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { isElectron } from "../../../../../base/common/platform.js";
import { localize } from "../../../../../nls.js";
import { agentHostAuthority } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { IRemoteAgentHostService } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { UntitledTextEditorInput } from "../../../../services/untitled/common/untitledTextEditorInput.js";
import { FileEditorInput } from "../../../files/browser/editors/fileEditorInput.js";
import { NotebookEditorInput } from "../../../notebook/common/notebookEditorInput.js";
import { IChatContextPickService } from "../attachments/chatContextPickService.js";
import { toToolSetVariableEntry, toToolVariableEntry } from "../../common/attachments/chatVariableEntries.js";
import { isToolSet, ToolDataSource } from "../../common/tools/languageModelToolsService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { imageToHash, isImage } from "../widget/input/editor/chatPasteProviders.js";
import { convertBufferToScreenshotVariable } from "../attachments/chatScreenshotContext.js";
import { ChatInstructionsPickerPick } from "../promptSyntax/attachInstructionsAction.js";
import { IChatSessionsService, isAgentHostTarget } from "../../common/chatSessionsService.js";
import { getAgentSessionProviderIcon, AgentSessionProviders } from "../agentSessions/agentSessions.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { buildHostLocalEventsPath } from "../copilotCliEventsUri.js";
const EnableChatDebugToolsCommandId = "chat.enableDebugTools";
function shouldShowOpenEditorsContext(widget, hasEligibleOpenEditors) {
  if (!hasEligibleOpenEditors) {
    return false;
  }
  const sessionResource = widget.viewModel?.sessionResource;
  if (sessionResource && isAgentHostTarget(getChatSessionType(sessionResource))) {
    return false;
  }
  if (widget.lockedAgentId && isAgentHostTarget(widget.lockedAgentId)) {
    return false;
  }
  return true;
}
let ChatContextContributions = class extends Disposable {
  static {
    this.ID = "chat.contextContributions";
  }
  constructor(instantiationService, contextPickService) {
    super();
    this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ToolsContextPickerPick)));
    this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ChatInstructionsPickerPick)));
    this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(OpenEditorContextValuePick)));
    this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ClipboardImageContextValuePick)));
    this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ScreenshotContextValuePick)));
    this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(SessionReferenceContextPickerPick)));
  }
};
ChatContextContributions = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IChatContextPickService)
], ChatContextContributions);
class ToolsContextPickerPick {
  constructor() {
    this.type = "pickerPick";
    this.label = localize("chatContext.tools", "Tools...");
    this.icon = Codicon.tools;
    this.ordinal = -500;
  }
  isEnabled(widget) {
    return !!widget.attachmentCapabilities.supportsToolAttachments;
  }
  asPicker(widget) {
    const items = [];
    for (const [entry, enabled] of widget.input.selectedToolsModel.entriesMap.get()) {
      if (enabled) {
        if (isToolSet(entry)) {
          items.push({
            toolInfo: ToolDataSource.classify(entry.source),
            label: entry.referenceName,
            description: entry.description,
            asAttachment: () => toToolSetVariableEntry(entry)
          });
        } else {
          items.push({
            toolInfo: ToolDataSource.classify(entry.source),
            label: entry.toolReferenceName ?? entry.displayName,
            description: entry.userDescription ?? entry.modelDescription,
            asAttachment: () => toToolVariableEntry(entry)
          });
        }
      }
    }
    items.sort((a, b) => {
      let res = a.toolInfo.ordinal - b.toolInfo.ordinal;
      if (res === 0) {
        res = a.toolInfo.label.localeCompare(b.toolInfo.label);
      }
      if (res === 0) {
        res = a.label.localeCompare(b.label);
      }
      return res;
    });
    let lastGroupLabel;
    const picks = [];
    for (const item of items) {
      if (lastGroupLabel !== item.toolInfo.label) {
        picks.push({ type: "separator", label: item.toolInfo.label });
        lastGroupLabel = item.toolInfo.label;
      }
      picks.push(item);
    }
    return {
      placeholder: localize("chatContext.tools.placeholder", "Select a tool"),
      picks: Promise.resolve(picks)
    };
  }
}
let OpenEditorContextValuePick = class {
  constructor(_editorService, _labelService) {
    this._editorService = _editorService;
    this._labelService = _labelService;
    this.type = "valuePick";
    this.label = localize("chatContext.editors", "Open Editors");
    this.icon = Codicon.file;
    this.ordinal = 800;
  }
  isEnabled(widget) {
    const hasEligibleOpenEditors = this._editorService.editors.some((e) => e instanceof FileEditorInput || e instanceof DiffEditorInput || e instanceof UntitledTextEditorInput);
    return shouldShowOpenEditorsContext(widget, hasEligibleOpenEditors);
  }
  async asAttachment() {
    const result = [];
    for (const editor of this._editorService.editors) {
      if (!(editor instanceof FileEditorInput || editor instanceof DiffEditorInput || editor instanceof UntitledTextEditorInput || editor instanceof NotebookEditorInput)) {
        continue;
      }
      const uri = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
      if (!uri) {
        continue;
      }
      result.push({
        kind: "file",
        id: uri.toString(),
        value: uri,
        name: this._labelService.getUriBasenameLabel(uri)
      });
    }
    return result;
  }
};
OpenEditorContextValuePick = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, ILabelService)
], OpenEditorContextValuePick);
let ClipboardImageContextValuePick = class {
  constructor(_clipboardService) {
    this._clipboardService = _clipboardService;
    this.type = "valuePick";
    this.label = localize("imageFromClipboard", "Image from Clipboard");
    this.icon = Codicon.fileMedia;
  }
  async isEnabled(widget) {
    if (!widget.attachmentCapabilities.supportsImageAttachments) {
      return false;
    }
    if (!widget.input.selectedLanguageModel.get()?.metadata.capabilities?.vision) {
      return false;
    }
    const imageData = await this._clipboardService.readImage();
    return isImage(imageData);
  }
  async asAttachment() {
    const fileBuffer = await this._clipboardService.readImage();
    return {
      id: await imageToHash(fileBuffer),
      name: localize("pastedImage", "Pasted Image"),
      fullName: localize("pastedImage", "Pasted Image"),
      value: fileBuffer,
      kind: "image"
    };
  }
};
ClipboardImageContextValuePick = __decorateClass([
  __decorateParam(0, IClipboardService)
], ClipboardImageContextValuePick);
let TerminalContext = class {
  constructor(_resource, _terminalService) {
    this._resource = _resource;
    this._terminalService = _terminalService;
    this.type = "valuePick";
    this.icon = Codicon.terminal;
    this.label = localize("terminal", "Terminal");
  }
  isEnabled(widget) {
    const terminal = this._terminalService.getInstanceFromResource(this._resource);
    return !!widget.attachmentCapabilities.supportsTerminalAttachments && terminal?.isDisposed === false;
  }
  async asAttachment(widget) {
    const terminal = this._terminalService.getInstanceFromResource(this._resource);
    if (!terminal) {
      return;
    }
    const params = new URLSearchParams(this._resource.query);
    const command = terminal.capabilities.get(TerminalCapability.CommandDetection)?.commands.find((cmd) => cmd.id === params.get("command"));
    if (!command) {
      return;
    }
    const attachment = {
      kind: "terminalCommand",
      id: `terminalCommand:${Date.now()}}`,
      value: this.asValue(command),
      name: command.command,
      command: command.command,
      output: command.getOutput(),
      exitCode: command.exitCode,
      resource: this._resource
    };
    const cleanup = new DisposableStore();
    let disposed = false;
    const disposeCleanup = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      cleanup.dispose();
    };
    cleanup.add(widget.attachmentModel.onDidChange((e) => {
      if (e.deleted.includes(attachment.id)) {
        disposeCleanup();
      }
    }));
    cleanup.add(terminal.onDisposed(() => {
      widget.attachmentModel.delete(attachment.id);
      widget.refreshParsedInput();
      disposeCleanup();
    }));
    return attachment;
  }
  asValue(command) {
    let value = `Command: ${command.command}`;
    const output = command.getOutput();
    if (output) {
      value += `
Output:
${output}`;
    }
    if (typeof command.exitCode === "number") {
      value += `
Exit Code: ${command.exitCode}`;
    }
    return value;
  }
};
TerminalContext = __decorateClass([
  __decorateParam(1, ITerminalService)
], TerminalContext);
let ScreenshotContextValuePick = class {
  constructor(_hostService) {
    this._hostService = _hostService;
    this.type = "valuePick";
    this.icon = Codicon.deviceCamera;
    this.label = isElectron ? localize("chatContext.attachScreenshot.labelElectron.Window", "Screenshot Window") : localize("chatContext.attachScreenshot.labelWeb", "Screenshot");
  }
  async isEnabled(widget) {
    return !!widget.attachmentCapabilities.supportsImageAttachments && !!widget.input.selectedLanguageModel.get()?.metadata.capabilities?.vision;
  }
  async asAttachment() {
    const blob = await this._hostService.getScreenshot();
    return blob && convertBufferToScreenshotVariable(blob);
  }
};
ScreenshotContextValuePick = __decorateClass([
  __decorateParam(0, IHostService)
], ScreenshotContextValuePick);
let SessionReferenceContextPickerPick = class {
  constructor(_chatSessionsService, _pathService, _remoteAgentHostService) {
    this._chatSessionsService = _chatSessionsService;
    this._pathService = _pathService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this.type = "pickerPick";
    this.icon = Codicon.comment;
    this.label = localize("chatContext.sessions", "Sessions...");
    this.ordinal = -400;
  }
  isEnabled(widget) {
    return widget.location === ChatAgentLocation.Chat;
  }
  asPicker(widget) {
    const currentSessionResource = widget.viewModel?.sessionResource;
    const onlyShowAttachableCopilotCliSessions = !!currentSessionResource && isAgentHostTarget(getChatSessionType(currentSessionResource));
    return {
      placeholder: localize("chatContext.sessions.placeholder", "Select a session"),
      picks: (async () => {
        const picks = [];
        const sessionProviderFilter = [AgentSessionProviders.Local, AgentSessionProviders.Background, AgentSessionProviders.AgentHostCopilot];
        for await (const group of this._chatSessionsService.getChatSessionItems(sessionProviderFilter, CancellationToken.None)) {
          const providerIcon = getAgentSessionProviderIcon(group.chatSessionType);
          for (const item of group.items) {
            if (currentSessionResource && item.resource.toString() === currentSessionResource.toString()) {
              continue;
            }
            const sessionResource = item.resource;
            if (onlyShowAttachableCopilotCliSessions && !this._canAttachCopilotCliSession(sessionResource)) {
              continue;
            }
            const icon = item.iconPath ?? providerIcon;
            picks.push({
              label: item.label,
              description: new Date(item.timing.lastRequestEnded ?? item.timing.created).toLocaleString(),
              asAttachment: () => ({
                kind: "sessionReference",
                id: sessionResource.toString(),
                name: item.label,
                value: sessionResource,
                icon
              })
            });
          }
        }
        picks.sort((a, b) => (b.description ?? "").localeCompare(a.description ?? ""));
        return picks;
      })()
    };
  }
  _canAttachCopilotCliSession(sessionResource) {
    return !!buildHostLocalEventsPath(
      sessionResource,
      this._pathService.userHome({ preferLocal: true }),
      (authority) => this._remoteAgentHostService.connections.find((connection) => agentHostAuthority(connection.address) === authority)
    );
  }
};
SessionReferenceContextPickerPick = __decorateClass([
  __decorateParam(0, IChatSessionsService),
  __decorateParam(1, IPathService),
  __decorateParam(2, IRemoteAgentHostService)
], SessionReferenceContextPickerPick);
export {
  ChatContextContributions,
  EnableChatDebugToolsCommandId,
  TerminalContext,
  shouldShowOpenEditorsContext
};
