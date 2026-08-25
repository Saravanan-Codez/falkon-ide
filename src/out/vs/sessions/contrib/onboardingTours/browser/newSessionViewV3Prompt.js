import { raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { format } from "../../../../base/common/strings.js";
import { localize } from "../../../../nls.js";
import { getGitHubRemoteInfo } from "../../../../workbench/contrib/git/common/utils.js";
import { getOnboardingDeveloperModeVariation, isOnboardingDeveloperModeEnabled, ONBOARDING_DEVELOPER_MODE_VARIATIONS_CONFIG } from "../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js";
import { isAgentHostProviderId } from "../../../common/agentHostSessionsProvider.js";
import { NEW_SESSION_PROMPT_TYPING_DURATION_MS } from "../../chat/browser/newSessionComposerService.js";
import { getGitHubRepositoryFromUri } from "../../github/common/utils.js";
import { GitHubAuthenticationError } from "../../github/browser/githubApiClient.js";
import { computeIssueIcon, computePullRequestIcon, GitHubIssueState, GitHubPullRequestState } from "../../github/common/types.js";
import { resolveGitHubRepositoryFromGitConfig } from "./gitHubRepositoryResolver.js";
import { NEW_SESSION_VIEW_V3_GITHUB_PROMPT_VARIATION, NEW_SESSION_VIEW_V3_OPTIONS_VARIATION, NEW_SESSION_VIEW_V3_PROMPT_VARIATION, NEW_SESSION_VIEW_V3_TOUR_ID, NEW_SESSION_VIEW_V3_VARIATION_TREATMENT } from "./tours/newSessionViewV3Tour.js";
const DEFAULT_GITHUB_LOOKUP_TIMEOUTS = {
  totalMs: 6e3,
  summaryMs: 2500,
  linkageMs: 1500,
  reviewMs: 2500
};
const LOG_PREFIX = "[NewSessionViewV3Prompt]";
const PROMPT_TEMPLATE_TREATMENT = "onb.newSessionViewV3.promptTemplate";
const PLACEHOLDER_TREATMENT = "onb.newSessionViewV3.placeholder";
const DEFAULT_TASK_PLACEHOLDER = localize("sessions.onboarding.newSessionViewV3.prompt.taskPlaceholder", "[describe the coding task]");
const DEFAULT_PROMPT_TEMPLATE = localize("sessions.onboarding.newSessionViewV3.prompt.text", "Help me complete {0} in this project. First, inspect the relevant files and explain your approach briefly. Then implement the solution using existing project conventions, avoid unrelated changes, and run the most relevant tests or checks. If anything is unclear, make a reasonable assumption and state it. When finished, summarize what changed and mention any remaining issues.");
const PROMPT_OPTION_COUNT = 3;
class NewSessionViewV3PromptRunner {
  constructor(_assignmentService, _configurationService, _sessionsService, _newSessionComposerService, _gitService, _fileService, _gitHubService, _telemetryService, _logService, gitHubLookupTimeouts = {}) {
    this._assignmentService = _assignmentService;
    this._configurationService = _configurationService;
    this._sessionsService = _sessionsService;
    this._newSessionComposerService = _newSessionComposerService;
    this._gitService = _gitService;
    this._fileService = _fileService;
    this._gitHubService = _gitHubService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._gitHubLookupTimeouts = { ...DEFAULT_GITHUB_LOOKUP_TIMEOUTS, ...gitHubLookupTimeouts };
  }
  async run(token) {
    this._logService.info(`${LOG_PREFIX} Starting V3 prompt resolution.`);
    const configuredVariation = await this._resolveConfiguredVariation();
    if (token.isCancellationRequested) {
      this._logService.trace(`${LOG_PREFIX} Prompt resolution was cancelled after resolving the configured variation.`);
      return false;
    }
    if (configuredVariation === "options" || configuredVariation === "unknown") {
      return this._runPromptOptions(configuredVariation, token, configuredVariation === "unknown" ? "unsupportedVariation" : void 0);
    }
    const plan = configuredVariation === "githubPrompt" ? await this._resolveGitHubPromptWithFallback(token) : await this._resolvePrompt("none");
    if (token.isCancellationRequested) {
      this._logService.trace(`${LOG_PREFIX} Prompt resolution was cancelled before prompt insertion.`);
      return false;
    }
    this._logService.info(`${LOG_PREFIX} Resolved effective strategy '${plan.effectiveStrategy}' with fallback reason '${plan.fallbackReason}'.`);
    const shown = await this._animatePrompt(plan.prompt, plan.taskPlaceholder, token);
    this._logService.info(`${LOG_PREFIX} Prompt insertion completed with shown=${shown}.`);
    this._reportStrategy(configuredVariation, plan.effectiveStrategy, plan.fallbackReason, shown);
    return shown;
  }
  async _resolveConfiguredVariation() {
    const developerModeEnabled = isOnboardingDeveloperModeEnabled(this._configurationService, NEW_SESSION_VIEW_V3_TOUR_ID);
    const developerVariations = this._configurationService.getValue(ONBOARDING_DEVELOPER_MODE_VARIATIONS_CONFIG);
    const configuredDeveloperVariation = typeof developerVariations === "object" && developerVariations !== null ? developerVariations[NEW_SESSION_VIEW_V3_TOUR_ID] : void 0;
    const developerVariation = getOnboardingDeveloperModeVariation(this._configurationService, NEW_SESSION_VIEW_V3_TOUR_ID);
    if (configuredDeveloperVariation && !developerModeEnabled) {
      this._logService.warn(`${LOG_PREFIX} Ignoring developer variation '${configuredDeveloperVariation}' because developer mode is not enabled for '${NEW_SESSION_VIEW_V3_TOUR_ID}'.`);
    }
    if (developerVariation) {
      this._logService.info(`${LOG_PREFIX} Using developer variation '${developerVariation}'.`);
      return this._normalizeVariation(developerVariation, "developer setting");
    }
    this._logService.trace(`${LOG_PREFIX} No active developer variation; resolving treatment '${NEW_SESSION_VIEW_V3_VARIATION_TREATMENT}'.`);
    const treatmentVariation = await this._assignmentService.getTreatment(NEW_SESSION_VIEW_V3_VARIATION_TREATMENT);
    this._logService.info(`${LOG_PREFIX} Treatment variation resolved to '${treatmentVariation || NEW_SESSION_VIEW_V3_OPTIONS_VARIATION}'.`);
    return this._normalizeVariation(treatmentVariation, "treatment");
  }
  _normalizeVariation(variation, source) {
    if (variation === void 0 || variation === "" || variation === NEW_SESSION_VIEW_V3_OPTIONS_VARIATION) {
      return "options";
    }
    if (variation === NEW_SESSION_VIEW_V3_PROMPT_VARIATION) {
      return "prompt";
    }
    if (variation === NEW_SESSION_VIEW_V3_GITHUB_PROMPT_VARIATION) {
      return "githubPrompt";
    }
    this._logService.warn(`${LOG_PREFIX} Unsupported variation '${variation}' from ${source}; using '${NEW_SESSION_VIEW_V3_OPTIONS_VARIATION}'.`);
    return "unknown";
  }
  async _runPromptOptions(configuredVariation, token, configuredFallbackReason) {
    const composer = this._getActiveComposer();
    if (!composer) {
      this._logService.warn(`${LOG_PREFIX} Skipping prompt options because no active new-session composer is available.`);
      this._reportStrategy(configuredVariation, "options", "noCandidate", false);
      return false;
    }
    let latestPlan;
    const resolveOptions = async (refreshToken) => {
      latestPlan = await this._resolveGitHubPromptOptionsWithFallback(refreshToken);
      return { kind: "resolved", options: latestPlan.options };
    };
    if (composer.setPromptOptionsResolver && composer.refreshPromptOptions) {
      composer.setPromptOptionsResolver(resolveOptions);
      this._logService.info(`${LOG_PREFIX} Showing prompt option loading skeletons.`);
      const shown2 = await composer.refreshPromptOptions(token);
      const fallbackReason2 = configuredFallbackReason ?? latestPlan?.fallbackReason ?? (token.isCancellationRequested ? "requestFailed" : "noCandidate");
      this._logService.info(`${LOG_PREFIX} Prompt options completed with shown=${shown2} and fallback reason '${fallbackReason2}'.`);
      this._reportStrategy(configuredVariation, "options", fallbackReason2, shown2);
      return shown2;
    }
    if (!composer.showPromptOptions({ kind: "loading" })) {
      this._logService.warn(`${LOG_PREFIX} Skipping prompt options because the active new-session composer cannot show them.`);
      this._reportStrategy(configuredVariation, "options", "noCandidate", false);
      return false;
    }
    this._logService.info(`${LOG_PREFIX} Showing prompt option loading skeletons.`);
    const state = await resolveOptions(token);
    if (token.isCancellationRequested || this._newSessionComposerService.activeComposer.get() !== composer || this._sessionsService.activeSession.get()?.isCreated.get()) {
      composer.showPromptOptions(void 0);
      this._logService.trace(`${LOG_PREFIX} Prompt option resolution was cancelled or its composer is no longer active.`);
      this._reportStrategy(configuredVariation, "options", configuredFallbackReason ?? latestPlan?.fallbackReason ?? "requestFailed", false);
      return false;
    }
    const shown = composer.showPromptOptions(state);
    const fallbackReason = configuredFallbackReason ?? latestPlan?.fallbackReason ?? "noCandidate";
    this._logService.info(`${LOG_PREFIX} Prompt options completed with shown=${shown} and fallback reason '${fallbackReason}'.`);
    this._reportStrategy(configuredVariation, "options", fallbackReason, shown);
    return shown;
  }
  _getActiveComposer() {
    const activeSession = this._sessionsService.activeSession.get();
    if (activeSession?.isCreated.get()) {
      return void 0;
    }
    return this._newSessionComposerService.activeComposer.get();
  }
  async _resolveGitHubPromptOptionsWithFallback(token) {
    this._logService.info(`${LOG_PREFIX} Starting GitHub prompt option lookup with a ${this._gitHubLookupTimeouts.totalMs}ms total timeout.`);
    const operationCts = new CancellationTokenSource(token);
    let latestProgress;
    let timedOut = false;
    const createTimeoutPlan = () => {
      const candidates = latestProgress && this._isCurrentRepositoryContext(latestProgress.context) ? [...latestProgress.issueCandidates, ...latestProgress.pullRequestCandidates] : [];
      return this._createPromptOptionsPlan(candidates.slice(0, PROMPT_OPTION_COUNT), candidates.length === PROMPT_OPTION_COUNT ? "none" : "timeout");
    };
    try {
      const result = await raceTimeout(
        this._resolveGitHubPromptOptions(operationCts.token, (progress) => latestProgress = progress),
        this._gitHubLookupTimeouts.totalMs,
        () => {
          timedOut = true;
          this._logService.warn(`${LOG_PREFIX} GitHub prompt option lookup timed out after ${this._gitHubLookupTimeouts.totalMs}ms; filling with standard options.`);
          operationCts.cancel();
        }
      );
      if (timedOut || !result) {
        return createTimeoutPlan();
      }
      if (result.kind === "fallback") {
        return this._createPromptOptionsPlan([], result.reason);
      }
      const candidates = [...result.issueCandidates, ...result.pullRequestCandidates].slice(0, PROMPT_OPTION_COUNT);
      const fallbackReason = candidates.length === PROMPT_OPTION_COUNT ? "none" : getLookupFallbackReason(result.failures);
      return this._createPromptOptionsPlan(candidates, fallbackReason);
    } catch (error) {
      if (isCancellationError(error) && timedOut) {
        return createTimeoutPlan();
      }
      if (isCancellationError(error) && token.isCancellationRequested) {
        this._logService.trace(`${LOG_PREFIX} GitHub prompt option lookup was cancelled by the onboarding flow.`);
        return this._createPromptOptionsPlan([], "requestFailed");
      }
      if (error instanceof GitHubAuthenticationError) {
        this._logService.warn(`${LOG_PREFIX} No existing GitHub authentication session is available; filling with standard options without requesting sign-in.`);
        return this._createPromptOptionsPlan([], "noAuthentication");
      }
      this._logService.error(`${LOG_PREFIX} GitHub prompt option lookup failed; filling with standard options.`, error);
      return this._createPromptOptionsPlan([], "requestFailed");
    } finally {
      operationCts.dispose();
    }
  }
  async _resolveGitHubPromptOptions(token, reportProgress) {
    while (!token.isCancellationRequested) {
      const context = await this._resolveGitHubRepository(token);
      if (!context) {
        this._logService.warn(`${LOG_PREFIX} Could not resolve a GitHub repository for prompt options.`);
        return { kind: "fallback", reason: "noRepository" };
      }
      const lookupCts = new CancellationTokenSource(token);
      try {
        const owner = context.repository.owner;
        const repo = context.repository.repo;
        let issueResult;
        let pullRequestResult;
        const publishProgress = () => {
          if (this._isCurrentRepositoryContext(context)) {
            reportProgress({
              context,
              issueCandidates: issueResult?.candidates ?? [],
              pullRequestCandidates: pullRequestResult?.candidates ?? [],
              failures: [...issueResult?.failures ?? [], ...pullRequestResult?.failures ?? []]
            });
          }
        };
        publishProgress();
        const resolveIssues = async () => {
          issueResult = await this._resolveIssuePromptOptionCandidates(owner, repo, lookupCts.token);
          publishProgress();
          return issueResult;
        };
        const resolvePullRequests = async () => {
          pullRequestResult = await this._resolvePullRequestPromptOptionCandidates(owner, repo, lookupCts.token, (candidates) => {
            pullRequestResult = { candidates, failures: [] };
            publishProgress();
          });
          publishProgress();
          return pullRequestResult;
        };
        const [issues, pullRequests] = await Promise.all([
          resolveIssues(),
          resolvePullRequests()
        ]);
        if (!this._isCurrentRepositoryContext(context)) {
          this._logService.info(`${LOG_PREFIX} The selected workspace changed during prompt option lookup; retrying for the current workspace.`);
          continue;
        }
        return {
          kind: "candidates",
          issueCandidates: issues.candidates,
          pullRequestCandidates: pullRequests.candidates,
          failures: [...issues.failures, ...pullRequests.failures]
        };
      } finally {
        lookupCts.dispose(true);
      }
    }
    return { kind: "fallback", reason: "noRepository" };
  }
  async _resolveIssuePromptOptionCandidates(owner, repo, token) {
    const outcome = await this._resolveIssueCandidates(owner, repo, token);
    if (outcome.kind === "failure") {
      return { candidates: [], failures: [outcome.reason] };
    }
    const candidates = [...outcome.value].sort(compareUpdatedAtDescending).slice(0, 2).map((issue) => ({ number: issue.number, title: issue.title, url: issue.url, strategy: "githubIssue" }));
    return { candidates, failures: [] };
  }
  async _resolvePullRequestPromptOptionCandidates(owner, repo, token, reportCandidates = () => void 0) {
    const summary = await this._runGitHubLookup(
      "authored pull request summaries",
      this._gitHubLookupTimeouts.summaryMs,
      token,
      (lookupToken) => this._gitHubService.getRecentAuthoredPullRequests(owner, repo, lookupToken)
    );
    if (summary.kind === "failure") {
      return { candidates: [], failures: [summary.reason] };
    }
    const pullRequests = [...summary.value].sort(compareUpdatedAtDescending);
    const failingPullRequests = pullRequests.filter(isFailingPullRequest);
    const candidates = failingPullRequests.slice(0, 2).map((pullRequest) => toCandidate(pullRequest, "githubCiFailure"));
    reportCandidates(candidates);
    if (candidates.length === 2) {
      return { candidates, failures: [] };
    }
    const failingPullRequestNumbers = new Set(failingPullRequests.map((pullRequest) => pullRequest.number));
    const reviewPullRequests = pullRequests.filter((pullRequest) => !failingPullRequestNumbers.has(pullRequest.number));
    const completedReviewCandidates = /* @__PURE__ */ new Map();
    const publishCandidates = () => {
      const orderedReviewCandidates = reviewPullRequests.map((pullRequest) => completedReviewCandidates.get(pullRequest.number)).filter((candidate) => candidate !== void 0);
      reportCandidates([...candidates, ...orderedReviewCandidates].slice(0, 2));
    };
    const reviewLookup = await this._resolveReviewCandidates(
      owner,
      repo,
      reviewPullRequests,
      token,
      (candidate) => {
        completedReviewCandidates.set(candidate.number, candidate);
        publishCandidates();
      }
    );
    return {
      candidates: [...candidates, ...reviewLookup.candidates].slice(0, 2),
      failures: reviewLookup.failures
    };
  }
  async _resolveGitHubPromptWithFallback(token) {
    this._logService.info(`${LOG_PREFIX} Starting GitHub prompt lookup with a ${this._gitHubLookupTimeouts.totalMs}ms total timeout.`);
    const operationCts = new CancellationTokenSource(token);
    let timedOut = false;
    try {
      const result = await raceTimeout(
        this._resolveGitHubPrompt(operationCts.token),
        this._gitHubLookupTimeouts.totalMs,
        () => {
          timedOut = true;
          this._logService.warn(`${LOG_PREFIX} GitHub prompt lookup timed out after ${this._gitHubLookupTimeouts.totalMs}ms; using the prompt variation.`);
          operationCts.cancel();
        }
      );
      if (timedOut) {
        return this._resolvePrompt("timeout");
      }
      if (!result) {
        return this._resolvePrompt("timeout");
      }
      if (result.kind === "fallback") {
        this._logService.warn(`${LOG_PREFIX} GitHub prompt lookup requested fallback '${result.reason}'; using the prompt variation.`);
        return this._resolvePrompt(result.reason);
      }
      this._logService.info(`${LOG_PREFIX} Selected GitHub candidate strategy '${result.candidate.strategy}'.`);
      return this._createGitHubPrompt(result.candidate);
    } catch (error) {
      if (isCancellationError(error) && timedOut) {
        return this._resolvePrompt("timeout");
      }
      if (isCancellationError(error) && token.isCancellationRequested) {
        this._logService.trace(`${LOG_PREFIX} GitHub prompt lookup was cancelled by the onboarding flow.`);
        return this._resolvePrompt("requestFailed");
      }
      if (error instanceof GitHubAuthenticationError) {
        this._logService.warn(`${LOG_PREFIX} No existing GitHub authentication session is available; using the prompt variation without requesting sign-in.`);
        return this._resolvePrompt("noAuthentication");
      }
      this._logService.error(`${LOG_PREFIX} GitHub prompt lookup failed; using the prompt variation.`, error);
      return this._resolvePrompt("requestFailed");
    } finally {
      operationCts.dispose();
    }
  }
  async _resolveGitHubPrompt(token) {
    while (!token.isCancellationRequested) {
      const context = await this._resolveGitHubRepository(token);
      if (!context) {
        this._logService.warn(`${LOG_PREFIX} Could not resolve a GitHub repository for the selected workspace.`);
        return { kind: "fallback", reason: "noRepository" };
      }
      const lookupCts = new CancellationTokenSource(token);
      const owner = context.repository.owner;
      const repo = context.repository.repo;
      this._logService.info(`${LOG_PREFIX} Starting independent GitHub lookups for '${owner}/${repo}'.`);
      const issuesLookup = this._resolveIssueCandidates(owner, repo, lookupCts.token);
      try {
        const pullRequestsLookup = await this._runGitHubLookup(
          "authored pull request summaries",
          this._gitHubLookupTimeouts.summaryMs,
          lookupCts.token,
          (lookupToken) => this._gitHubService.getRecentAuthoredPullRequests(owner, repo, lookupToken)
        );
        if (!this._isCurrentRepositoryContext(context)) {
          this._logService.info(`${LOG_PREFIX} The selected workspace changed during the GitHub lookup; retrying for the current workspace.`);
          continue;
        }
        const failures = [];
        if (pullRequestsLookup.kind === "success") {
          const pullRequests = [...pullRequestsLookup.value].sort(compareUpdatedAtDescending);
          const failingPullRequest = pullRequests.find(isFailingPullRequest);
          this._logService.info(`${LOG_PREFIX} Pull request summary lookup returned ${pullRequests.length} open authored pull request(s), including ${pullRequests.filter(isFailingPullRequest).length} with failing CI.`);
          if (failingPullRequest) {
            return { kind: "candidate", candidate: toCandidate(failingPullRequest, "githubCiFailure") };
          }
          const reviewLookup = await this._resolveReviewCandidates(owner, repo, pullRequests, lookupCts.token);
          failures.push(...reviewLookup.failures);
          if (!this._isCurrentRepositoryContext(context)) {
            this._logService.info(`${LOG_PREFIX} The selected workspace changed during review lookup; retrying for the current workspace.`);
            continue;
          }
          if (reviewLookup.candidates[0]) {
            return { kind: "candidate", candidate: reviewLookup.candidates[0] };
          }
        } else {
          failures.push(pullRequestsLookup.reason);
        }
        const issues = await issuesLookup;
        if (!this._isCurrentRepositoryContext(context)) {
          this._logService.info(`${LOG_PREFIX} The selected workspace changed during issue lookup; retrying for the current workspace.`);
          continue;
        }
        if (issues.kind === "success") {
          this._logService.info(`${LOG_PREFIX} Issue lookup returned ${issues.value.length} unlinked open issue(s) assigned to the user.`);
          const issue = [...issues.value].sort(compareUpdatedAtDescending)[0];
          if (issue) {
            return { kind: "candidate", candidate: { number: issue.number, title: issue.title, url: issue.url, strategy: "githubIssue" } };
          }
        } else {
          failures.push(issues.reason);
        }
        this._logService.warn(`${LOG_PREFIX} No eligible GitHub candidate was available from the lookups that completed in time.`);
        return { kind: "fallback", reason: getLookupFallbackReason(failures) };
      } finally {
        lookupCts.dispose(true);
      }
    }
    this._logService.trace(`${LOG_PREFIX} GitHub prompt lookup stopped because it was cancelled.`);
    return { kind: "fallback", reason: "noRepository" };
  }
  async _resolveIssueCandidates(owner, repo, token) {
    const issues = await this._runGitHubLookup(
      "assigned issue summaries",
      this._gitHubLookupTimeouts.summaryMs,
      token,
      (lookupToken) => this._gitHubService.getRecentAssignedIssues(owner, repo, lookupToken)
    );
    if (issues.kind === "failure" || issues.value.length === 0) {
      return issues;
    }
    const linkedIssues = await this._runGitHubLookup(
      "issue pull request linkage",
      this._gitHubLookupTimeouts.linkageMs,
      token,
      (lookupToken) => this._gitHubService.getIssuesWithLinkedPullRequests(owner, repo, issues.value.map((issue) => issue.number), lookupToken)
    );
    if (linkedIssues.kind === "success") {
      const unlinkedIssues = issues.value.filter((issue) => !linkedIssues.value.has(issue.number));
      this._logService.info(`${LOG_PREFIX} Issue linkage lookup excluded ${issues.value.length - unlinkedIssues.length} issue(s) with related pull requests.`);
      return { kind: "success", value: unlinkedIssues };
    }
    if (linkedIssues.reason === "cancelled" && token.isCancellationRequested) {
      return linkedIssues;
    }
    this._logService.warn(`${LOG_PREFIX} Issue linkage was unavailable (${linkedIssues.reason}); treating all assigned issues as having no related pull request.`);
    return issues;
  }
  async _resolveReviewCandidates(owner, repo, pullRequests, token, reportCandidate = () => void 0) {
    const eligiblePullRequests = pullRequests.filter((pullRequest) => !!pullRequest.latestCommitAt);
    if (eligiblePullRequests.length === 0) {
      this._logService.info(`${LOG_PREFIX} No pull requests have a latest commit timestamp, so review-thread lookup is unnecessary.`);
      return { candidates: [], failures: [] };
    }
    this._logService.info(`${LOG_PREFIX} Starting ${eligiblePullRequests.length} independent review-thread lookup(s).`);
    const results = await Promise.all(eligiblePullRequests.map(async (pullRequest) => {
      const outcome = await this._runGitHubLookup(
        `review threads for pull request #${pullRequest.number}`,
        this._gitHubLookupTimeouts.reviewMs,
        token,
        (lookupToken) => this._gitHubService.getPullRequestReviewThreads(owner, repo, pullRequest.number, lookupToken)
      );
      if (outcome.kind === "success") {
        const completedPullRequest = { ...pullRequest, reviewThreads: outcome.value };
        if (hasUnaddressedReviewComments(completedPullRequest)) {
          reportCandidate(toCandidate(completedPullRequest, "githubReviewComments"));
        }
      }
      return { pullRequest, outcome };
    }));
    const completedPullRequests = [];
    const failures = [];
    for (const result of results) {
      if (result.outcome.kind === "success") {
        completedPullRequests.push({ ...result.pullRequest, reviewThreads: result.outcome.value });
      } else {
        failures.push(result.outcome.reason);
      }
    }
    const reviewPullRequests = completedPullRequests.sort(compareUpdatedAtDescending).filter(hasUnaddressedReviewComments);
    this._logService.info(`${LOG_PREFIX} Review-thread lookups completed for ${completedPullRequests.length} of ${eligiblePullRequests.length} pull request(s); ${reviewPullRequests.length} eligible pull request(s) were found.`);
    return {
      candidates: reviewPullRequests.map((pullRequest) => toCandidate(pullRequest, "githubReviewComments")),
      failures
    };
  }
  async _runGitHubLookup(label, timeoutMs, token, lookup) {
    const lookupCts = new CancellationTokenSource(token);
    const startTime = Date.now();
    let timedOut = false;
    this._logService.trace(`${LOG_PREFIX} Starting ${label} lookup with a ${timeoutMs}ms timeout.`);
    try {
      const value = await raceTimeout(
        lookup(lookupCts.token),
        timeoutMs,
        () => {
          timedOut = true;
          this._logService.warn(`${LOG_PREFIX} ${capitalize(label)} lookup timed out after ${timeoutMs}ms.`);
          lookupCts.cancel();
        }
      );
      if (timedOut || value === void 0) {
        return { kind: "failure", reason: "timeout" };
      }
      this._logService.info(`${LOG_PREFIX} ${capitalize(label)} lookup completed in ${Date.now() - startTime}ms.`);
      return { kind: "success", value };
    } catch (error) {
      if (timedOut) {
        return { kind: "failure", reason: "timeout" };
      }
      if (error instanceof GitHubAuthenticationError) {
        this._logService.warn(`${LOG_PREFIX} ${capitalize(label)} lookup could not run because no existing GitHub authentication session is available.`);
        return { kind: "failure", reason: "noAuthentication" };
      }
      if (isCancellationError(error) && token.isCancellationRequested) {
        this._logService.trace(`${LOG_PREFIX} ${capitalize(label)} lookup was cancelled.`);
        return { kind: "failure", reason: "cancelled" };
      }
      this._logService.error(`${LOG_PREFIX} ${capitalize(label)} lookup failed after ${Date.now() - startTime}ms.`, error);
      return { kind: "failure", reason: "requestFailed" };
    } finally {
      lookupCts.dispose();
    }
  }
  async _resolveGitHubRepository(token) {
    while (!token.isCancellationRequested) {
      const activeSession = this._sessionsService.activeSession.get();
      if (!activeSession) {
        this._logService.trace(`${LOG_PREFIX} No active draft session is available for repository resolution.`);
        return void 0;
      }
      if (activeSession.isCreated.get()) {
        this._logService.trace(`${LOG_PREFIX} The active session is already created, so the V3 new-session prompt cannot resolve its repository.`);
        return void 0;
      }
      const workspace = activeSession.workspace.get();
      const folder = workspace?.folders[0];
      this._logWorkspaceSnapshot(activeSession);
      if (!workspace || !folder) {
        this._logService.trace(`${LOG_PREFIX} The active draft has no primary workspace folder.`);
        return void 0;
      }
      const gitHubInfo = folder.gitRepository?.gitHubInfo.get();
      if (gitHubInfo) {
        this._logService.info(`${LOG_PREFIX} Resolved GitHub repository '${gitHubInfo.owner}/${gitHubInfo.repo}' from session metadata.`);
        return this._createRepositoryContext(activeSession, workspace.uri.toString(), folder.workingDirectory.toString(), { owner: gitHubInfo.owner, repo: gitHubInfo.repo });
      }
      const repositoryFromUri = getGitHubRepositoryFromUri(folder.root) ?? getGitHubRepositoryFromUri(folder.workingDirectory) ?? (folder.gitRepository ? getGitHubRepositoryFromUri(folder.gitRepository.uri) : void 0);
      if (repositoryFromUri) {
        this._logService.info(`${LOG_PREFIX} Resolved GitHub repository '${repositoryFromUri.owner}/${repositoryFromUri.repo}' from the workspace URI.`);
        return this._createRepositoryContext(activeSession, workspace.uri.toString(), folder.workingDirectory.toString(), repositoryFromUri);
      }
      try {
        const repositoryFromConfig = await resolveGitHubRepositoryFromGitConfig(this._fileService, folder.workingDirectory);
        if (repositoryFromConfig) {
          this._logService.info(`${LOG_PREFIX} Resolved GitHub repository '${repositoryFromConfig.owner}/${repositoryFromConfig.repo}' directly from .git/config.`);
          return this._createRepositoryContext(activeSession, workspace.uri.toString(), folder.workingDirectory.toString(), repositoryFromConfig);
        }
        this._logService.trace(`${LOG_PREFIX} No supported github.com remote was found directly in .git/config.`);
      } catch (error) {
        this._logService.warn(`${LOG_PREFIX} Reading Git repository metadata directly from the selected workspace failed.`, error);
      }
      if (isAgentHostProviderId(activeSession.providerId)) {
        this._logService.info(`${LOG_PREFIX} Waiting for Agent Host git metadata for the active draft.`);
        const result = await this._waitForAgentHostRepository(activeSession, token);
        if (result.kind === "sessionChanged") {
          this._logService.info(`${LOG_PREFIX} The active draft changed while waiting for Agent Host git metadata; retrying.`);
          continue;
        }
        if (result.kind === "noGitHubRemote") {
          this._logService.info(`${LOG_PREFIX} Agent Host git metadata reports that the selected workspace has no github.com remote.`);
          return void 0;
        }
        if (result.kind === "resolved") {
          this._logService.info(`${LOG_PREFIX} Resolved GitHub repository '${result.context.repository.owner}/${result.context.repository.repo}' from asynchronously published Agent Host metadata.`);
          return result.context;
        }
      }
      this._logService.trace(`${LOG_PREFIX} Session metadata, workspace URIs, and .git/config did not identify GitHub; inspecting Git extension remotes.`);
      const repository = await this._gitService.openRepository(folder.workingDirectory);
      if (!repository) {
        this._logService.trace(`${LOG_PREFIX} The selected workspace folder could not be opened through the Git extension.`);
        return void 0;
      }
      const repositoryFromRemote = getGitHubRemoteInfo(repository.state.get());
      if (!repositoryFromRemote) {
        this._logService.trace(`${LOG_PREFIX} The selected Git repository has no supported github.com remote.`);
        return void 0;
      }
      this._logService.info(`${LOG_PREFIX} Resolved GitHub repository '${repositoryFromRemote.owner}/${repositoryFromRemote.repo}' from Git extension remotes.`);
      return this._createRepositoryContext(activeSession, workspace.uri.toString(), folder.workingDirectory.toString(), repositoryFromRemote);
    }
    return void 0;
  }
  _waitForAgentHostRepository(activeSession, token) {
    return new Promise((resolve, reject) => {
      const disposables = new DisposableStore();
      const reaction = disposables.add(new MutableDisposable());
      const finish = (result) => {
        disposables.dispose();
        resolve(result);
      };
      reaction.value = autorun((reader) => {
        if (this._sessionsService.activeSession.read(reader) !== activeSession || activeSession.isCreated.read(reader)) {
          finish({ kind: "sessionChanged" });
          return;
        }
        const workspace = activeSession.workspace.read(reader);
        const folder = workspace?.folders[0];
        const gitRepository = folder?.gitRepository;
        const gitHubInfo = gitRepository?.gitHubInfo.read(reader);
        if (workspace && folder && gitHubInfo) {
          finish({
            kind: "resolved",
            context: this._createRepositoryContext(activeSession, workspace.uri.toString(), folder.workingDirectory.toString(), { owner: gitHubInfo.owner, repo: gitHubInfo.repo })
          });
          return;
        }
        if (gitRepository?.hasGitHubRemote === false) {
          finish({ kind: "noGitHubRemote" });
        }
      });
      disposables.add(token.onCancellationRequested(() => {
        disposables.dispose();
        reject(new CancellationError());
      }));
      if (token.isCancellationRequested) {
        disposables.dispose();
        reject(new CancellationError());
      }
    });
  }
  _logWorkspaceSnapshot(activeSession) {
    const workspace = activeSession.workspace.get();
    const folder = workspace?.folders[0];
    const gitRepository = folder?.gitRepository;
    const gitHubInfo = gitRepository?.gitHubInfo.get();
    this._logService.info(`${LOG_PREFIX} Workspace snapshot: provider='${activeSession.providerId}', sessionType='${activeSession.sessionType}', workspace='${workspace?.uri.toString() ?? "none"}', root='${folder?.root.toString() ?? "none"}', workingDirectory='${folder?.workingDirectory.toString() ?? "none"}', gitRepository='${gitRepository?.uri.toString() ?? "none"}', hasGitHubRemote=${String(gitRepository?.hasGitHubRemote)}, gitHubRepository='${gitHubInfo ? `${gitHubInfo.owner}/${gitHubInfo.repo}` : "none"}'.`);
  }
  _createRepositoryContext(session, workspaceUri, folderUri, repository) {
    return {
      session,
      workspaceUri,
      folderUri,
      repository
    };
  }
  _isCurrentRepositoryContext(context) {
    const activeSession = this._sessionsService.activeSession.get();
    const workspace = activeSession?.workspace.get();
    return activeSession === context.session && workspace?.uri.toString() === context.workspaceUri && workspace.folders[0]?.workingDirectory.toString() === context.folderUri;
  }
  async _resolvePrompt(fallbackReason) {
    const [promptTemplateTreatment, placeholderTreatment] = await Promise.all([
      this._assignmentService.getTreatment(PROMPT_TEMPLATE_TREATMENT),
      this._assignmentService.getTreatment(PLACEHOLDER_TREATMENT)
    ]);
    const hasTreatment = typeof promptTemplateTreatment === "string" && !!promptTemplateTreatment.trim() && typeof placeholderTreatment === "string" && !!placeholderTreatment.trim();
    const promptTemplate = hasTreatment ? promptTemplateTreatment : DEFAULT_PROMPT_TEMPLATE;
    const taskPlaceholder = hasTreatment ? placeholderTreatment : DEFAULT_TASK_PLACEHOLDER;
    if (hasTreatment) {
      this._logService.info(`${LOG_PREFIX} Using prompt template and placeholder from paired treatments.`);
    } else {
      this._logService.info(`${LOG_PREFIX} Prompt treatments were not both set to non-empty strings; using the default prompt template and placeholder.`);
    }
    return {
      prompt: format(promptTemplate, taskPlaceholder),
      taskPlaceholder,
      effectiveStrategy: "prompt",
      fallbackReason
    };
  }
  _createPromptOptionsPlan(candidates, fallbackReason) {
    const gitHubOptions = candidates.slice(0, PROMPT_OPTION_COUNT).map((candidate) => this._createGitHubPromptOption(candidate));
    const standardOptions = this._createStandardPromptOptions();
    return {
      options: [...gitHubOptions, ...standardOptions.slice(0, PROMPT_OPTION_COUNT - gitHubOptions.length)],
      fallbackReason
    };
  }
  _createGitHubPromptOption(candidate) {
    const plan = this._createGitHubPrompt(candidate);
    const title = candidate.strategy === "githubIssue" ? localize("sessions.onboarding.newSessionViewV3.options.githubIssue.title", "Tackle issue") : candidate.strategy === "githubCiFailure" ? localize("sessions.onboarding.newSessionViewV3.options.githubCi.title", "Fix CI") : localize("sessions.onboarding.newSessionViewV3.options.githubReview.title", "Address PR comments");
    const icon = candidate.strategy === "githubIssue" ? computeIssueIcon(GitHubIssueState.Open, void 0) : computePullRequestIcon(GitHubPullRequestState.Open, {
      hasFailingChecks: candidate.strategy === "githubCiFailure",
      hasUnresolvedComments: candidate.strategy === "githubReviewComments"
    });
    return {
      id: `${candidate.strategy}:${candidate.url}`,
      title,
      titleDetail: `#${candidate.number}`,
      description: candidate.title,
      prompt: plan.prompt,
      placeholder: "",
      icon
    };
  }
  _createStandardPromptOptions() {
    const implementFeaturePlaceholder = localize("sessions.onboarding.newSessionViewV3.options.implementFeature.placeholder", "[describe the feature]");
    const fixBugPlaceholder = localize("sessions.onboarding.newSessionViewV3.options.fixBug.placeholder", "[describe the bug]");
    const fixCiPlaceholder = localize("sessions.onboarding.newSessionViewV3.options.fixCi.placeholder", "[describe the CI failure or paste a link]");
    return [
      {
        id: "standard:implementFeature",
        title: localize("sessions.onboarding.newSessionViewV3.options.implementFeature.title", "Implement a feature"),
        description: localize("sessions.onboarding.newSessionViewV3.options.implementFeature.description", "Describe what you want to build"),
        prompt: localize("sessions.onboarding.newSessionViewV3.options.implementFeature.prompt", "Help me implement {0} in this project. First, inspect the relevant files and explain your approach briefly. Then implement the solution using existing project conventions, avoid unrelated changes, and run the most relevant tests or checks. If anything is unclear, make a reasonable assumption and state it. When finished, summarize what changed and mention any remaining issues.", implementFeaturePlaceholder),
        placeholder: implementFeaturePlaceholder,
        icon: Codicon.lightbulbSparkleAutofix
      },
      {
        id: "standard:fixBug",
        title: localize("sessions.onboarding.newSessionViewV3.options.fixBug.title", "Fix a bug"),
        description: localize("sessions.onboarding.newSessionViewV3.options.fixBug.description", "Describe the unexpected behavior"),
        prompt: localize("sessions.onboarding.newSessionViewV3.options.fixBug.prompt", "Help me fix {0} in this project. First, inspect the relevant files and explain your approach briefly. Then implement the solution using existing project conventions, avoid unrelated changes, and run the most relevant tests or checks. If anything is unclear, make a reasonable assumption and state it. When finished, summarize what changed and mention any remaining issues.", fixBugPlaceholder),
        placeholder: fixBugPlaceholder,
        icon: Codicon.bug
      },
      {
        id: "standard:fixCi",
        title: localize("sessions.onboarding.newSessionViewV3.options.fixCi.title", "Fix CI"),
        description: localize("sessions.onboarding.newSessionViewV3.options.fixCi.description", "Describe a failing check or paste a link"),
        prompt: localize("sessions.onboarding.newSessionViewV3.options.fixCi.prompt", "Help me fix the failing CI for {0} in this project. First, inspect the relevant files and explain your approach briefly. Then implement the solution using existing project conventions, avoid unrelated changes, and run the most relevant tests or checks. If anything is unclear, make a reasonable assumption and state it. When finished, summarize what changed and mention any remaining issues.", fixCiPlaceholder),
        placeholder: fixCiPlaceholder,
        icon: Codicon.runErrors
      }
    ];
  }
  _createGitHubPrompt(candidate) {
    const prompt = candidate.strategy === "githubCiFailure" ? localize("sessions.onboarding.newSessionViewV3.githubPrompt.ciFailure", 'The following pull request has failing CI checks: "{0}" ({1}). Investigate the failures and resolve them.', candidate.title, candidate.url) : candidate.strategy === "githubReviewComments" ? localize("sessions.onboarding.newSessionViewV3.githubPrompt.reviewComments", 'The following pull request has unresolved review comments that have not been addressed by a newer commit: "{0}" ({1}). Address the review comments and update the pull request.', candidate.title, candidate.url) : localize("sessions.onboarding.newSessionViewV3.githubPrompt.issue", 'Tackle the following issue and create a pull request for it: "{0}" ({1}).', candidate.title, candidate.url);
    return {
      prompt,
      taskPlaceholder: "",
      effectiveStrategy: candidate.strategy,
      fallbackReason: "none"
    };
  }
  _animatePrompt(prompt, taskPlaceholder, token) {
    const activeSession = this._sessionsService.activeSession.get();
    if (activeSession?.isCreated.get()) {
      this._logService.warn(`${LOG_PREFIX} Skipping prompt insertion because the active session was created before animation started.`);
      return false;
    }
    const composer = this._newSessionComposerService.activeComposer.get();
    if (!composer) {
      this._logService.warn(`${LOG_PREFIX} Skipping prompt insertion because no active new-session composer is available.`);
      return false;
    }
    this._logService.trace(`${LOG_PREFIX} Animating the resolved prompt in the active new-session composer.`);
    return composer.animatePrompt(prompt, NEW_SESSION_PROMPT_TYPING_DURATION_MS, taskPlaceholder, token);
  }
  _reportStrategy(configuredVariation, effectiveStrategy, fallbackReason, shown) {
    this._telemetryService.publicLog2("onboarding.promptStrategy", {
      scenarioId: NEW_SESSION_VIEW_V3_TOUR_ID,
      configuredVariation,
      effectiveStrategy,
      fallbackReason,
      shown
    });
  }
}
function selectNewSessionViewV3GitHubCandidate(recentWork) {
  const pullRequests = [...recentWork.pullRequests].sort(compareUpdatedAtDescending);
  const failingPullRequest = pullRequests.find(isFailingPullRequest);
  if (failingPullRequest) {
    return toCandidate(failingPullRequest, "githubCiFailure");
  }
  const reviewPullRequest = pullRequests.find(hasUnaddressedReviewComments);
  if (reviewPullRequest) {
    return toCandidate(reviewPullRequest, "githubReviewComments");
  }
  const issue = [...recentWork.issues].sort(compareUpdatedAtDescending)[0];
  return issue ? { number: issue.number, title: issue.title, url: issue.url, strategy: "githubIssue" } : void 0;
}
function isFailingPullRequest(pullRequest) {
  return pullRequest.statusCheckRollupState === "FAILURE" || pullRequest.statusCheckRollupState === "ERROR";
}
function hasUnaddressedReviewComments(pullRequest) {
  const latestCommitAt = pullRequest.latestCommitAt ? Date.parse(pullRequest.latestCommitAt) : NaN;
  if (!Number.isFinite(latestCommitAt)) {
    return false;
  }
  return (pullRequest.reviewThreads ?? []).some((thread) => {
    const latestCommentAt = thread.latestCommentAt ? Date.parse(thread.latestCommentAt) : NaN;
    return !thread.isResolved && Number.isFinite(latestCommentAt) && latestCommentAt > latestCommitAt;
  });
}
function getLookupFallbackReason(failures) {
  if (failures.includes("noAuthentication")) {
    return "noAuthentication";
  }
  if (failures.includes("timeout")) {
    return "timeout";
  }
  if (failures.includes("requestFailed")) {
    return "requestFailed";
  }
  return "noCandidate";
}
function compareUpdatedAtDescending(a, b) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}
function toCandidate(pullRequest, strategy) {
  return { number: pullRequest.number, title: pullRequest.title, url: pullRequest.url, strategy };
}
function capitalize(value) {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
export {
  NewSessionViewV3PromptRunner,
  selectNewSessionViewV3GitHubCandidate
};
