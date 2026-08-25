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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Action, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY, CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY, readCodexAccountInfo } from "../../../../platform/agentHost/common/codexAccount.js";
import { AgentHostCodexAgentEnabledSettingId, CodexPreferAgentHostEditorSettingId, IAgentHostService } from "../../../../platform/agentHost/common/agentService.js";
import { ChatAIDisabledSettingId } from "../../../../platform/chat/common/chatSettings.js";
import { ActionType } from "../../../../platform/agentHost/common/state/sessionActions.js";
import { ROOT_STATE_URI } from "../../../../platform/agentHost/common/state/sessionState.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
const ICodexAccountService = createDecorator("codexAccountService");
function hasSignedInCodexChatGPTAccount(account, visible = true) {
  return visible && account.status === "signedIn";
}
function shouldShowCodexAccount(configurationService, isSessionsWindow) {
  return configurationService.getValue(ChatAIDisabledSettingId) !== true && configurationService.getValue(AgentHostCodexAgentEnabledSettingId) === true && (isSessionsWindow || configurationService.getValue(CodexPreferAgentHostEditorSettingId) === true);
}
function createCodexAccountMenuActions(service, visible = true) {
  if (!visible) {
    return [];
  }
  const account = service.account;
  if (account.status === "signedIn") {
    const signOut = toAction({
      id: "codex.signOutOfChatGPT",
      label: localize("signOutOfChatGPT", "Sign Out"),
      run: () => service.signOut()
    });
    const accountLabel = account.email ? localize("chatGPTAccountWithProvider", "{0} (ChatGPT)", account.email) : localize("chatGPTAccount", "ChatGPT");
    return [new SubmenuAction("codex.chatgptAccount", accountLabel, [signOut])];
  }
  if (account.status === "unknown" || account.status === "signedOut" || account.status === "error") {
    return [new Action("codex.signInToChatGPT", localize("signInToChatGPT", "Sign in to ChatGPT"), void 0, true, () => service.signIn())];
  }
  return [];
}
function openCodexAuthUrl(openerService, authUrl) {
  return openerService.open(authUrl, { openExternal: true, skipValidation: true });
}
let CodexAccountService = class extends Disposable {
  constructor(_agentHostService, _openerService) {
    super();
    this._agentHostService = _agentHostService;
    this._openerService = _openerService;
    this._onDidChangeAccount = this._register(new Emitter());
    this.onDidChangeAccount = this._onDidChangeAccount.event;
    this._pendingSignInRequests = /* @__PURE__ */ new Set();
    const initialState = this._agentHostService.rootState.value;
    this._account = readCodexAccountInfo(initialState instanceof Error ? void 0 : initialState);
    this._register(this._agentHostService.rootState.onDidChange((state) => this._updateAccount(readCodexAccountInfo(state))));
  }
  get account() {
    return this._account;
  }
  signIn() {
    const request = generateUuid();
    this._pendingSignInRequests.add(request);
    this._agentHostService.dispatch(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config: { [CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY]: request }
    });
  }
  signOut() {
    this._agentHostService.dispatch(ROOT_STATE_URI, {
      type: ActionType.RootConfigChanged,
      config: { [CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY]: generateUuid() }
    });
  }
  _updateAccount(account) {
    this._account = account;
    this._onDidChangeAccount.fire(account);
    if (account.authUrlNonce && this._pendingSignInRequests.delete(account.authUrlNonce) && account.authUrl) {
      void openCodexAuthUrl(this._openerService, account.authUrl);
    }
  }
};
CodexAccountService = __decorateClass([
  __decorateParam(0, IAgentHostService),
  __decorateParam(1, IOpenerService)
], CodexAccountService);
registerSingleton(ICodexAccountService, CodexAccountService, InstantiationType.Delayed);
export {
  ICodexAccountService,
  createCodexAccountMenuActions,
  hasSignedInCodexChatGPTAccount,
  openCodexAuthUrl,
  shouldShowCodexAccount
};
