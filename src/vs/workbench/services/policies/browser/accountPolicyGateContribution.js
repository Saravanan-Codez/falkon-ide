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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { DEFAULT_ACCOUNT_SIGN_IN_COMMAND } from "../../accounts/browser/defaultAccount.js";
import { IChatEntitlementService } from "../../chat/common/chatEntitlementService.js";
import { AccountPolicyGateState, AccountPolicyGateUnsatisfiedReason, ChatAccountPolicyGateActiveContext, IAccountPolicyGateService } from "../common/accountPolicyService.js";
const NOTIFICATION_DISMISSED_KEY = "accountPolicy.gateNotificationDismissed";
let AccountPolicyGateContribution = class extends Disposable {
  constructor(gateService, contextKeyService, chatEntitlementService, defaultAccountService, logService, notificationService, commandService, openerService, storageService, telemetryService) {
    super();
    this.gateService = gateService;
    this.chatEntitlementService = chatEntitlementService;
    this.defaultAccountService = defaultAccountService;
    this.logService = logService;
    this.notificationService = notificationService;
    this.commandService = commandService;
    this.openerService = openerService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this.notificationHandle = this._register(new MutableDisposable());
    this.initialised = false;
    this.contextKey = ChatAccountPolicyGateActiveContext.bindTo(contextKeyService);
    this.lastInfo = this.gateService.gateInfo;
    this.apply(
      this.lastInfo,
      /*forceTelemetry*/
      true,
      /*showNotification*/
      false
    );
    this._register(this.gateService.onDidChangeGateInfo((info) => {
      this.initialised = true;
      this.apply(
        info,
        /*forceTelemetry*/
        false,
        /*showNotification*/
        true
      );
    }));
    this._register(disposableTimeout(() => {
      if (!this.initialised) {
        this.initialised = true;
        this.apply(
          this.lastInfo,
          /*forceTelemetry*/
          false,
          /*showNotification*/
          true
        );
      }
    }, 5e3));
  }
  static {
    this.ID = "workbench.contrib.accountPolicyGate";
  }
  apply(info, forceTelemetry, showNotification) {
    const stateChanged = forceTelemetry || info.state !== this.lastInfo.state || info.reason !== this.lastInfo.reason;
    this.lastInfo = info;
    const isRestricted = info.state === AccountPolicyGateState.Restricted && info.reason !== AccountPolicyGateUnsatisfiedReason.PolicyNotResolved;
    this.contextKey.set(isRestricted);
    this.chatEntitlementService.setForceHidden(isRestricted);
    this.logService.info(`[AccountPolicyGate] apply: state=${info.state}, reason=${info.reason}, isRestricted=${isRestricted}`);
    if (stateChanged) {
      this.telemetryService.publicLog2("accountPolicy.gateState", {
        gateActive: info.state !== AccountPolicyGateState.Inactive,
        gateSatisfied: info.state === AccountPolicyGateState.Satisfied,
        reasonNotSatisfied: info.reason
      });
    }
    if (info.state !== AccountPolicyGateState.Restricted) {
      this.notificationHandle.clear();
      this.dismissedKey = void 0;
      this.storageService.remove(NOTIFICATION_DISMISSED_KEY, StorageScope.APPLICATION);
      return;
    }
    if (!showNotification) {
      return;
    }
    if (info.reason === AccountPolicyGateUnsatisfiedReason.PolicyNotResolved) {
      return;
    }
    const accountName = this.defaultAccountService.currentDefaultAccount?.accountName;
    const notificationKey = `${info.reason ?? ""}:${accountName ?? ""}`;
    if (this.dismissedKey !== void 0 && this.dismissedKey !== notificationKey) {
      this.notificationHandle.clear();
      this.dismissedKey = void 0;
    }
    this.maybeShowNotification(info, notificationKey);
  }
  maybeShowNotification(info, notificationKey) {
    if (this.notificationHandle.value) {
      return;
    }
    if (this.dismissedKey === notificationKey) {
      return;
    }
    const persistedDismissed = this.storageService.get(NOTIFICATION_DISMISSED_KEY, StorageScope.APPLICATION);
    if (persistedDismissed === notificationKey) {
      return;
    }
    const accountName = this.defaultAccountService.currentDefaultAccount?.accountName;
    const approvedOrgs = info.approvedOrganizations ?? [];
    const hasConcreteOrgs = approvedOrgs.length > 0 && !approvedOrgs.includes("*");
    const orgList = approvedOrgs.join(", ");
    let message;
    if (accountName && hasConcreteOrgs) {
      message = localize(
        "accountPolicy.notification.orgWithAccount",
        'Your administrator restricts AI features to GitHub accounts in the following organizations: {0}. The account "{1}" is not a member of any of these.',
        orgList,
        accountName
      );
    } else if (accountName) {
      message = localize(
        "accountPolicy.notification.orgWithAccountNoList",
        'Your administrator restricts AI features to specific GitHub accounts. The account "{0}" does not qualify.',
        accountName
      );
    } else if (hasConcreteOrgs) {
      message = localize(
        "accountPolicy.notification.signinWithOrgs",
        "Your administrator restricts AI features to GitHub accounts in the following organizations: {0}.",
        orgList
      );
    } else {
      message = localize(
        "accountPolicy.notification.signin",
        "Your administrator restricts AI features to specific GitHub accounts."
      );
    }
    const handleDisposables = new DisposableStore();
    const handle = this.notificationService.prompt(
      Severity.Warning,
      message,
      [
        {
          label: localize("accountPolicy.notification.signin.action", "Sign In"),
          run: () => this.commandService.executeCommand(DEFAULT_ACCOUNT_SIGN_IN_COMMAND)
        },
        {
          label: localize("accountPolicy.notification.learnMore", "Learn More"),
          run: () => this.openerService.open(URI.parse("https://code.visualstudio.com/docs/enterprise/overview"))
        }
      ],
      { sticky: true }
    );
    handleDisposables.add(handle.onDidClose(() => {
      this.dismissedKey = notificationKey;
      this.notificationHandle.clear();
    }));
    handleDisposables.add({ dispose: () => handle.close() });
    this.notificationHandle.value = handleDisposables;
  }
};
AccountPolicyGateContribution = __decorateClass([
  __decorateParam(0, IAccountPolicyGateService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IChatEntitlementService),
  __decorateParam(3, IDefaultAccountService),
  __decorateParam(4, ILogService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, ITelemetryService)
], AccountPolicyGateContribution);
export {
  AccountPolicyGateContribution
};
