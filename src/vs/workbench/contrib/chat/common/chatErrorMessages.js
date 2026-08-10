import { localize } from "../../../../nls.js";
import { ChatEntitlement } from "../../../services/chat/common/chatEntitlementService.js";
import { ChatErrorLevel } from "./chatService/chatService.js";
var ChatFetchResponseType = /* @__PURE__ */ ((ChatFetchResponseType2) => {
  ChatFetchResponseType2["OffTopic"] = "offTopic";
  ChatFetchResponseType2["Canceled"] = "canceled";
  ChatFetchResponseType2["Filtered"] = "filtered";
  ChatFetchResponseType2["FilteredRetry"] = "filteredRetry";
  ChatFetchResponseType2["PromptFiltered"] = "promptFiltered";
  ChatFetchResponseType2["Length"] = "length";
  ChatFetchResponseType2["RateLimited"] = "rateLimited";
  ChatFetchResponseType2["QuotaExceeded"] = "quotaExceeded";
  ChatFetchResponseType2["ExtensionBlocked"] = "extensionBlocked";
  ChatFetchResponseType2["BadRequest"] = "badRequest";
  ChatFetchResponseType2["NotFound"] = "notFound";
  ChatFetchResponseType2["Failed"] = "failed";
  ChatFetchResponseType2["Unknown"] = "unknown";
  ChatFetchResponseType2["NetworkError"] = "networkError";
  ChatFetchResponseType2["AgentUnauthorized"] = "agent_unauthorized";
  ChatFetchResponseType2["AgentFailedDependency"] = "agent_failed_dependency";
  ChatFetchResponseType2["InvalidStatefulMarker"] = "invalid_stateful_marker";
  ChatFetchResponseType2["Success"] = "success";
  return ChatFetchResponseType2;
})(ChatFetchResponseType || {});
var FilterReason = /* @__PURE__ */ ((FilterReason2) => {
  FilterReason2["Hate"] = "hate";
  FilterReason2["SelfHarm"] = "self_harm";
  FilterReason2["Sexual"] = "sexual";
  FilterReason2["Violence"] = "violence";
  FilterReason2["Copyright"] = "snippy";
  FilterReason2["Prompt"] = "prompt";
  return FilterReason2;
})(FilterReason || {});
const RATE_LIMIT_LEARN_MORE_URL = "https://aka.ms/github-copilot-rate-limit-error";
const FILTERED_DOCS_URL = "https://aka.ms/copilot-chat-filtered-docs";
const GITHUB_SUPPORT_URL = "https://support.github.com/contact";
const CanceledMessage = { message: localize("chatError.canceled", "Canceled") };
function secondsToHumanReadableTime(seconds) {
  if (seconds < 90) {
    return localize("chatError.duration.seconds", "{0} seconds", seconds);
  }
  const minutes = Math.floor(seconds / 60);
  if (seconds <= 5400) {
    return localize("chatError.duration.minutes", "{0} minutes", minutes);
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes > 0) {
    return localize("chatError.duration.hoursMinutes", "{0} hours {1} minutes", hours, remainingMinutes);
  }
  return localize("chatError.duration.hours", "{0} hours", hours);
}
function getRateLimitMessage(fetchError, copilotPlan) {
  const retryAfterString = fetchError.retryAfter ? secondsToHumanReadableTime(fetchError.retryAfter) : localize("chatError.aMoment", "a moment");
  const code = fetchError.capiError?.code;
  if (code?.startsWith("agent_mode_limit_exceeded")) {
    return localize({ key: "chatError.rateLimit.agentMode", comment: [`{Locked=']({'}`] }, "Sorry, you have exceeded the agent mode rate limit. Please switch to ask mode and try again in {0}. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  if (code?.startsWith("model_overloaded") || code?.startsWith("upstream_provider_rate_limit")) {
    if (fetchError.isAuto) {
      return localize({ key: "chatError.rateLimit.overloadedAuto", comment: [`{Locked=']({'}`] }, "Sorry, the upstream model provider is currently experiencing high demand. Please try again in {0}. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
    }
    return localize({ key: "chatError.rateLimit.overloaded", comment: [`{Locked=']({'}`] }, "Sorry, the upstream model provider is currently experiencing high demand. Please try again in {0} or consider switching to Auto. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  if (code?.startsWith("user_global_rate_limited")) {
    if (copilotPlan === "free" || copilotPlan === "individual" || copilotPlan === "individual_pro" || copilotPlan === "edu") {
      return localize({ key: "chatError.rateLimit.sessionUpgrade", comment: [`{Locked=']({'}`] }, "You've hit your session rate limit. Please upgrade your plan or wait {0} for your limit to reset. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
    }
    return localize({ key: "chatError.rateLimit.session", comment: [`{Locked=']({'}`] }, "You've hit your session rate limit. Please wait {0} for your limit to reset. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  if (code?.startsWith("user_weekly_rate_limited")) {
    if (fetchError.retryAfter) {
      const resetDate = new Date(Date.now() + fetchError.retryAfter * 1e3);
      const resetDateString = resetDate.toLocaleString(void 0, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      if (fetchError.isAuto) {
        return localize({ key: "chatError.rateLimit.weeklyDateAuto", comment: [`{Locked=']({'}`] }, "You've reached your weekly rate limit. Please wait for your limit to reset on {0}. [Learn More]({1})", resetDateString, RATE_LIMIT_LEARN_MORE_URL);
      }
      return localize({ key: "chatError.rateLimit.weeklyDate", comment: [`{Locked=']({'}`] }, "You've reached your weekly rate limit. Please switch to the Auto model to continue working or wait for your limit to reset on {0}. [Learn More]({1})", resetDateString, RATE_LIMIT_LEARN_MORE_URL);
    }
    if (fetchError.isAuto) {
      return localize({ key: "chatError.rateLimit.weeklyAuto", comment: [`{Locked=']({'}`] }, "You've reached your weekly rate limit. Please wait {0} for your limit to reset. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
    }
    return localize({ key: "chatError.rateLimit.weekly", comment: [`{Locked=']({'}`] }, "You've reached your weekly rate limit. Please switch to the Auto model to continue working or wait {0} for your limit to reset. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  if (code?.startsWith("user_model_rate_limited")) {
    if (fetchError.isAuto) {
      return localize({ key: "chatError.rateLimit.modelAuto", comment: [`{Locked=']({'}`] }, "You've hit the rate limit for this model. Please try again in {0}. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
    }
    return localize({ key: "chatError.rateLimit.model", comment: [`{Locked=']({'}`] }, "You've hit the rate limit for this model. Please try switching to Auto or try again in {0}. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  if (code?.startsWith("integration_rate_limited")) {
    return localize({ key: "chatError.rateLimit.integration", comment: [`{Locked=']({'}`] }, "Sorry, GitHub Copilot Chat is currently experiencing high demand. Please try again in {0}. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  if (fetchError.capiError?.code && fetchError.capiError?.message) {
    if (fetchError.isAuto) {
      return localize({ key: "chatError.rateLimit.serverAuto", comment: [`{Locked=']({'}`] }, "Sorry, you have been rate-limited. Please wait {0} before trying again. [Learn More]({1})\n\nServer Error: {2}\nError Code: {3}", retryAfterString, RATE_LIMIT_LEARN_MORE_URL, fetchError.capiError.message, fetchError.capiError.code);
    }
    return localize({ key: "chatError.rateLimit.server", comment: [`{Locked=']({'}`] }, "Sorry, you have been rate-limited. Please wait {0} before trying again or consider switching to Auto. [Learn More]({1})\n\nServer Error: {2}\nError Code: {3}", retryAfterString, RATE_LIMIT_LEARN_MORE_URL, fetchError.capiError.message, fetchError.capiError.code);
  }
  if (fetchError.isAuto) {
    return localize({ key: "chatError.rateLimit.genericAuto", comment: [`{Locked=']({'}`] }, "Sorry, your request was rate-limited. Please wait {0} before trying again. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
  }
  return localize({ key: "chatError.rateLimit.generic", comment: [`{Locked=']({'}`] }, "Sorry, your request was rate-limited. Please wait {0} before trying again or consider switching to Auto. [Learn More]({1})", retryAfterString, RATE_LIMIT_LEARN_MORE_URL);
}
function getQuotaMessageForPlan(copilotPlan, isUsageBasedBilling, quotaResetDate) {
  const resetDateString = quotaResetDate ? new Date(quotaResetDate).toLocaleString(void 0, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : void 0;
  if (isUsageBasedBilling) {
    switch (copilotPlan) {
      case "free":
        return resetDateString ? localize("chatError.quota.ubb.freeDate", "You've reached your monthly credit limit. Upgrade to Copilot Pro or wait until your credits reset on {0}.", resetDateString) : localize("chatError.quota.ubb.free", "You've reached your monthly credit limit. Upgrade to Copilot Pro or wait for your credits to reset.");
      case "individual":
        return resetDateString ? localize("chatError.quota.ubb.individualDate", "You've reached your monthly credit limit. Please enable additional paid credits, upgrade to Copilot Pro+, or wait until your credits reset on {0}.", resetDateString) : localize("chatError.quota.ubb.individual", "You've reached your monthly credit limit. Please enable additional paid credits, upgrade to Copilot Pro+, or wait for your credits to reset.");
      case "edu":
        return resetDateString ? localize("chatError.quota.ubb.eduDate", "You've reached your monthly credit limit. Please enable additional paid credits, upgrade to Copilot Pro, or wait until your credits reset on {0}.", resetDateString) : localize("chatError.quota.ubb.edu", "You've reached your monthly credit limit. Please enable additional paid credits, upgrade to Copilot Pro, or wait for your credits to reset.");
      case "individual_pro":
      case "individual_max":
        return resetDateString ? localize("chatError.quota.ubb.proDate", "You've reached your monthly credit limit. Please enable additional paid credits or wait until your credits reset on {0}.", resetDateString) : localize("chatError.quota.ubb.pro", "You've reached your monthly credit limit. Please enable additional paid credits or wait for your credits to reset.");
      case "business":
      case "enterprise":
        return resetDateString ? localize("chatError.quota.ubb.businessDate", "You've reached your credit limit. To continue working, please contact your organization's Copilot admin or wait until your credits reset on {0}.", resetDateString) : localize("chatError.quota.ubb.business", "You've reached your credit limit. To continue working, please contact your organization's Copilot admin or wait for your credits to reset.");
      default:
        return resetDateString ? localize("chatError.quota.ubb.defaultDate", "You've reached your credit limit. For additional paid credits, please reach out to your organization's Copilot admin or wait until your credits reset on {0}.", resetDateString) : localize("chatError.quota.ubb.default", "You've reached your credit limit. For additional paid credits, please reach out to your organization's Copilot admin or wait for your credits to reset.");
    }
  }
  switch (copilotPlan) {
    case "free":
      return localize("chatError.quota.free", "You've reached your monthly chat messages quota. Upgrade to Copilot Pro or wait for your allowance to renew.");
    case "individual":
      return localize("chatError.quota.individual", "You've exhausted your premium model quota. Please enable additional paid premium requests, upgrade to Copilot Pro+, or wait for your allowance to renew.");
    case "edu":
      return localize("chatError.quota.edu", "You've exhausted your premium model quota. Please enable additional paid premium requests, upgrade to Copilot Pro, or wait for your allowance to renew.");
    case "individual_pro":
    case "individual_max":
      return localize("chatError.quota.pro", "You've exhausted your premium model quota. Please enable additional paid premium requests or wait for your allowance to renew.");
    case "business":
    case "enterprise":
      return localize("chatError.quota.business", "You've exhausted your credits. To continue working, please contact your organization's Copilot admin or wait for your allowance to renew.");
    default:
      return localize("chatError.quota.default", "You've exhausted your premium model quota. For additional paid premium requests, please reach out to your organization's Copilot admin or wait for your allowance to renew.");
  }
}
function getQuotaHitMessage(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate) {
  let code = fetchError.capiError?.code;
  if (code === "free_quota_exceeded") {
    code = "quota_exceeded";
  }
  if (code === "quota_exceeded") {
    return getQuotaMessageForPlan(copilotPlan, isUsageBasedBilling, quotaResetDate);
  } else if (code === "overage_limit_reached") {
    return localize({ key: "chatError.quota.overage", comment: [`{Locked=']({'}`] }, "You cannot accrue additional premium requests at this time. Please contact [GitHub Support]({0}) to continue using Copilot.", GITHUB_SUPPORT_URL);
  } else if (code === "additional_spend_limit_reached") {
    return localize("chatError.quota.additionalSpend", "You've reached your additional usage limit for your plan. Upgrade your plan to keep going.");
  } else if (code === "billing_not_configured" && fetchError.capiError?.message) {
    return fetchError.capiError.message;
  } else if (fetchError.capiError?.code && fetchError.capiError?.message) {
    return localize("chatError.quota.server", "Quota Exceeded\n\nServer Error: {0}\nError Code: {1}", fetchError.capiError.message, fetchError.capiError.code);
  } else {
    return localize("chatError.quota.generic", "Quota Exceeded");
  }
}
function getFilteredMessage(category, supportsMarkdown = true) {
  switch (category) {
    case "snippy" /* Copyright */:
      if (supportsMarkdown) {
        return localize({ key: "chatError.filtered.copyrightMd", comment: [`{Locked='](https://aka.ms/copilot-chat-filtered-docs)'}`] }, "Sorry, the response matched public code so it was blocked. Please rephrase your prompt. [Learn more]({0}).", FILTERED_DOCS_URL);
      }
      return localize("chatError.filtered.copyright", "Sorry, the response matched public code so it was blocked. Please rephrase your prompt.");
    case "prompt" /* Prompt */:
      if (supportsMarkdown) {
        return localize({ key: "chatError.filtered.promptMd", comment: [`{Locked='](https://aka.ms/copilot-chat-filtered-docs)'}`] }, "Sorry, your prompt was filtered by the Responsible AI Service. Please rephrase your prompt and try again. [Learn more]({0}).", FILTERED_DOCS_URL);
      }
      return localize("chatError.filtered.prompt", "Sorry, your prompt was filtered by the Responsible AI Service. Please rephrase your prompt and try again.");
    default:
      if (supportsMarkdown) {
        return localize({ key: "chatError.filtered.defaultMd", comment: [`{Locked='](https://aka.ms/copilot-chat-filtered-docs)'}`] }, "Sorry, the response was filtered by the Responsible AI Service. Please rephrase your prompt and try again. [Learn more]({0}).", FILTERED_DOCS_URL);
      }
      return localize("chatError.filtered.default", "Sorry, the response was filtered by the Responsible AI Service. Please rephrase your prompt and try again.");
  }
}
function getChatErrorDetailsFromFetchError(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate) {
  return { code: fetchError.type, ...getChatErrorDetailsInner(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate) };
}
function getChatErrorDetailsInner(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate) {
  const requestId = fetchError.requestId ?? "";
  const reason = fetchError.reason ?? "";
  switch (fetchError.type) {
    case "offTopic" /* OffTopic */:
      return { message: localize("chatError.offTopic", "Sorry, but I can only assist with programming related questions.") };
    case "canceled" /* Canceled */:
      return CanceledMessage;
    case "rateLimited" /* RateLimited */:
      return {
        message: getRateLimitMessage(fetchError, copilotPlan),
        level: ChatErrorLevel.Info,
        isRateLimited: true
      };
    case "quotaExceeded" /* QuotaExceeded */:
      return {
        message: getQuotaHitMessage(fetchError, copilotPlan, isUsageBasedBilling, quotaResetDate),
        isQuotaExceeded: true,
        ...fetchError.capiError?.code && { code: fetchError.capiError.code }
      };
    case "badRequest" /* BadRequest */:
    case "failed" /* Failed */:
      return fetchError.serverRequestId ? { message: localize("chatError.failedWithServerId", "Sorry, your request failed. Please try again.\n\nClient Request Id: {0}\n\nGH Request Id: {1}\n\nReason: {2}", requestId, fetchError.serverRequestId, reason) } : { message: localize("chatError.failed", "Sorry, your request failed. Please try again.\n\nClient Request Id: {0}\n\nReason: {1}", requestId, reason) };
    case "networkError" /* NetworkError */:
      return { message: localize("chatError.network", "Sorry, there was a network error. Please try again later. Request id: {0}\n\nReason: {1}", requestId, reason) };
    case "filtered" /* Filtered */:
    case "promptFiltered" /* PromptFiltered */:
      return {
        message: getFilteredMessage(fetchError.category ?? ""),
        responseIsFiltered: true,
        level: ChatErrorLevel.Info
      };
    case "agent_unauthorized" /* AgentUnauthorized */:
      return { message: localize("chatError.somethingWrong", "Sorry, something went wrong.") };
    case "agent_failed_dependency" /* AgentFailedDependency */:
      return { message: reason };
    case "length" /* Length */:
      return { message: localize("chatError.length", "Sorry, the response hit the length limit. Please rephrase your prompt.") };
    case "notFound" /* NotFound */:
      return { message: localize("chatError.notFound", "Sorry, the resource was not found.") };
    case "unknown" /* Unknown */:
      return { message: localize("chatError.unknown", "Sorry, no response was returned.") };
    case "extensionBlocked" /* ExtensionBlocked */:
      return { message: localize("chatError.extensionBlocked", "Sorry, something went wrong.") };
    case "invalid_stateful_marker" /* InvalidStatefulMarker */:
      return { message: localize("chatError.invalidStatefulMarker", "Your chat session state is invalid, please start a new chat.") };
    default:
      return { message: reason || localize("chatError.somethingWrong", "Sorry, something went wrong.") };
  }
}
function isForwardedChatError(value) {
  return !!value && typeof value === "object" && "fetchError" in value && !!value.fetchError && typeof value.fetchError === "object" && typeof value.fetchError.type === "string";
}
function getChatErrorDetailsFromMeta(error, context) {
  const meta = error?._meta;
  const chatError = meta?.chatError;
  if (!isForwardedChatError(chatError)) {
    return void 0;
  }
  return getChatErrorDetailsFromFetchError(
    chatError.fetchError,
    context?.copilotPlan ?? chatError.copilotPlan,
    context?.isUsageBasedBilling ?? chatError.isUsageBasedBilling,
    context?.quotaResetDate ?? chatError.quotaResetDate
  );
}
function getCopilotPlanFromEntitlement(entitlement) {
  switch (entitlement) {
    case ChatEntitlement.Free:
      return "free";
    case ChatEntitlement.Pro:
      return "individual";
    case ChatEntitlement.ProPlus:
      return "individual_pro";
    case ChatEntitlement.Max:
      return "individual_max";
    case ChatEntitlement.Business:
      return "business";
    case ChatEntitlement.Enterprise:
      return "enterprise";
    case ChatEntitlement.EDU:
      return "edu";
    default:
      return void 0;
  }
}
export {
  ChatFetchResponseType,
  FilterReason,
  getChatErrorDetailsFromFetchError,
  getChatErrorDetailsFromMeta,
  getCopilotPlanFromEntitlement,
  getFilteredMessage,
  getQuotaMessageForPlan
};
