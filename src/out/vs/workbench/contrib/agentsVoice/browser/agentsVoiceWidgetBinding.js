import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { AgentSessionStatus, getAgentChangesSummary } from "../../chat/browser/agentSessions/agentSessionsModel.js";
import { getRepositoryName } from "../../chat/browser/agentSessions/agentSessionsViewer.js";
function bindWidgetToController(widget, services) {
  const store = new DisposableStore();
  const {
    voiceSessionController: controller,
    agentSessionsService,
    agentTitleBarStatusService,
    voicePlaybackService,
    environmentService,
    configurationService
  } = services;
  store.add(autorun((reader) => {
    const state = controller.voiceState.read(reader);
    const connected = controller.isConnected.read(reader);
    const connecting = controller.isConnecting.read(reader);
    const reconnecting = controller.isReconnecting.read(reader);
    const toolConfirmations = controller.pendingToolConfirmations.read(reader);
    const speakingSession = voicePlaybackService.speakingSession.read(reader);
    const statusText = controller.statusText.read(reader);
    const turns = controller.transcriptTurns.read(reader);
    const targetSession = controller.targetSession.read(reader);
    widget.setConnected(connected);
    widget.setConnecting(connecting);
    widget.setReconnecting(reconnecting);
    widget.setVoiceState(state);
    widget.setPendingToolConfirmations(toolConfirmations);
    const showTranscript = configurationService?.getValue("agents.voice.showTranscript") !== false;
    widget.setTranscriptTurns(showTranscript ? turns : []);
    widget.setStatusText(statusText);
    widget.setSelectedTargetSession(targetSession);
    if (speakingSession) {
      const sessions = agentSessionsService.model.sessions;
      const match = sessions.find((s) => s.resource.toString() === speakingSession.toString());
      widget.setSpeakingSession(speakingSession, match?.label);
    } else {
      widget.setSpeakingSession(void 0, void 0);
    }
    _updateSessionData(widget, services);
  }));
  const updateAll = () => {
    _updateStatusCounts(widget, services);
    _updateSessionData(widget, services);
  };
  store.add(agentSessionsService.model.onDidChangeSessions(updateAll));
  store.add(agentSessionsService.onDidChangeSessionArchivedState(updateAll));
  store.add(agentTitleBarStatusService.onDidChangeSessionInfo(updateAll));
  store.add(autorun((reader) => {
    voicePlaybackService.speakingSession.read(reader);
    if (services.chatService) {
      for (const model of services.chatService.chatModels.read(reader)) {
        model.hasActiveRequest.read(reader);
        model.requestNeedsInput.read(reader);
        const lastReq = model.lastRequestObs.read(reader);
        if (lastReq?.response) {
          lastReq.response.isIncomplete.read(reader);
          lastReq.response.isPendingConfirmation.read(reader);
        }
      }
    }
    _updateSessionData(widget, services);
  }));
  _updateStatusCounts(widget, services);
  _updateSessionData(widget, services);
  void environmentService;
  return store;
}
function _updateStatusCounts(widget, { agentSessionsService }) {
  const sessions = agentSessionsService.model.sessions.filter((s) => !s.isArchived());
  const oneHourAgo = Date.now() - 60 * 60 * 1e3;
  let working = 0;
  let needsInput = 0;
  let done = 0;
  for (const session of sessions) {
    switch (session.status) {
      case AgentSessionStatus.InProgress:
        working++;
        break;
      case AgentSessionStatus.NeedsInput:
        needsInput++;
        break;
      case AgentSessionStatus.Completed: {
        const endedAt = session.timing.lastRequestEnded ?? session.timing.created;
        if (endedAt && endedAt > oneHourAgo) {
          done++;
        }
        break;
      }
    }
  }
  widget.setStatusCounts(working, needsInput, done);
}
function _updateSessionData(widget, services) {
  const { agentSessionsService, voiceSessionController, voicePlaybackService, environmentService, chatService } = services;
  const sessions = agentSessionsService.model.sessions.filter((s) => !s.isArchived());
  const toolConfirmations = voiceSessionController.pendingToolConfirmations.get();
  const speakingSession = voicePlaybackService.speakingSession.get();
  const statusOrder = (s) => s.status === AgentSessionStatus.NeedsInput ? 0 : s.status === AgentSessionStatus.InProgress ? 1 : 2;
  const lastActivity = (s) => s.timing.lastRequestEnded ?? s.timing.lastRequestStarted ?? s.timing.created ?? 0;
  const sorted = [...sessions].sort((a, b) => {
    const statusDiff = statusOrder(a) - statusOrder(b);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return lastActivity(b) - lastActivity(a);
  });
  const sessionRows = sorted.map((session) => {
    const isSpeaking = speakingSession?.toString() === session.resource.toString();
    const changes = getAgentChangesSummary(session.changes);
    const tc = toolConfirmations.find((c) => c.sessionResource.toString() === session.resource.toString());
    return {
      resource: session.resource,
      label: session.label || localize("agentsVoice.untitledSession", "Untitled session"),
      isActive: session.status === AgentSessionStatus.InProgress,
      needsInput: session.status === AgentSessionStatus.NeedsInput,
      isIdle: session.status === AgentSessionStatus.Completed,
      isSpeaking,
      insertions: changes?.insertions ?? 0,
      deletions: changes?.deletions ?? 0,
      toolConfirmation: tc
    };
  });
  if (chatService) {
    const agentResources = new Set(sessionRows.map((r) => r.resource.toString()));
    const chatModels = chatService.chatModels.get();
    for (const model of chatModels) {
      if (agentResources.has(model.sessionResource.toString())) {
        continue;
      }
      const requests = model.getRequests();
      if (requests.length === 0) {
        continue;
      }
      const isActive = model.hasActiveRequest.get();
      const needsInput = !!model.requestNeedsInput.get();
      const tc = toolConfirmations.find((c) => c.sessionResource.toString() === model.sessionResource.toString());
      sessionRows.push({
        resource: model.sessionResource,
        label: model.title || localize("agentsVoice.chat", "Chat"),
        isActive: isActive && !needsInput,
        needsInput,
        isIdle: !isActive && !needsInput,
        isSpeaking: speakingSession?.toString() === model.sessionResource.toString(),
        insertions: 0,
        deletions: 0,
        toolConfirmation: tc
      });
    }
  }
  widget.setSessions(sessionRows);
  if (environmentService.isSessionsWindow) {
    const repoMap = /* @__PURE__ */ new Map();
    const otherRows = [];
    for (let i = 0; i < sorted.length; i++) {
      const repoName = getRepositoryName(sorted[i]);
      const row = sessionRows[i];
      if (repoName) {
        let group = repoMap.get(repoName);
        if (!group) {
          group = [];
          repoMap.set(repoName, group);
        }
        group.push(row);
      } else {
        otherRows.push(row);
      }
    }
    const groups = [];
    for (const [label, rows] of repoMap) {
      groups.push({ label, sessions: rows });
    }
    if (otherRows.length > 0) {
      groups.push({ label: localize("agentsVoice.otherSessions", "Other"), sessions: otherRows });
    }
    widget.setSessionGroups(groups.length > 0 ? groups : void 0);
  } else {
    widget.setSessionGroups(void 0);
  }
}
export {
  bindWidgetToController
};
