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
import { URI } from "../../../../../base/common/uri.js";
import { constObservable } from "../../../../../base/common/observable.js";
import { posix, win32 } from "../../../../../base/common/path.js";
import { localize } from "../../../../../nls.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IAgentSessionsService } from "../agentSessions/agentSessionsService.js";
import { AgentSessionStatus, getAgentChangesSummary } from "../agentSessions/agentSessionsModel.js";
import { IChatService, IChatToolInvocation, ToolConfirmKind } from "../../common/chatService/chatService.js";
import { resolveQuestionAnswers } from "../../common/voiceClient/voiceQuestionAnswers.js";
import { ChatQuestionCarouselData } from "../../common/model/chatProgressTypes/chatQuestionCarouselData.js";
import { ChatPlanReviewData } from "../../common/model/chatProgressTypes/chatPlanReviewData.js";
import { ChatAgentLocation, ChatModeKind } from "../../common/constants.js";
import { ILanguageModelToolsService } from "../../common/tools/languageModelToolsService.js";
import { markPendingIdResolved, peekPendingId } from "../../common/voiceClient/voiceClientService.js";
import { getVoiceConfirmationType } from "../../common/voiceClient/voiceConfirmation.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isExplicitFileOrImageVariableEntry } from "../../common/attachments/chatVariableEntries.js";
function voiceModelReference(model) {
  return {
    identifier: model.identifier,
    name: model.metadata.name,
    vendor: model.metadata.vendor
  };
}
function normalizeModelName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function resolveVoiceModel(models, requestedModel) {
  const exactIdentifier = models.find((model) => model.identifier === requestedModel);
  if (exactIdentifier) {
    return { ok: true, identifier: exactIdentifier.identifier, selected_model: voiceModelReference(exactIdentifier) };
  }
  const normalized = normalizeModelName(requestedModel);
  const exactMatches = models.filter((model) => [
    model.metadata.name,
    model.metadata.id,
    model.metadata.family,
    `${model.metadata.name} ${model.metadata.vendor}`
  ].some((candidate) => normalizeModelName(candidate) === normalized));
  if (exactMatches.length === 1) {
    return { ok: true, identifier: exactMatches[0].identifier, selected_model: voiceModelReference(exactMatches[0]) };
  }
  if (exactMatches.length > 1) {
    return { ok: false, reason: "ambiguous_model", available_models: exactMatches.map(voiceModelReference) };
  }
  const related = normalized ? models.filter((model) => [model.metadata.name, model.metadata.id, model.metadata.family].some((candidate) => normalizeModelName(candidate).includes(normalized) || normalized.includes(normalizeModelName(candidate)))) : [];
  return {
    ok: false,
    reason: related.length > 1 ? "ambiguous_model" : "model_not_found",
    available_models: (related.length > 0 ? related : models).slice(0, 10).map(voiceModelReference)
  };
}
const IVoiceToolDispatchService = createDecorator("voiceToolDispatchService");
const ACTION_LABELS = {
  send_to_chat: localize("agentsVoice.action.sendToChat", "Sending to chat..."),
  new_sessions: localize("agentsVoice.action.newSessions", "Starting new sessions..."),
  get_session_info: localize("agentsVoice.action.getSessionInfo", "Checking sessions..."),
  get_session_changes: localize("agentsVoice.action.getSessionChanges", "Checking changes..."),
  get_session_thread: localize("agentsVoice.action.getSessionThread", "Checking conversation..."),
  respond_to_session: localize("agentsVoice.action.respond", "Responding..."),
  focus_session: localize("agentsVoice.action.focusSession", "Focusing session..."),
  set_model: localize("agentsVoice.action.setModel", "Changing model..."),
  attach_file: localize("agentsVoice.action.attachFile", "Attaching file..."),
  attach_files: localize("agentsVoice.action.attachFiles", "Attaching files..."),
  auto_approve_session: localize("agentsVoice.action.autoApprove", "Auto-approving session..."),
  revoke_auto_approve: localize("agentsVoice.action.revokeAutoApprove", "Revoking auto-approve...")
};
let VoiceToolDispatchService = class {
  constructor(agentSessionsService, chatService, toolsService, editorService, workspaceContextService, fileService) {
    this.agentSessionsService = agentSessionsService;
    this.chatService = chatService;
    this.toolsService = toolsService;
    this.editorService = editorService;
    this.workspaceContextService = workspaceContextService;
    this.fileService = fileService;
  }
  setDelegate(delegate) {
    this._delegate = delegate;
  }
  /** Get the action label for a tool call name. */
  static getActionLabel(name) {
    return ACTION_LABELS[name] ?? localize("agentsVoice.action.working", "Working...");
  }
  get _agentModeOptions() {
    const allTools = {};
    for (const tool of this.toolsService.getTools(void 0)) {
      allTools[tool.id] = true;
    }
    return {
      modeInfo: {
        kind: ChatModeKind.Agent,
        isBuiltin: true,
        modeInstructions: void 0,
        telemetryModeId: "agent",
        applyCodeBlockSuggestionId: void 0
      },
      instructionContext: {
        modeKind: ChatModeKind.Agent,
        enabledTools: allTools
      },
      userSelectedTools: constObservable(allTools)
    };
  }
  async dispatchToolCall(toolCall) {
    const delegate = this._delegate;
    if (!delegate) {
      return "error: no delegate set";
    }
    const args = toolCall.args;
    const argString = (k) => {
      const v = args[k];
      return typeof v === "string" ? v : "";
    };
    switch (toolCall.name) {
      case "send_to_chat": {
        const text = argString("text");
        if (text) {
          if (!delegate.acceptInput(text)) {
            const resource = await delegate.getCurrentSessionResource();
            if (resource) {
              await this.chatService.sendRequest(resource, text, this._agentModeOptions);
            } else {
              const ref = this.chatService.startNewLocalSession(ChatAgentLocation.Chat);
              await this.chatService.sendRequest(ref.object.sessionResource, text, this._agentModeOptions);
              ref.dispose();
            }
          }
        }
        break;
      }
      case "new_sessions": {
        const sessions = args["sessions"];
        const items = Array.isArray(sessions) ? sessions : [{ text: argString("text") }];
        let firstResource;
        for (const item of items) {
          const text = item.text;
          if (text) {
            const ref = this.chatService.startNewLocalSession(ChatAgentLocation.Chat);
            const resource = ref.object.sessionResource;
            if (!firstResource) {
              firstResource = resource;
            }
            await this.chatService.sendRequest(resource, text, this._agentModeOptions);
            ref.dispose();
          }
        }
        if (firstResource) {
          if (await delegate.switchToSession(firstResource)) {
            delegate.setTargetSession(firstResource);
          }
        }
        break;
      }
      case "focus_session": {
        const targetSessionId = argString("coding_session_id");
        const targetResource = this._findSessionResource(targetSessionId);
        if (targetResource) {
          const currentResource = await delegate.getCurrentSessionResource();
          const switched = targetResource.toString() === currentResource?.toString() || await delegate.switchToSession(targetResource);
          if (switched) {
            delegate.setTargetSession(targetResource);
            return JSON.stringify({ ok: true, session_id: targetResource.toString() });
          }
        }
        return JSON.stringify({ ok: false, reason: targetResource ? "switch_failed" : "session_not_found" });
      }
      case "set_model": {
        const requestedModel = argString("model_id") || argString("model");
        if (!requestedModel) {
          return JSON.stringify({ ok: false, reason: "model_not_found" });
        }
        const target = await this._showActionTarget(argString("coding_session_id"));
        if (!target.ok) {
          return JSON.stringify(target);
        }
        return JSON.stringify(await delegate.selectModel(requestedModel));
      }
      case "attach_file":
      case "attach_files": {
        const target = await this._showActionTarget(argString("coding_session_id"));
        if (!target.ok) {
          return JSON.stringify(target);
        }
        const resolved = await this._resolveAttachmentResources(args);
        if (!resolved.ok) {
          return JSON.stringify(resolved);
        }
        return JSON.stringify(await delegate.attachFiles(resolved.resources));
      }
      case "auto_approve_session": {
        delegate.addAllAutoApprovedSessions();
        break;
      }
      case "revoke_auto_approve": {
        const sessionResource = await delegate.getCurrentSessionResource();
        if (sessionResource) {
          delegate.removeAutoApprovedSession(sessionResource.toString());
        }
        break;
      }
      case "get_session_info": {
        return await this._gatherSessionInfo();
      }
      case "get_session_changes": {
        const sessionId = typeof toolCall.args?.coding_session_id === "string" ? toolCall.args.coding_session_id : void 0;
        return await this._gatherSessionChanges(sessionId);
      }
      case "get_session_thread": {
        const sessionId = typeof toolCall.args?.coding_session_id === "string" ? toolCall.args.coding_session_id : void 0;
        const rawN = toolCall.args?.last_n_turns;
        const lastN = typeof rawN === "number" && rawN > 0 ? Math.min(10, Math.floor(rawN)) : 3;
        return await this._gatherSessionThread(sessionId, lastN);
      }
    }
    return "ok";
  }
  _findSessionResource(sessionId) {
    if (!sessionId) {
      return void 0;
    }
    const agentSession = this.agentSessionsService.model.sessions.find((session) => !session.isArchived() && session.resource.toString() === sessionId);
    if (agentSession) {
      return agentSession.resource;
    }
    for (const model of this.chatService.chatModels.get()) {
      if (model.sessionResource.toString() === sessionId) {
        return model.sessionResource;
      }
    }
    return void 0;
  }
  async _showActionTarget(sessionId) {
    const delegate = this._delegate;
    if (!delegate) {
      return { ok: false, reason: "no_session" };
    }
    const resource = sessionId ? this._findSessionResource(sessionId) : delegate.getTargetSessionResource() ?? await delegate.getCurrentSessionResource();
    if (!resource) {
      return { ok: false, reason: sessionId ? "session_not_found" : "no_session" };
    }
    const current = await delegate.getCurrentSessionResource();
    if (current?.toString() !== resource.toString() && !await delegate.switchToSession(resource)) {
      return { ok: false, reason: "switch_failed" };
    }
    if (sessionId) {
      delegate.setTargetSession(resource);
    }
    return { ok: true, resource };
  }
  async _resolveAttachmentResources(args) {
    const uriValues = [args["uri"], ...Array.isArray(args["uris"]) ? args["uris"] : []].filter((value) => typeof value === "string" && value.trim().length > 0);
    const pathValues = [args["path"], ...Array.isArray(args["paths"]) ? args["paths"] : []].filter((value) => typeof value === "string" && value.trim().length > 0);
    if (uriValues.length === 0 && pathValues.length === 0) {
      const activeResource = EditorResourceAccessor.getCanonicalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
      return activeResource ? { ok: true, resources: [activeResource] } : { ok: false, reason: "no_file" };
    }
    const resources = [];
    for (const rawValue of uriValues) {
      const value = rawValue.trim();
      let resource;
      try {
        resource = URI.parse(value, true);
      } catch {
        return { ok: false, reason: "file_not_found", candidates: [value] };
      }
      if (!await this.fileService.exists(resource)) {
        return { ok: false, reason: "file_not_found", candidates: [value] };
      }
      resources.push(resource);
    }
    for (const rawValue of pathValues) {
      const value = rawValue.trim();
      const isWindowsPath = win32.isAbsolute(value);
      if (isWindowsPath || posix.isAbsolute(value)) {
        const resource = URI.file(isWindowsPath ? value.replaceAll("\\", "/") : value);
        if (!await this.fileService.exists(resource)) {
          return { ok: false, reason: "file_not_found", candidates: [value] };
        }
        resources.push(resource);
        continue;
      }
      const relativePath = value.replace(/^\.[\\/]/, "").replaceAll("\\", "/");
      const candidates = this.workspaceContextService.getWorkspace().folders.map((folder) => URI.joinPath(folder.uri, relativePath));
      const exists = await Promise.all(candidates.map((candidate) => this.fileService.exists(candidate)));
      const matches = candidates.filter((_candidate, index) => exists[index]);
      if (matches.length === 0) {
        return { ok: false, reason: "file_not_found", candidates: [value] };
      }
      if (matches.length > 1) {
        return { ok: false, reason: "ambiguous_file", candidates: matches.map((match) => match.toString()) };
      }
      resources.push(matches[0]);
    }
    return { ok: true, resources };
  }
  /**
   * Apply a backend-resolved response to the exact pending part it names.
   *
   * Routing is by `pending_id` + `request_id` with no fallback: the path this
   * replaces fell back to the focused session, so a spoken "yes" could approve
   * a prompt the user was not looking at. A response that cannot find its part
   * is reported as stale instead. Answer values are matched exactly; see
   * `resolveQuestionAnswers`.
   */
  async respondToSession(toolCall) {
    const args = toolCall.args;
    const argString = (key) => {
      const value = args[key];
      return typeof value === "string" ? value : "";
    };
    const response = args["response"];
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      return { ok: false, reason: "unsupported" };
    }
    const responseType = response["type"];
    if (responseType !== "approve" && responseType !== "reject" && responseType !== "answer" && responseType !== "skip") {
      return { ok: false, reason: "unsupported" };
    }
    const resolved = await this._resolveModelForResponse(argString("coding_session_id"));
    if (!resolved) {
      return { ok: false, reason: "no_session" };
    }
    try {
      return await this._applyResponse(
        resolved.model,
        argString("request_id"),
        argString("pending_id"),
        responseType,
        response
      );
    } finally {
      resolved.dispose();
    }
  }
  async _applyResponse(model, requestId, pendingId, responseType, response) {
    const request = model.getRequests().find((candidate) => candidate.id === requestId);
    const parts = request?.response?.response.value;
    if (!request || !parts) {
      return { ok: false, reason: "stale_pending" };
    }
    const index = parts.findIndex((candidate) => peekPendingId(request.id, candidate) === pendingId);
    if (index < 0) {
      return { ok: false, reason: "stale_pending" };
    }
    const part = parts[index];
    if (part.kind === "questionCarousel") {
      if (responseType !== "answer" && responseType !== "skip") {
        return { ok: false, reason: "unsupported" };
      }
      return this._answerCarousel(request.id, part, response, responseType === "skip");
    }
    if (responseType === "answer" || responseType === "skip") {
      return { ok: false, reason: "unsupported" };
    }
    const approve = responseType === "approve";
    if (part.kind === "planReview" && part instanceof ChatPlanReviewData) {
      return this._resolvePlanReview(part, approve) ? { ok: true } : { ok: false, reason: "stale_pending" };
    }
    if (part.kind === "toolInvocation") {
      if (getVoiceConfirmationType([part]) !== "tool") {
        return { ok: false, reason: "unsupported" };
      }
      markPendingIdResolved(pendingId);
      const confirmed = IChatToolInvocation.confirmWith(
        part,
        approve ? { type: ToolConfirmKind.UserAction } : { type: ToolConfirmKind.Denied }
      );
      return confirmed ? { ok: true } : { ok: false, reason: "stale_pending" };
    }
    return { ok: false, reason: "unsupported" };
  }
  _resolvePlanReview(plan, approve) {
    if (plan.isUsed) {
      return false;
    }
    let result;
    if (approve) {
      const action = plan.actions.find((candidate) => candidate.default) ?? plan.actions[0];
      if (!action) {
        return false;
      }
      result = {
        action: action.label,
        actionId: action.id,
        rejected: false
      };
    } else {
      result = { rejected: true };
    }
    plan.data = result;
    plan.isUsed = true;
    void plan.completion.complete(result);
    return true;
  }
  /** Resolve a coding session id to its chat model, never falling back to the focused session. */
  async _resolveModelForResponse(codingSessionId) {
    if (!codingSessionId) {
      return void 0;
    }
    const agentSession = this.agentSessionsService.model.sessions.find((session) => !session.isArchived() && session.resource.toString() === codingSessionId);
    if (agentSession) {
      const loaded = this.chatService.getSession(agentSession.resource);
      if (loaded) {
        return { model: loaded, dispose: () => {
        } };
      }
    }
    for (const chatModel of this.chatService.chatModels.get()) {
      if (chatModel.sessionResource.toString() === codingSessionId) {
        return { model: chatModel, dispose: () => {
        } };
      }
    }
    if (!agentSession) {
      return void 0;
    }
    const cts = new CancellationTokenSource();
    const ref = await this.chatService.acquireOrLoadSession(agentSession.resource, ChatAgentLocation.Chat, cts.token, "voice-respond").catch(() => void 0);
    cts.dispose();
    if (!ref) {
      return void 0;
    }
    const model = this.chatService.getSession(agentSession.resource);
    if (!model) {
      ref.dispose();
      return void 0;
    }
    return { model, dispose: () => ref.dispose() };
  }
  /**
   * Fill in a question carousel exactly as the widget's own submit path does.
   *
   * A `skip` carries whatever the user answered before saying "skip", which on
   * an untouched form is nothing at all. That empty case is why skipping is its
   * own response type: an `answer` with zero answers is indistinguishable from
   * a backend that resolved nothing, and is correctly refused below.
   */
  _answerCarousel(requestId, carousel, response, skip) {
    if (carousel.isUsed || carousel.answeredExternally) {
      return { ok: false, reason: "stale_pending" };
    }
    if (skip && !carousel.allowSkip) {
      return { ok: false, reason: "stale_pending" };
    }
    const raw = response["answers"];
    if (raw !== void 0 && !Array.isArray(raw)) {
      return { ok: false, reason: "invalid_answer" };
    }
    const rawAnswers = raw ?? [];
    let answers;
    if (rawAnswers.length > 0) {
      answers = resolveQuestionAnswers(carousel.questions, rawAnswers);
      if (!answers) {
        return { ok: false, reason: "invalid_answer" };
      }
    } else if (!skip) {
      return { ok: false, reason: "invalid_answer" };
    }
    if (!skip && carousel.questions.some((question) => question.required && answers?.[question.id] === void 0)) {
      return { ok: false, reason: "invalid_answer" };
    }
    if (!(carousel instanceof ChatQuestionCarouselData) && !carousel.resolveId) {
      return { ok: false, reason: "unsupported" };
    }
    if (carousel instanceof ChatQuestionCarouselData) {
      carousel.dismiss(answers);
    } else {
      carousel.data = answers;
      carousel.isUsed = true;
    }
    if (carousel.resolveId) {
      this.chatService.notifyQuestionCarouselAnswer(requestId, carousel.resolveId, answers);
    }
    return { ok: true };
  }
  async _gatherSessionInfo() {
    const agentSessions = this.agentSessionsService.model.sessions.filter((session) => !session.isArchived());
    const currentResource = await this._delegate?.getCurrentSessionResource();
    const activeResource = this._delegate?.getTargetSessionResource() ?? currentResource;
    const agentResources = new Set(agentSessions.map((session) => session.resource.toString()));
    const inputDetails = (model) => {
      const state = model?.inputModel?.state?.get();
      const selected = state?.selectedModel;
      const attachments = state?.attachments.filter(isExplicitFileOrImageVariableEntry) ?? [];
      return {
        ...selected ? { selected_model: voiceModelReference(selected) } : {},
        ...attachments.length ? {
          attachment_names: attachments.map((attachment) => attachment.name).slice(0, 10),
          attachment_count: attachments.length
        } : {}
      };
    };
    const lastResponseSummary = (model) => {
      const summary = model?.getRequests().at(-1)?.response?.response.value.filter((part) => part.kind === "markdownContent").map((part) => part.content.value).join(" ").slice(0, 500);
      return summary || void 0;
    };
    const sessionData = agentSessions.map((session) => {
      const model = this.chatService.getSession(session.resource);
      const changes = getAgentChangesSummary(session.changes);
      const state = session.status === AgentSessionStatus.InProgress ? "working" : session.status === AgentSessionStatus.NeedsInput ? "waiting_for_input" : session.status === AgentSessionStatus.Completed ? "idle" : "unknown";
      const lastActivity = session.timing.lastRequestEnded ?? session.timing.lastRequestStarted ?? session.timing.created ?? 0;
      return {
        id: session.resource.toString(),
        label: session.label || void 0,
        session_type: "agent",
        state,
        is_active: activeResource?.toString() === session.resource.toString(),
        insertions: changes?.insertions ?? 0,
        deletions: changes?.deletions ?? 0,
        last_activity: lastActivity,
        last_activity_minutes_ago: lastActivity ? Math.max(0, Math.round((Date.now() - lastActivity) / 6e4)) : void 0,
        last_response_summary: lastResponseSummary(model),
        ...inputDetails(model)
      };
    });
    for (const model of this.chatService.chatModels.get()) {
      const sessionId = model.sessionResource.toString();
      const isActive = activeResource?.toString() === sessionId;
      if (agentResources.has(sessionId) || model.getRequests().length === 0 && !isActive) {
        continue;
      }
      const needsInput = model.requestNeedsInput?.get();
      const inProgress = model.hasActiveRequest?.get();
      const lastActivity = model.lastMessageDate || 0;
      sessionData.push({
        id: sessionId,
        label: model.title || void 0,
        session_type: "chat",
        state: needsInput ? "waiting_for_input" : inProgress ? "working" : "idle",
        is_active: isActive,
        insertions: 0,
        deletions: 0,
        last_activity: lastActivity,
        last_activity_minutes_ago: lastActivity ? Math.max(0, Math.round((Date.now() - lastActivity) / 6e4)) : void 0,
        last_response_summary: lastResponseSummary(model),
        ...inputDetails(model)
      });
    }
    sessionData.sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.last_activity - a.last_activity);
    const counts = sessionData.reduce((result, session) => {
      if (session.state === "working") {
        result.working++;
      } else if (session.state === "waiting_for_input") {
        result.waiting_for_input++;
      } else if (session.state === "idle") {
        result.idle++;
      }
      return result;
    }, { working: 0, waiting_for_input: 0, idle: 0 });
    const visibleSessions = sessionData.slice(0, 20).map(({ last_activity, ...session }) => session);
    return JSON.stringify({
      total_sessions: sessionData.length,
      counts,
      sessions: visibleSessions,
      truncated: visibleSessions.length < sessionData.length
    });
  }
  /**
   * Resolve a coding_session_id (resource URI string) to an IAgentSession.
   * Falls back to the currently active session when id is missing/unknown.
   */
  async _resolveSession(coding_session_id) {
    const sessions = this.agentSessionsService.model.sessions.filter((s) => !s.isArchived());
    if (coding_session_id) {
      const match = sessions.find((s) => s.resource.toString() === coding_session_id);
      if (match) {
        return match;
      }
    }
    const currentResource = await this._delegate?.getCurrentSessionResource();
    if (currentResource) {
      const active = sessions.find((s) => s.resource.toString() === currentResource.toString());
      if (active) {
        return active;
      }
    }
    return sessions[0];
  }
  /**
   * Gather files touched + per-file insertions/deletions for a session.
   * Returns a JSON string keyed for the LLM follow-up to summarize.
   */
  async _gatherSessionChanges(coding_session_id) {
    const session = await this._resolveSession(coding_session_id);
    if (!session) {
      return JSON.stringify({ session_id: coding_session_id ?? null, files: [], note: "session_not_found" });
    }
    const changes = session.changes;
    const files = [];
    let totalInsertions = 0;
    let totalDeletions = 0;
    let totalFiles = 0;
    if (Array.isArray(changes)) {
      for (const c of changes) {
        const uri = c.modifiedUri ?? c.uri;
        const path = uri ? this._formatPath(uri) : "(unknown)";
        files.push({ path, insertions: c.insertions, deletions: c.deletions });
        totalInsertions += c.insertions;
        totalDeletions += c.deletions;
      }
      totalFiles = files.length;
    } else if (changes && !Array.isArray(changes)) {
      const summary = changes;
      totalInsertions = summary.insertions;
      totalDeletions = summary.deletions;
      totalFiles = summary.files;
    }
    return JSON.stringify({
      session_id: session.resource.toString(),
      total_files: totalFiles,
      total_insertions: totalInsertions,
      total_deletions: totalDeletions,
      files: files.slice(0, 20),
      // cap so LLM context stays bounded
      truncated: files.length > 20
    });
  }
  /**
   * Gather the last N user/assistant turns of a coding session — actual
   * conversation content, trimmed for spoken summarization.
   */
  async _gatherSessionThread(coding_session_id, lastN) {
    const session = await this._resolveSession(coding_session_id);
    if (!session) {
      return JSON.stringify({ session_id: coding_session_id ?? null, turns: [], note: "session_not_found" });
    }
    const model = this.chatService.getSession(session.resource);
    if (!model) {
      return JSON.stringify({
        session_id: session.resource.toString(),
        turns: [],
        note: "chat_model_not_loaded"
      });
    }
    const reqs = model.getRequests().slice(-lastN);
    const turns = reqs.map((req) => {
      const userText = req.message.text || "";
      const assistantText = req.response?.response.value.filter((p) => p.kind === "markdownContent").map((p) => p.content.value).join(" ").slice(0, 600) || "";
      return {
        user: userText.slice(0, 400),
        assistant: assistantText
      };
    });
    return JSON.stringify({
      session_id: session.resource.toString(),
      turn_count: turns.length,
      turns
    });
  }
  /** Render a URI as a short relative-ish path for spoken summaries. */
  _formatPath(uri) {
    const parts = uri.path.split("/").filter(Boolean);
    if (parts.length <= 2) {
      return uri.path.replace(/^\//, "");
    }
    return parts.slice(-2).join("/");
  }
};
VoiceToolDispatchService = __decorateClass([
  __decorateParam(0, IAgentSessionsService),
  __decorateParam(1, IChatService),
  __decorateParam(2, ILanguageModelToolsService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IFileService)
], VoiceToolDispatchService);
registerSingleton(IVoiceToolDispatchService, VoiceToolDispatchService, InstantiationType.Delayed);
export {
  IVoiceToolDispatchService,
  VoiceToolDispatchService,
  resolveVoiceModel
};
