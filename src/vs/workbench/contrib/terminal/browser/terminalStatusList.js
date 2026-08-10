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
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import Severity from "../../../../base/common/severity.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { listErrorForeground, listWarningForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { spinningLoading } from "../../../../platform/theme/common/iconRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { isString } from "../../../../base/common/types.js";
var TerminalStatus = /* @__PURE__ */ ((TerminalStatus2) => {
  TerminalStatus2["Bell"] = "bell";
  TerminalStatus2["Disconnected"] = "disconnected";
  TerminalStatus2["RelaunchNeeded"] = "relaunch-needed";
  TerminalStatus2["EnvironmentVariableInfoChangesActive"] = "env-var-info-changes-active";
  TerminalStatus2["ShellIntegrationInfo"] = "shell-integration-info";
  TerminalStatus2["ShellIntegrationAttentionNeeded"] = "shell-integration-attention-needed";
  return TerminalStatus2;
})(TerminalStatus || {});
let TerminalStatusList = class extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
    this._statuses = /* @__PURE__ */ new Map();
    this._statusTimeouts = /* @__PURE__ */ new Map();
    this._onDidAddStatus = this._register(new Emitter());
    this._onDidRemoveStatus = this._register(new Emitter());
    this._onDidChangePrimaryStatus = this._register(new Emitter());
  }
  get onDidAddStatus() {
    return this._onDidAddStatus.event;
  }
  get onDidRemoveStatus() {
    return this._onDidRemoveStatus.event;
  }
  get onDidChangePrimaryStatus() {
    return this._onDidChangePrimaryStatus.event;
  }
  get primary() {
    let result;
    for (const s of this._statuses.values()) {
      if (!result || s.severity >= result.severity) {
        if (s.icon || !result?.icon) {
          result = s;
        }
      }
    }
    return result;
  }
  get statuses() {
    return Array.from(this._statuses.values());
  }
  add(status, duration) {
    status = this._applyAnimationSetting(status);
    const outTimeout = this._statusTimeouts.get(status.id);
    if (outTimeout) {
      mainWindow.clearTimeout(outTimeout);
      this._statusTimeouts.delete(status.id);
    }
    if (duration && duration > 0) {
      const timeout = mainWindow.setTimeout(() => this.remove(status), duration);
      this._statusTimeouts.set(status.id, timeout);
    }
    const existingStatus = this._statuses.get(status.id);
    if (existingStatus && existingStatus !== status) {
      this._onDidRemoveStatus.fire(existingStatus);
      this._statuses.delete(existingStatus.id);
    }
    if (!this._statuses.has(status.id)) {
      const oldPrimary = this.primary;
      this._statuses.set(status.id, status);
      this._onDidAddStatus.fire(status);
      const newPrimary = this.primary;
      if (oldPrimary !== newPrimary) {
        this._onDidChangePrimaryStatus.fire(newPrimary);
      }
    }
  }
  remove(statusOrId) {
    const status = isString(statusOrId) ? this._statuses.get(statusOrId) : statusOrId;
    if (status && this._statuses.get(status.id)) {
      const wasPrimary = this.primary?.id === status.id;
      this._statuses.delete(status.id);
      this._onDidRemoveStatus.fire(status);
      if (wasPrimary) {
        this._onDidChangePrimaryStatus.fire(this.primary);
      }
    }
  }
  toggle(status, value) {
    if (value) {
      this.add(status);
    } else {
      this.remove(status);
    }
  }
  _applyAnimationSetting(status) {
    if (!status.icon || ThemeIcon.getModifier(status.icon) !== "spin" || this._configurationService.getValue(TerminalSettingId.TabsEnableAnimation)) {
      return status;
    }
    let icon;
    if (status.icon.id === spinningLoading.id) {
      icon = Codicon.play;
    } else {
      icon = ThemeIcon.modify(status.icon, void 0);
    }
    return {
      ...status,
      icon
    };
  }
};
TerminalStatusList = __decorateClass([
  __decorateParam(0, IConfigurationService)
], TerminalStatusList);
function getColorForSeverity(severity) {
  switch (severity) {
    case Severity.Error:
      return listErrorForeground;
    case Severity.Warning:
      return listWarningForeground;
    default:
      return "";
  }
}
export {
  TerminalStatus,
  TerminalStatusList,
  getColorForSeverity
};
