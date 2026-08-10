import { StopWatch } from "../../../base/common/stopwatch.js";
import { ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputRequestPurpose, ChatInputResponseKind, ResponsePartKind, isAhpChatChannel, parseRequiredSessionUriFromChatUri } from "../common/state/sessionState.js";
class AgentHostInputRequestTracker {
  constructor(_reporter, _stopWatchFactory = () => StopWatch.create(true)) {
    this._reporter = _reporter;
    this._stopWatchFactory = _stopWatchFactory;
    this._pending = /* @__PURE__ */ new Map();
  }
  inputRequested(provider, session, turnId, request) {
    const key = this._key(session, request.id);
    if (request.purpose !== ChatInputRequestPurpose.AskUser) {
      this._pending.delete(key);
      return;
    }
    const existing = this._pending.get(key);
    if (existing) {
      existing.request = request;
      return;
    }
    this._pending.set(key, {
      stopWatch: this._stopWatchFactory(),
      provider,
      session,
      turnId,
      request
    });
  }
  inputCompleted(session, action, state) {
    const key = this._key(session, action.requestId);
    const timing = this._pending.get(key);
    if (!timing) {
      return;
    }
    this._pending.delete(key);
    if (action.response !== ChatInputResponseKind.Accept || state?.activeTurn?.id !== timing.turnId) {
      return;
    }
    const part = state.activeTurn.responseParts.find(
      (part2) => part2.kind === ResponsePartKind.InputRequest && part2.request.id === action.requestId && part2.response === ChatInputResponseKind.Accept
    );
    if (!part || part.kind !== ResponsePartKind.InputRequest || part.request.purpose !== ChatInputRequestPurpose.AskUser) {
      return;
    }
    const questions = part.request.questions ?? timing.request.questions ?? [];
    const answers = part.request.answers ?? {};
    const answeredCount = questions.filter((question) => this._isAnswered(answers[question.id])).length;
    this._reporter.askQuestionsToolInvoked({
      provider: timing.provider,
      session: timing.session,
      requestId: timing.turnId,
      questionCount: questions.length,
      answeredCount,
      skippedCount: questions.length - answeredCount,
      freeTextCount: questions.filter((question) => this._isFreeTextAnswer(answers[question.id])).length,
      recommendedAvailableCount: questions.filter((question) => this._recommendedOptions(question).length > 0).length,
      recommendedSelectedCount: questions.filter((question) => this._isRecommendedSelected(question, answers[question.id])).length,
      duration: timing.stopWatch.elapsed()
    });
  }
  clearTurn(session, turnId) {
    for (const [key, timing] of this._pending) {
      if (timing.session === session && timing.turnId === turnId) {
        this._pending.delete(key);
      }
    }
  }
  clearChat(session) {
    for (const [key, timing] of this._pending) {
      if (timing.session === session) {
        this._pending.delete(key);
      }
    }
  }
  clearAgentSession(session) {
    for (const [key, timing] of this._pending) {
      const owningSession = isAhpChatChannel(timing.session) ? parseRequiredSessionUriFromChatUri(timing.session) : timing.session;
      if (owningSession === session) {
        this._pending.delete(key);
      }
    }
  }
  clear() {
    this._pending.clear();
  }
  _isAnswered(answer) {
    return answer !== void 0 && answer.state !== ChatInputAnswerState.Skipped;
  }
  _isFreeTextAnswer(answer) {
    if (!this._isAnswered(answer)) {
      return false;
    }
    if (answer.value.kind === ChatInputAnswerValueKind.Text) {
      return true;
    }
    return (answer.value.kind === ChatInputAnswerValueKind.Selected || answer.value.kind === ChatInputAnswerValueKind.SelectedMany) && answer.value.freeformValues?.some((value) => value.length > 0) === true;
  }
  _recommendedOptions(question) {
    if (question.kind !== ChatInputQuestionKind.SingleSelect && question.kind !== ChatInputQuestionKind.MultiSelect) {
      return [];
    }
    return question.options.filter((option) => option.recommended).map((option) => option.id);
  }
  _isRecommendedSelected(question, answer) {
    if (!this._isAnswered(answer)) {
      return false;
    }
    const recommended = this._recommendedOptions(question);
    if (answer.value.kind === ChatInputAnswerValueKind.Selected) {
      return recommended.includes(answer.value.value);
    }
    if (answer.value.kind === ChatInputAnswerValueKind.SelectedMany) {
      return answer.value.value.some((value) => recommended.includes(value));
    }
    return false;
  }
  _key(session, requestId) {
    return `${session}\0${requestId}`;
  }
}
export {
  AgentHostInputRequestTracker
};
