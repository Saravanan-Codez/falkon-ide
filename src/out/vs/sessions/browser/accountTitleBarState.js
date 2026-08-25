import { Codicon } from "../../base/common/codicons.js";
import { ThemeIcon } from "../../base/common/themables.js";
import { localize } from "../../nls.js";
import { ChatEntitlement } from "../../workbench/services/chat/common/chatEntitlementService.js";
async function resolveAccountInfo(defaultAccountService, authenticationService) {
  const account = await defaultAccountService.getDefaultAccount();
  if (account) {
    return {
      accountName: account.accountName,
      accountProviderId: account.authenticationProvider.id,
      accountProviderLabel: account.authenticationProvider.name
    };
  }
  try {
    const sessions = await authenticationService.getSessions("github");
    if (sessions.length > 0) {
      return {
        accountName: sessions[0].account.label,
        accountProviderId: "github",
        accountProviderLabel: "GitHub"
      };
    }
  } catch {
  }
  return void 0;
}
function getAccountProfileImageUrl(accountProviderId, accountName) {
  if (accountProviderId !== "github" || !accountName?.trim()) {
    return void 0;
  }
  return `https://github.com/${encodeURIComponent(accountName.trim())}.png?size=64`;
}
function getAccountTitleBarBadgeKey(state) {
  if (!state.dotBadge) {
    return void 0;
  }
  return `${state.source}:${state.dotBadge}:${state.badge ?? ""}`;
}
function getAccountTitleBarState(context) {
  if (context.isAccountLoading) {
    return {
      source: "account",
      kind: "default",
      icon: ThemeIcon.modify(Codicon.loading, "spin"),
      label: localize("loadingAccount", "Loading Account..."),
      ariaLabel: localize("loadingAccountAria", "Loading account"),
      revealLabelOnHover: true
    };
  }
  const copilotState = getCopilotPresentation(context.entitlement, context.sentiment, context.quotas, context.usableWithoutGitHub);
  if (copilotState) {
    return copilotState;
  }
  if (context.accountName) {
    return {
      source: "account",
      kind: "default",
      icon: Codicon.account,
      label: context.accountName,
      revealLabelOnHover: true,
      ariaLabel: context.accountProviderLabel ? localize("accountSignedInAria", "Signed in as {0} with {1}", context.accountName, context.accountProviderLabel) : localize("accountSignedInAriaNameOnly", "Signed in as {0}", context.accountName)
    };
  }
  return {
    source: "account",
    kind: "prominent",
    icon: Codicon.account,
    label: localize("signInLabel", "Sign In"),
    ariaLabel: localize("signInAria", "Sign in to your account")
  };
}
function getCopilotPresentation(entitlement, sentiment, quotas, usableWithoutGitHub) {
  if (sentiment.hidden) {
    return void 0;
  }
  if (entitlement === ChatEntitlement.Unknown) {
    if (usableWithoutGitHub) {
      return {
        source: "copilot",
        kind: "default",
        icon: Codicon.account,
        label: localize("agentsSignInOptional", "Sign In"),
        ariaLabel: localize("agentsSignInOptionalAria", "Sign in to GitHub to use more agents")
      };
    }
    return {
      source: "copilot",
      kind: "prominent",
      icon: Codicon.account,
      label: localize("agentsSignedOut", "Agents Signed Out"),
      ariaLabel: localize("agentsSignedOutAria", "Agents is signed out")
    };
  }
  if (sentiment.disabled || sentiment.untrusted) {
    return {
      source: "copilot",
      kind: "warning",
      icon: Codicon.account,
      label: localize("copilotUnavailable", "Copilot Unavailable"),
      ariaLabel: sentiment.untrusted ? localize("copilotUnavailableUntrustedAria", "GitHub Copilot is unavailable in untrusted workspaces") : localize("copilotUnavailableDisabledAria", "GitHub Copilot is disabled")
    };
  }
  const chatQuotaExceeded = quotas.chat?.percentRemaining === 0;
  const completionsQuotaExceeded = quotas.completions?.percentRemaining === 0;
  if (entitlement === ChatEntitlement.Free && (chatQuotaExceeded || completionsQuotaExceeded)) {
    return {
      source: "copilot",
      kind: "warning",
      icon: Codicon.account,
      label: localize("copilotQuotaReached", "Quota Reached"),
      dotBadge: "error",
      ariaLabel: getQuotaReachedAriaLabel(chatQuotaExceeded, completionsQuotaExceeded)
    };
  }
  const remainingPercent = getLowestPositivePercent(quotas.chat, quotas.completions);
  if (entitlement === ChatEntitlement.Free && typeof remainingPercent === "number" && remainingPercent <= 25) {
    return {
      source: "copilot",
      kind: remainingPercent <= 10 ? "warning" : "accent",
      icon: Codicon.account,
      label: localize("copilotTokensRemaining", "Tokens Remaining"),
      badge: `${remainingPercent}%`,
      dotBadge: remainingPercent <= 10 ? "error" : "warning",
      ariaLabel: localize("copilotTokensRemainingAria", "{0}% GitHub Copilot tokens remaining", remainingPercent)
    };
  }
  return void 0;
}
function getLowestPositivePercent(...quotas) {
  let lowest;
  for (const quota of quotas) {
    if (typeof quota?.percentRemaining !== "number" || quota.percentRemaining <= 0) {
      continue;
    }
    lowest = typeof lowest === "number" ? Math.min(lowest, quota.percentRemaining) : quota.percentRemaining;
  }
  return lowest;
}
function getQuotaReachedAriaLabel(chatQuotaExceeded, completionsQuotaExceeded) {
  if (chatQuotaExceeded && completionsQuotaExceeded) {
    return localize("copilotAllQuotaReachedAria", "GitHub Copilot chat and inline suggestion quota reached");
  }
  if (chatQuotaExceeded) {
    return localize("copilotChatQuotaReachedAria", "GitHub Copilot chat quota reached");
  }
  return localize("copilotCompletionsQuotaReachedAria", "GitHub Copilot inline suggestion quota reached");
}
export {
  getAccountProfileImageUrl,
  getAccountTitleBarBadgeKey,
  getAccountTitleBarState,
  resolveAccountInfo
};
