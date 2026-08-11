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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../common/contributions.js";
import { ITerminalInstanceService } from "../../../terminal/browser/terminal.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
import { TerminalAutoRepliesSettingId } from "../common/terminalAutoRepliesConfiguration.js";
let TerminalAutoRepliesContribution = class extends Disposable {
  constructor(_configurationService, terminalInstanceService) {
    super();
    this._configurationService = _configurationService;
    for (const backend of terminalInstanceService.getRegisteredBackends()) {
      this._installListenersOnBackend(backend);
    }
    this._register(terminalInstanceService.onDidRegisterBackend(async (e) => this._installListenersOnBackend(e)));
  }
  static {
    this.ID = "terminalAutoReplies";
  }
  _installListenersOnBackend(backend) {
    const initialConfig = this._configurationService.getValue(TERMINAL_CONFIG_SECTION);
    for (const match of Object.keys(initialConfig.autoReplies)) {
      const reply = initialConfig.autoReplies[match];
      if (reply) {
        backend.installAutoReply(match, reply);
      }
    }
    this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(TerminalAutoRepliesSettingId.AutoReplies)) {
        backend.uninstallAllAutoReplies();
        const config = this._configurationService.getValue(TERMINAL_CONFIG_SECTION);
        for (const match of Object.keys(config.autoReplies)) {
          const reply = config.autoReplies[match];
          if (reply) {
            backend.installAutoReply(match, reply);
          }
        }
      }
    }));
  }
};
TerminalAutoRepliesContribution = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITerminalInstanceService)
], TerminalAutoRepliesContribution);
registerWorkbenchContribution2(TerminalAutoRepliesContribution.ID, TerminalAutoRepliesContribution, WorkbenchPhase.AfterRestored);
export {
  TerminalAutoRepliesContribution
};
