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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { localize } from "../../../../../../nls.js";
import {
  AgentHostPermissionMode,
  IAgentHostResourceService
} from "../../../../../../platform/agentHost/common/agentHostResourceService.js";
import { AGENT_HOST_SCHEME, agentHostAuthority } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { CommandsRegistry } from "../../../../../../platform/commands/common/commands.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import {
  ChatInputNotificationActionKind,
  ChatInputNotificationSeverity,
  IChatInputNotificationService
} from "../../widget/input/chatInputNotificationService.js";
const ALLOW_COMMAND = "_agentHost.permission.allow";
const ALLOW_ALWAYS_COMMAND = "_agentHost.permission.allowAlways";
const DENY_COMMAND = "_agentHost.permission.deny";
CommandsRegistry.registerCommand(ALLOW_COMMAND, (accessor, requestId) => {
  accessor.get(IAgentHostResourceService).findPending(requestId)?.allow();
});
CommandsRegistry.registerCommand(ALLOW_ALWAYS_COMMAND, (accessor, requestId) => {
  accessor.get(IAgentHostResourceService).findPending(requestId)?.allowAlways();
});
CommandsRegistry.registerCommand(DENY_COMMAND, (accessor, requestId) => {
  accessor.get(IAgentHostResourceService).findPending(requestId)?.deny();
});
let AgentHostPermissionUiContribution = class extends Disposable {
  constructor(_permissionService, _chatInputNotificationService, _labelService) {
    super();
    this._permissionService = _permissionService;
    this._chatInputNotificationService = _chatInputNotificationService;
    this._labelService = _labelService;
    this._register(autorun((reader) => {
      const pending = this._permissionService.allPending.read(reader);
      this._render(pending);
    }));
  }
  static {
    this.ID = "workbench.contrib.agentHostPermissionUi";
  }
  static {
    /** Stable id used in {@link IChatInputNotification} so updates replace in place. */
    this.NOTIFICATION_ID = "agentHost.permissionRequest";
  }
  _render(pending) {
    const next = pending[0];
    if (!next) {
      if (this._lastRequestId) {
        this._chatInputNotificationService.deleteNotification(AgentHostPermissionUiContribution.NOTIFICATION_ID);
        this._lastRequestId = void 0;
      }
      return;
    }
    this._lastRequestId = next.id;
    this._chatInputNotificationService.setNotification(this._buildNotification(next, pending.length));
  }
  _buildNotification(request, totalPending) {
    const hostName = escapeMarkdownSyntaxTokens(this._resolveHostName(request.address));
    const path = request.uri.scheme === Schemas.file ? request.uri.fsPath : request.uri.toString();
    const fence = "`".repeat((path.match(/`+/g)?.reduce((m, s) => Math.max(m, s.length), 0) ?? 0) + 1);
    const codePath = `${fence}${path}${fence}`;
    const message = new MarkdownString(
      request.mode === AgentHostPermissionMode.Write ? localize(
        "agentHost.permission.write",
        'Remote agent host "{0}" wants to write {1}',
        hostName,
        codePath
      ) : localize(
        "agentHost.permission.read",
        'Remote agent host "{0}" wants to read {1}',
        hostName,
        codePath
      )
    );
    const description = totalPending > 1 ? totalPending === 2 ? localize("agentHost.permission.oneMorePending", "+1 more request waiting") : localize("agentHost.permission.morePending", "+{0} more requests waiting", totalPending - 1) : void 0;
    return {
      id: AgentHostPermissionUiContribution.NOTIFICATION_ID,
      severity: ChatInputNotificationSeverity.Warning,
      message,
      description,
      actions: [
        {
          kind: ChatInputNotificationActionKind.Command,
          label: localize("agentHost.permission.deny", "Deny"),
          commandId: DENY_COMMAND,
          commandArgs: [request.id]
        },
        {
          kind: ChatInputNotificationActionKind.Command,
          label: localize("agentHost.permission.allow", "Allow"),
          commandId: ALLOW_COMMAND,
          commandArgs: [request.id]
        },
        {
          kind: ChatInputNotificationActionKind.Command,
          label: localize("agentHost.permission.allowAlways", "Always Allow"),
          commandId: ALLOW_ALWAYS_COMMAND,
          commandArgs: [request.id]
        }
      ],
      // Do not let the user dismiss without choosing — this is a security
      // decision. Clicking any of the three buttons resolves it.
      dismissible: false,
      autoDismissOnMessage: false
    };
  }
  _resolveHostName(address) {
    const authority = agentHostAuthority(address);
    const label = this._labelService.getHostLabel(AGENT_HOST_SCHEME, authority);
    return label && label !== authority ? label : address;
  }
};
AgentHostPermissionUiContribution = __decorateClass([
  __decorateParam(0, IAgentHostResourceService),
  __decorateParam(1, IChatInputNotificationService),
  __decorateParam(2, ILabelService)
], AgentHostPermissionUiContribution);
export {
  AgentHostPermissionUiContribution
};
