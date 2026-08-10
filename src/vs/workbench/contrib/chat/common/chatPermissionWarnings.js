import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ASSISTED_APPROVAL_DONT_SHOW_AGAIN_KEY, AUTO_APPROVE_DONT_SHOW_AGAIN_KEY, AUTOPILOT_DONT_SHOW_AGAIN_KEY } from "./chatPermissionStorageKeys.js";
import { ChatConfiguration, ChatPermissionLevel } from "./constants.js";
const shownWarnings = /* @__PURE__ */ new Set();
function dontShowAgainKey(level) {
  if (level === ChatPermissionLevel.Autopilot) {
    return AUTOPILOT_DONT_SHOW_AGAIN_KEY;
  }
  if (level === ChatPermissionLevel.AutoApprove) {
    return AUTO_APPROVE_DONT_SHOW_AGAIN_KEY;
  }
  if (level === ChatPermissionLevel.Assisted) {
    return ASSISTED_APPROVAL_DONT_SHOW_AGAIN_KEY;
  }
  return void 0;
}
function resetShownWarnings() {
  shownWarnings.clear();
}
const ELEVATION_RANK = /* @__PURE__ */ new Map([
  [ChatPermissionLevel.Assisted, 1],
  [ChatPermissionLevel.AutoApprove, 2],
  [ChatPermissionLevel.Autopilot, 2]
]);
function hasShownElevatedWarning(level, storageService) {
  const rank = ELEVATION_RANK.get(level);
  if (rank === void 0) {
    return false;
  }
  for (const [candidate, candidateRank] of ELEVATION_RANK) {
    if (candidateRank < rank) {
      continue;
    }
    if (shownWarnings.has(candidate)) {
      return true;
    }
    const key = dontShowAgainKey(candidate);
    if (key && storageService.getBoolean(key, StorageScope.PROFILE, false)) {
      return true;
    }
  }
  return false;
}
function getElevatedWarningCopy(level, defaultSettingKey, levelLabel) {
  switch (level) {
    case ChatPermissionLevel.Assisted:
      levelLabel ??= localize("permissions.assisted", "Auto Approvals");
      return {
        title: localize("permissions.assisted.warning.title", "Enable {0}?", levelLabel),
        confirm: localize("permissions.assisted.warning.confirm", "Enable"),
        icon: Codicon.sparkle,
        detail: localize("permissions.assisted.warning.detail", "{0} uses model recommendations to approve tool calls. Copilot will still ask when the model requires approval, excludes the request from automatic approval, or cannot make a recommendation.\n\nTo make this the starting permission level for new sessions, change the [{1}](command:workbench.action.openSettings?%5B%22{1}%22%5D) setting.", levelLabel, defaultSettingKey)
      };
    case ChatPermissionLevel.Autopilot:
      return {
        title: localize("permissions.autopilot.warning.title", "Enable Autopilot?"),
        confirm: localize("permissions.autopilot.warning.confirm", "Enable"),
        icon: Codicon.rocket,
        detail: localize("permissions.autopilot.warning.detail", "Autopilot will auto-approve all tool calls and continue working autonomously until the task is complete. This includes terminal commands, file edits, and external tool calls. The agent will make decisions on your behalf without asking for confirmation.\n\nYou can stop the agent at any time by clicking the stop button. This applies to the current session only.\n\nTo make this the starting permission level for new sessions, change the [{0}](command:workbench.action.openSettings?%5B%22{0}%22%5D) setting.", defaultSettingKey)
      };
    case ChatPermissionLevel.AutoApprove:
      levelLabel ??= localize("permissions.autoApprove", "Bypass Approvals");
      return {
        title: localize("permissions.autoApprove.warning.title", "Enable {0}?", levelLabel),
        confirm: localize("permissions.autoApprove.warning.confirm", "Enable"),
        icon: Codicon.warning,
        detail: localize("permissions.autoApprove.warning.detail", "{0} will auto-approve all tool calls without asking for confirmation. This includes file edits, terminal commands, and external tool calls.\n\nTo make this the starting permission level for new sessions, change the [{1}](command:workbench.action.openSettings?%5B%22{1}%22%5D) setting.", levelLabel, defaultSettingKey)
      };
    default:
      return void 0;
  }
}
async function maybeConfirmElevatedPermissionLevel(level, dialogService, storageService, options) {
  const key = dontShowAgainKey(level);
  if (!key || hasShownElevatedWarning(level, storageService)) {
    return true;
  }
  const copy = getElevatedWarningCopy(level, options?.defaultSettingKey ?? ChatConfiguration.DefaultPermissionLevel, options?.levelLabel);
  if (!copy) {
    return true;
  }
  const result = await dialogService.prompt({
    type: Severity.Warning,
    message: copy.title,
    buttons: [
      {
        label: copy.confirm,
        run: () => true
      },
      {
        label: localize("permissions.warning.cancel", "Cancel"),
        run: () => false
      }
    ],
    checkbox: {
      label: localize("permissions.warning.dontShowAgain", "Don't show again"),
      checked: false
    },
    custom: {
      icon: copy.icon,
      markdownDetails: [{
        markdown: new MarkdownString(
          copy.detail,
          { isTrusted: { enabledCommands: ["workbench.action.openSettings"] } }
        )
      }]
    }
  });
  if (result.result !== true) {
    return false;
  }
  if (result.checkboxChecked) {
    storageService.store(key, true, StorageScope.PROFILE, StorageTarget.USER);
  }
  shownWarnings.add(level);
  return true;
}
export {
  hasShownElevatedWarning,
  maybeConfirmElevatedPermissionLevel,
  resetShownWarnings
};
