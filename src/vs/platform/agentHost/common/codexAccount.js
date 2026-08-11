const CODEX_ACCOUNT_META_KEY = "vscode.codexAccount";
const CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY = "vscode.codexAccount.signInRequest";
const CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY = "vscode.codexAccount.signOutRequest";
function readCodexAccountInfo(state) {
  const metaValue = state?._meta?.[CODEX_ACCOUNT_META_KEY];
  const value = state?.config?.values[CODEX_ACCOUNT_META_KEY] ?? metaValue;
  if (!value || typeof value !== "object") {
    return { status: "unknown" };
  }
  const account = value;
  if (account.status !== "unknown" && account.status !== "signedIn" && account.status !== "signedOut" && account.status !== "unavailable" && account.status !== "error") {
    return { status: "unknown" };
  }
  const rateLimit = account.rateLimit;
  const validRateLimit = rateLimit && typeof rateLimit === "object" && typeof rateLimit.usedPercent === "number" && Number.isFinite(rateLimit.usedPercent) && rateLimit.usedPercent >= 0 && rateLimit.usedPercent <= 100 && (rateLimit.windowDurationMins === void 0 || typeof rateLimit.windowDurationMins === "number" && Number.isFinite(rateLimit.windowDurationMins) && rateLimit.windowDurationMins > 0) && (rateLimit.resetsAt === void 0 || typeof rateLimit.resetsAt === "number" && Number.isFinite(rateLimit.resetsAt) && rateLimit.resetsAt > 0);
  return {
    status: account.status,
    email: typeof account.email === "string" ? account.email : void 0,
    planType: typeof account.planType === "string" ? account.planType : void 0,
    requiresOpenaiAuth: typeof account.requiresOpenaiAuth === "boolean" ? account.requiresOpenaiAuth : void 0,
    rateLimit: validRateLimit ? {
      usedPercent: rateLimit.usedPercent,
      windowDurationMins: rateLimit.windowDurationMins,
      resetsAt: rateLimit.resetsAt
    } : void 0,
    authUrl: typeof account.authUrl === "string" ? account.authUrl : void 0,
    authUrlNonce: typeof account.authUrlNonce === "string" ? account.authUrlNonce : void 0
  };
}
export {
  CODEX_ACCOUNT_META_KEY,
  CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY,
  CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY,
  readCodexAccountInfo
};
