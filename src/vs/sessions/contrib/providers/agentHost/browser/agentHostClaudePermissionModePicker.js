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
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { ClaudeSessionConfigKey } from "../../../../../platform/agentHost/common/claudeSessionConfigKeys.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { AgentHostSessionEnumPicker } from "./agentHostModePicker.js";
import { isWellKnownClaudePermissionModeSchema } from "./agentHostPermissionPickerDelegate.js";
const CLAUDE_PERMISSION_MODE_LEARN_MORE_URL = "https://code.claude.com/docs/en/permission-modes#available-modes";
const LEARN_MORE_VALUE = "__agentHostClaudePermissionModePicker.learnMore__";
function getClaudePermissionModeIcon(value) {
  switch (value) {
    case "default":
      return Codicon.shield;
    case "acceptEdits":
      return Codicon.edit;
    case "plan":
      return Codicon.lightbulb;
    case "auto":
      return Codicon.sparkle;
    case "bypassPermissions":
      return Codicon.warning;
    default:
      return void 0;
  }
}
let AgentHostClaudePermissionModePicker = class extends AgentHostSessionEnumPicker {
  constructor(session, actionWidgetService, sessionsProvidersService, telemetryService, hoverService, _openerService) {
    super(session, actionWidgetService, sessionsProvidersService, telemetryService, hoverService);
    this._openerService = _openerService;
    this._property = ClaudeSessionConfigKey.PermissionMode;
    this._pickerId = "agentHostClaudePermissionModePicker";
    this._telemetryId = "NewChatAgentHostClaudePermissionModePicker";
  }
  _isWellKnownSchema(schema) {
    return isWellKnownClaudePermissionModeSchema(schema);
  }
  _getTriggerIcon(value) {
    return getClaudePermissionModeIcon(value);
  }
  _getActionItemIcon(item) {
    return getClaudePermissionModeIcon(item.value);
  }
  _getTriggerAriaLabel(label) {
    return localize("agentHostClaudePermissionModePicker.triggerAriaLabel", "Pick Approvals, {0}", label);
  }
  _getWidgetAriaLabel() {
    return localize("agentHostClaudePermissionModePicker.ariaLabel", "Approvals Picker");
  }
  _getFooterActionItems() {
    const learnMoreLabel = localize("permissions.learnMore", "Learn more about permissions");
    return [
      {
        kind: ActionListItemKind.Separator,
        label: ""
      },
      {
        kind: ActionListItemKind.Action,
        label: learnMoreLabel,
        group: { title: "", icon: Codicon.blank },
        item: {
          value: LEARN_MORE_VALUE,
          label: learnMoreLabel
        }
      }
    ];
  }
  _handleFooterActionItem(item) {
    if (item.value !== LEARN_MORE_VALUE) {
      return false;
    }
    void this._openerService.open(URI.parse(CLAUDE_PERMISSION_MODE_LEARN_MORE_URL));
    return true;
  }
};
AgentHostClaudePermissionModePicker = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, ISessionsProvidersService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IOpenerService)
], AgentHostClaudePermissionModePicker);
export {
  AgentHostClaudePermissionModePicker
};
