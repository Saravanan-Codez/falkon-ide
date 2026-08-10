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
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IAgentService } from "../common/agentService.js";
import { IAgentHostGitHubEndpointService } from "./agentHostGitHubEndpointService.js";
import { parseChangesetUri } from "../common/changesetUri.js";
import { AHP_AUTH_REQUIRED, AHP_SESSION_NOT_FOUND, JsonRpcErrorCodes, ProtocolError } from "../common/state/sessionProtocol.js";
import { readSessionGitHubState, readSessionGitState } from "../common/state/sessionState.js";
import { ILogService } from "../../log/common/log.js";
import { IAgentHostGitService, parseUpstreamBranchName } from "../common/agentHostGitService.js";
import { IAgentHostOctoKitService } from "./shared/agentHostOctoKitService.js";
import { ICopilotApiService } from "./shared/copilotApiService.js";
import { buildConversationContext } from "../common/agentHostConversationContext.js";
const MAX_PR_CONVERSATION_CONTEXT_CHARS = 12e3;
const MAX_PR_CHANGE_SUMMARY_CHARS = 4e3;
let AgentHostPullRequestOperationHandler = class {
  constructor(_draft, _autoMergeMethod, _getSessionState, _onPullRequestCreated, _agentService, _gitService, _octoKitService, _gitHubEndpointService, _copilotApiService, _logService) {
    this._draft = _draft;
    this._autoMergeMethod = _autoMergeMethod;
    this._getSessionState = _getSessionState;
    this._onPullRequestCreated = _onPullRequestCreated;
    this._agentService = _agentService;
    this._gitService = _gitService;
    this._octoKitService = _octoKitService;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._copilotApiService = _copilotApiService;
    this._logService = _logService;
  }
  static {
    this.OPERATION_CREATE_PR = "create-pr";
  }
  static {
    this.OPERATION_CREATE_DRAFT_PR = "create-draft-pr";
  }
  static {
    this.OPERATION_CREATE_PR_AUTO_MERGE = "create-pr-auto-merge";
  }
  static {
    this.OPERATION_CREATE_PR_AUTO_SQUASH = "create-pr-auto-squash";
  }
  static {
    this.OPERATION_CREATE_PR_AUTO_REBASE = "create-pr-auto-rebase";
  }
  async invoke(params, token) {
    const abortController = new AbortController();
    if (token.isCancellationRequested) {
      abortController.abort();
    }
    const cancellationListener = token.onCancellationRequested(() => abortController.abort());
    try {
      return await this._invoke(params, token, abortController.signal);
    } finally {
      cancellationListener.dispose();
    }
  }
  async _invoke(params, token, signal) {
    const parsed = parseChangesetUri(params.channel);
    if (!parsed) {
      throw new ProtocolError(JsonRpcErrorCodes.InvalidParams, `Not a changeset URI: ${params.channel}`);
    }
    this._throwIfCancelled(token);
    const sessionUri = parsed.sessionUri;
    const sessionState = this._getSessionState(sessionUri);
    if (!sessionState) {
      throw new ProtocolError(AHP_SESSION_NOT_FOUND, `Session not found: ${sessionUri}`);
    }
    const workingDirectoryStr = sessionState.workingDirectories?.[0];
    if (!workingDirectoryStr) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Session has no working directory: ${sessionUri}`);
    }
    const gitHubState = readSessionGitHubState(sessionState._meta);
    if (!gitHubState?.owner || !gitHubState?.repo) {
      throw new ProtocolError(
        JsonRpcErrorCodes.InternalError,
        `Session's working directory is not a GitHub-backed git repo: ${sessionUri}`
      );
    }
    const workingDirectory = URI.parse(workingDirectoryStr);
    const gitState = await this._gitService.getSessionGitState(workingDirectory) ?? readSessionGitState(sessionState._meta);
    const branchName = gitState?.branchName ?? await this._gitService.getCurrentBranch(workingDirectory);
    if (!branchName) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Could not determine current branch for ${workingDirectory}`);
    }
    const baseBranchName = gitState?.baseBranchName ?? (await this._gitService.getDefaultBranch(workingDirectory))?.name;
    if (!baseBranchName) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Could not determine base branch for ${workingDirectory}`);
    }
    const base = baseBranchName;
    const repoResource = this._gitHubEndpointService.getRepoResource();
    const authToken = this._agentService.getAuthToken({
      resource: repoResource.resource,
      scopes: repoResource.scopes_supported
    });
    if (!authToken) {
      throw new ProtocolError(
        AHP_AUTH_REQUIRED,
        localize("agentHost.changeset.pr.authRequired", "Sign in to GitHub with repository access to create a pull request."),
        [repoResource]
      );
    }
    const hasUncommitted = await this._gitService.hasUncommittedChanges(workingDirectory);
    if (hasUncommitted) {
      this._throwIfCancelled(token);
      this._logService.info(`[AgentHostPullRequestOperationHandler] Committing uncommitted changes for session ${sessionUri}`);
      try {
        await this._gitService.commitAll(workingDirectory, this._formatCommitMessage(branchName));
      } catch (err) {
        this._throwIfCancelled(token);
        throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Failed to commit changes before creating a pull request: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this._throwIfCancelled(token);
    const branchChanges = await this._gitService.computeSessionFileDiffs(workingDirectory, { sessionUri, baseBranch: base });
    if (branchChanges === void 0) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, localize("agentHost.changeset.pr.computeChangesFailed", "Could not compute branch changes to create a pull request."));
    }
    if (branchChanges !== void 0 && branchChanges.length === 0) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, localize("agentHost.changeset.pr.noChanges", "There are no branch changes to create a pull request for."));
    }
    this._throwIfCancelled(token);
    const githubHeadOwner = gitState?.githubHeadOwner;
    const upstreamBranch = githubHeadOwner ? parseUpstreamBranchName(gitState.upstreamBranchName) : void 0;
    const headOwner = upstreamBranch && githubHeadOwner ? githubHeadOwner : gitHubState.owner;
    const headBranch = upstreamBranch?.branch ?? branchName;
    const pushRef = headBranch === branchName ? branchName : `${branchName}:${headBranch}`;
    const createHead = headOwner === gitHubState.owner ? headBranch : `${headOwner}:${headBranch}`;
    this._logService.info(`[AgentHostPullRequestOperationHandler] Pushing branch ${branchName} to ${upstreamBranch?.remote ?? "origin"} for session ${sessionUri}`);
    const upstreamPresent = await this._gitService.hasUpstream(workingDirectory, branchName);
    this._throwIfCancelled(token);
    try {
      await this._gitService.push(workingDirectory, { remote: upstreamBranch?.remote, ref: pushRef, setUpstream: !upstreamPresent });
    } catch (err) {
      this._throwIfCancelled(token);
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, `Failed to push branch '${branchName}': ${err instanceof Error ? err.message : String(err)}`);
    }
    this._throwIfCancelled(token);
    const existing = await this._octoKitService.findPullRequestByHeadBranch(gitHubState.owner, gitHubState.repo, headBranch, authToken, signal, headOwner);
    if (existing) {
      this._throwIfCancelled(token);
      return await this._finalize(existing, true, sessionUri, gitHubState.owner, gitHubState.repo, branchName, authToken, signal, token);
    }
    this._throwIfCancelled(token);
    const generated = await this._generateTitleAndDescription(sessionState, branchName, base, branchChanges, signal, token);
    this._throwIfCancelled(token);
    const title = generated?.title ?? this._formatTitle(branchName);
    const body = generated?.description ?? this._formatBody(branchName, base);
    this._logService.info(`[AgentHostPullRequestOperationHandler] Creating ${this._draft ? "draft " : ""}PR ${gitHubState.owner}/${gitHubState.repo} ${createHead} -> ${base}`);
    let created;
    try {
      created = await this._octoKitService.createPullRequest(
        gitHubState.owner,
        gitHubState.repo,
        title,
        body,
        createHead,
        base,
        this._draft,
        authToken,
        signal
      );
    } catch (err) {
      this._throwIfCancelled(token);
      let foundAfterFailure;
      try {
        foundAfterFailure = await this._octoKitService.findPullRequestByHeadBranch(gitHubState.owner, gitHubState.repo, headBranch, authToken, signal, headOwner);
      } catch {
        this._throwIfCancelled(token);
        throw err;
      }
      if (foundAfterFailure) {
        this._throwIfCancelled(token);
        return await this._finalize(foundAfterFailure, true, sessionUri, gitHubState.owner, gitHubState.repo, branchName, authToken, signal, token);
      }
      throw err;
    }
    this._throwIfCancelled(token);
    return await this._finalize(created, false, sessionUri, gitHubState.owner, gitHubState.repo, branchName, authToken, signal, token);
  }
  /**
   * Notifies listeners that the pull request now exists, optionally enables
   * auto-merge with the configured {@link AutoMergeMethod} (best-effort: a
   * failure to enable auto-merge does not fail the operation), and builds the
   * result message describing what happened.
   */
  async _finalize(pr, isExisting, sessionUri, owner, repo, branchName, authToken, signal, token) {
    if (!this._autoMergeMethod) {
      this._onPullRequestCreated({ sessionKey: sessionUri, pullRequestUrl: pr.url, branchName });
      return this._createResult(pr, this._buildMessage(pr, isExisting, "none", void 0));
    }
    let autoMergeError;
    let autoMergeOutcome = "none";
    if (pr.nodeId) {
      try {
        await this._octoKitService.enablePullRequestAutoMerge(pr.nodeId, this._autoMergeMethod, authToken, signal);
        autoMergeOutcome = "enabled";
      } catch (err) {
        this._throwIfCancelled(token);
        autoMergeError = err instanceof Error ? err.message : String(err);
        autoMergeOutcome = "failed";
        this._logService.warn(`[AgentHostPullRequestOperationHandler] Failed to enable auto-merge for ${owner}/${repo}#${pr.number}: ${autoMergeError}`);
      }
    } else {
      autoMergeError = localize("agentHost.changeset.pr.autoMerge.noNodeId", "the pull request identifier was not returned by GitHub.");
      autoMergeOutcome = "failed";
      this._logService.warn(`[AgentHostPullRequestOperationHandler] Cannot enable auto-merge for ${owner}/${repo}#${pr.number}: missing pull request node id`);
    }
    this._onPullRequestCreated({ sessionKey: sessionUri, pullRequestUrl: pr.url, branchName });
    return this._createResult(pr, this._buildMessage(pr, isExisting, autoMergeOutcome, autoMergeError));
  }
  _buildMessage(pr, isExisting, autoMergeOutcome, autoMergeError) {
    let mergeMethodLabel;
    switch (this._autoMergeMethod) {
      case "SQUASH":
        mergeMethodLabel = localize("agentHost.changeset.pr.autoMerge.squash", "squash");
        break;
      case "REBASE":
        mergeMethodLabel = localize("agentHost.changeset.pr.autoMerge.rebase", "rebase");
        break;
      default:
        mergeMethodLabel = localize("agentHost.changeset.pr.autoMerge.merge", "merge");
        break;
    }
    if (isExisting) {
      switch (autoMergeOutcome) {
        case "enabled":
          return localize("agentHost.changeset.pr.existing.autoMerge", "Pull request [#{0}]({1}) already exists; enabled auto-merge ({2}).", pr.number, pr.url, mergeMethodLabel);
        case "failed":
          return localize("agentHost.changeset.pr.existing.autoMergeFailed", "Pull request [#{0}]({1}) already exists, but auto-merge could not be enabled: {2}", pr.number, pr.url, autoMergeError ?? "");
        default:
          return localize("agentHost.changeset.pr.existing", "Pull request [#{0}]({1}) already exists.", pr.number, pr.url);
      }
    }
    switch (autoMergeOutcome) {
      case "enabled":
        return localize("agentHost.changeset.pr.created.autoMerge", "Created pull request [#{0}]({1}) with auto-merge ({2}) enabled.", pr.number, pr.url, mergeMethodLabel);
      case "failed":
        return localize("agentHost.changeset.pr.created.autoMergeFailed", "Created pull request [#{0}]({1}), but auto-merge could not be enabled: {2}", pr.number, pr.url, autoMergeError ?? "");
      default:
        return this._draft ? localize("agentHost.changeset.pr.createdDraft", "Created draft pull request [#{0}]({1}).", pr.number, pr.url) : localize("agentHost.changeset.pr.created", "Created pull request [#{0}]({1}).", pr.number, pr.url);
    }
  }
  _throwIfCancelled(token) {
    if (token.isCancellationRequested) {
      throw new ProtocolError(JsonRpcErrorCodes.InternalError, localize("agentHost.changeset.pr.cancelled", "Pull request operation was cancelled."));
    }
  }
  _formatTitle(branchName) {
    const idx = branchName.indexOf("/");
    if (idx > 0 && idx < branchName.length - 1) {
      const prefix = branchName.substring(0, idx);
      const rest = branchName.substring(idx + 1).replace(/[-_]+/g, " ");
      return `${prefix}: ${rest}`;
    }
    return branchName.replace(/[-_]+/g, " ");
  }
  _formatCommitMessage(branchName) {
    return localize("agentHost.changeset.pr.commitMessage", "Agent Host changes for {0}", branchName);
  }
  _formatBody(branchName, baseBranchName) {
    return localize("agentHost.changeset.pr.body", "Created from `{0}` targeting `{1}`.", branchName, baseBranchName);
  }
  /**
   * Best-effort generation of a PR title and description using the utility
   * model. The model is given the main session conversation (only the
   * markdown text of user requests and agent responses — tool calls,
   * subagents, and reasoning are excluded and the text is character-bounded)
   * along with a summary of the changed files. Returns `undefined` when no
   * Copilot token is available or generation fails, so the caller can fall
   * back to the branch-name based title/description. PR creation must never
   * fail just because the model is unavailable.
   */
  async _generateTitleAndDescription(sessionState, branchName, base, branchChanges, signal, token) {
    const copilotResource = this._gitHubEndpointService.getCopilotResource();
    const copilotToken = this._agentService.getAuthToken({
      resource: copilotResource.resource,
      scopes: copilotResource.scopes_supported
    });
    if (!copilotToken) {
      return void 0;
    }
    const conversation = buildConversationContext(sessionState.turns, { maxChars: MAX_PR_CONVERSATION_CONTEXT_CHARS });
    const changeSummary = this._summarizeDiffsForPrompt(branchChanges);
    if (!conversation && !changeSummary) {
      return void 0;
    }
    try {
      const raw = await this._copilotApiService.utilityChatCompletion(copilotToken, {
        messages: this._buildTitleAndDescriptionPrompt(branchName, base, conversation, changeSummary)
      }, { signal });
      this._throwIfCancelled(token);
      return this._parseTitleAndDescription(raw);
    } catch (err) {
      if (token.isCancellationRequested) {
        return void 0;
      }
      this._logService.warn(`[AgentHostPullRequestOperationHandler] Failed to generate PR title and description: ${err instanceof Error ? err.message : String(err)}`);
      return void 0;
    }
  }
  _buildTitleAndDescriptionPrompt(branchName, base, conversation, changeSummary) {
    const userSections = [
      `Branch: ${branchName}`,
      `Base branch: ${base}`
    ];
    if (changeSummary) {
      userSections.push(`Changed files:
${changeSummary}`);
    }
    if (conversation) {
      userSections.push(`Conversation (the request that produced these changes):
${conversation}`);
    }
    return [
      {
        role: "system",
        content: [
          "You write clear, concise GitHub pull request titles and descriptions.",
          'The first line of your reply is the PR title: a short imperative summary under 72 characters, with no "Title:" prefix, no surrounding quotes, and no markdown heading.',
          "After the title, add one blank line, then write the PR description in GitHub-flavored markdown.",
          "Summarize what changed and why, grounded in the conversation and changed files. Use a short paragraph and/or bullet points.",
          "Do not invent changes that are not supported by the provided context, and do not wrap the whole reply in code fences."
        ].join(" ")
      },
      {
        role: "user",
        content: userSections.join("\n\n")
      }
    ];
  }
  _summarizeDiffsForPrompt(diffs) {
    const lines = [];
    let length = 0;
    for (const diff of diffs) {
      const before = diff.before?.uri;
      const after = diff.after?.uri;
      const path = after ?? before ?? "(unknown)";
      let kind = "Edit";
      if (!before && after) {
        kind = "Create";
      } else if (before && !after) {
        kind = "Delete";
      } else if (before && after && before !== after) {
        kind = "Rename";
      }
      const line = `- ${kind}: ${this._displayUri(path)} (+${diff.diff?.added ?? 0} -${diff.diff?.removed ?? 0})`;
      lines.push(line);
      length += line.length + (lines.length > 1 ? 1 : 0);
      if (length > MAX_PR_CHANGE_SUMMARY_CHARS) {
        lines.push("[file list truncated]");
        break;
      }
    }
    return lines.join("\n");
  }
  _displayUri(uri) {
    try {
      const parsed = URI.parse(uri);
      return parsed.scheme === "file" ? parsed.fsPath : parsed.path || uri;
    } catch {
      return uri;
    }
  }
  _parseTitleAndDescription(raw) {
    let text = raw.trim().replace(/\r\n/g, "\n");
    const fenced = /^```(?:markdown|md|text)?\s*([\s\S]*?)\s*```$/i.exec(text);
    if (fenced) {
      text = fenced[1].trim();
    }
    if (!text) {
      return void 0;
    }
    const lines = text.split("\n");
    let i = 0;
    while (i < lines.length && lines[i].trim().length === 0) {
      i++;
    }
    if (i >= lines.length) {
      return void 0;
    }
    const title = lines[i].trim().replace(/^#+\s*/, "").replace(/^title:\s*/i, "").trim().replace(/^"(?<inner>.+)"$/, (_match, inner) => inner).trim();
    if (!title) {
      return void 0;
    }
    const description = lines.slice(i + 1).join("\n").trim().replace(/^description:\s*/i, "").trim();
    return { title, description };
  }
  _createResult(created, message) {
    const followUp = {
      content: { uri: created.url, contentType: "text/html" },
      external: true
    };
    return { message: { markdown: message }, followUp };
  }
};
AgentHostPullRequestOperationHandler = __decorateClass([
  __decorateParam(4, IAgentService),
  __decorateParam(5, IAgentHostGitService),
  __decorateParam(6, IAgentHostOctoKitService),
  __decorateParam(7, IAgentHostGitHubEndpointService),
  __decorateParam(8, ICopilotApiService),
  __decorateParam(9, ILogService)
], AgentHostPullRequestOperationHandler);
export {
  AgentHostPullRequestOperationHandler
};
