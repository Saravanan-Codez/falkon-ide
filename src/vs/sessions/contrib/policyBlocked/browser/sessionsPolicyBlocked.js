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
import "./media/sessionsPolicyBlocked.css";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { $, addDisposableGenericMouseDownListener, append, EventType, addDisposableListener, getWindow } from "../../../../base/browser/dom.js";
import { localize } from "../../../../nls.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { URI } from "../../../../base/common/uri.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
var SessionsBlockedReason = /* @__PURE__ */ ((SessionsBlockedReason2) => {
  SessionsBlockedReason2["AgentDisabled"] = "agentDisabled";
  SessionsBlockedReason2["Loading"] = "loading";
  SessionsBlockedReason2["AccountPolicyGate"] = "accountPolicyGate";
  return SessionsBlockedReason2;
})(SessionsBlockedReason || {});
let SessionsPolicyBlockedOverlay = class extends Disposable {
  constructor(container, options, commandService, openerService, productService, layoutService) {
    super();
    this.commandService = commandService;
    this.openerService = openerService;
    this.productService = productService;
    this.overlay = append(container, $(".sessions-policy-blocked-overlay"));
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.overlay.tabIndex = -1;
    this.overlay.focus();
    this._register(toDisposable(() => this.overlay.remove()));
    const workbenchRoot = layoutService.mainContainer;
    workbenchRoot.classList.add("sessions-policy-blocked");
    this._register(toDisposable(() => workbenchRoot.classList.remove("sessions-policy-blocked")));
    const card = append(this.overlay, $(".sessions-policy-blocked-card"));
    this._register(addDisposableListener(getWindow(this.overlay), EventType.KEY_DOWN, (e) => {
      if (card.contains(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }, true));
    this._register(addDisposableGenericMouseDownListener(this.overlay, (e) => {
      if (e.target === this.overlay) {
        e.preventDefault();
        e.stopPropagation();
      }
    }));
    append(card, $("div.sessions-policy-blocked-logo"));
    switch (options.reason) {
      case "agentDisabled" /* AgentDisabled */:
        this._renderAgentDisabled(card);
        break;
      case "loading" /* Loading */:
        this._renderLoading(card);
        break;
      case "accountPolicyGate" /* AccountPolicyGate */:
        this._renderAccountPolicyGate(card, options);
        break;
    }
  }
  _renderAgentDisabled(card) {
    this.overlay.setAttribute("aria-label", localize("policyBlocked.aria", "Agents disabled by organization policy"));
    append(card, $("h2", void 0, localize("policyBlocked.title", "Agents Disabled")));
    const description = append(card, $("p"));
    append(description, document.createTextNode(localize("policyBlocked.description", "Your organization has disabled Agents via policy.")));
    append(description, document.createTextNode(" "));
    const learnMore = append(description, $("a.sessions-policy-blocked-link"));
    learnMore.textContent = localize("policyBlocked.learnMore", "Learn more");
    learnMore.href = "https://aka.ms/VSCode/Agents/docs";
    this._register(addDisposableListener(learnMore, EventType.CLICK, (e) => {
      e.preventDefault();
      this.openerService.open(URI.parse("https://aka.ms/VSCode/Agents/docs"));
    }));
    const button = this._register(new Button(card, { ...defaultButtonStyles, secondary: true }));
    button.label = localize("policyBlocked.openVSCode", "Open VS Code");
    this._register(button.onDidClick(() => this._openVSCode()));
  }
  _renderLoading(card) {
    this.overlay.setAttribute("aria-label", localize("loading.aria", "Loading"));
    append(card, $(
      "div.sessions-policy-blocked-progress-bar",
      void 0,
      $("div.sessions-policy-blocked-progress-bar-fill")
    ));
  }
  _renderAccountPolicyGate(card, options) {
    this.overlay.setAttribute("aria-label", localize("accountGate.aria", "Sign-in required by your administrator"));
    append(card, $("h2", void 0, localize("accountGate.title", "Sign-In Required")));
    const description = append(card, $("p"));
    if (options.accountName) {
      append(description, document.createTextNode(
        localize("accountGate.descriptionWithAccount", 'The account "{0}" is not a member of an organization that your administrator allows for Agents.', options.accountName)
      ));
    } else {
      append(description, document.createTextNode(
        localize("accountGate.descriptionNoAccount", "Your administrator restricts Agents to members of the organizations below.")
      ));
    }
    const approvedOrgs = options.approvedOrganizations ?? [];
    const hasConcreteOrgs = approvedOrgs.length > 0 && !approvedOrgs.includes("*");
    if (hasConcreteOrgs) {
      const orgSection = append(card, $("div.sessions-policy-blocked-orgs"));
      append(orgSection, $(
        "p.sessions-policy-blocked-orgs-label",
        void 0,
        localize("accountGate.approvedOrgs", "Allowed organizations:")
      ));
      const orgList = append(orgSection, $("ul"));
      for (const org of approvedOrgs) {
        append(orgList, $("li", void 0, org));
      }
    }
    const footer = append(card, $("p.sessions-policy-blocked-footer"));
    append(footer, document.createTextNode(localize("accountGate.contactAdmin", "Contact your administrator for more information.")));
    append(footer, document.createTextNode(" "));
    const learnMore = append(footer, $("a.sessions-policy-blocked-link"));
    learnMore.textContent = localize("accountGate.learnMore", "Learn more");
    learnMore.href = "https://code.visualstudio.com/docs/enterprise/overview";
    this._register(addDisposableListener(learnMore, EventType.CLICK, (e) => {
      e.preventDefault();
      this.openerService.open(URI.parse("https://code.visualstudio.com/docs/enterprise/overview"));
    }));
    const signInButton = this._register(new Button(card, { ...defaultButtonStyles }));
    signInButton.label = localize("accountGate.signIn", "Sign In");
    this._register(signInButton.onDidClick(() => {
      this.commandService.executeCommand("workbench.action.agenticSignIn");
    }));
  }
  _openVSCode() {
    const scheme = this.productService.parentPolicyConfig?.urlProtocol ?? this.productService.urlProtocol;
    this.openerService.open(URI.from({ scheme, query: "windowId=_blank" }), { openExternal: true });
  }
};
SessionsPolicyBlockedOverlay = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IWorkbenchLayoutService)
], SessionsPolicyBlockedOverlay);
export {
  SessionsBlockedReason,
  SessionsPolicyBlockedOverlay
};
