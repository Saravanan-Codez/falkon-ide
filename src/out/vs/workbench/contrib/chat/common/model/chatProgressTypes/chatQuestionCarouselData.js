import { DeferredPromise } from "../../../../../../base/common/async.js";
class ChatQuestionCarouselData {
  constructor(questions, allowSkip, resolveId, data, isUsed, message, source, terminalId, answerPresentation) {
    this.questions = questions;
    this.allowSkip = allowSkip;
    this.resolveId = resolveId;
    this.data = data;
    this.isUsed = isUsed;
    this.message = message;
    this.source = source;
    this.terminalId = terminalId;
    this.answerPresentation = answerPresentation;
    this.kind = "questionCarousel";
    this.completion = new DeferredPromise();
  }
  /**
   * Marks the carousel as dismissed with the given answers and clears draft
   * state. Safe to call multiple times — subsequent calls are no-ops.
   */
  dismiss(answers) {
    if (this.isUsed) {
      return;
    }
    this.data = answers ?? {};
    this.isUsed = true;
    this.draftAnswers = void 0;
    this.draftCurrentIndex = void 0;
    this.draftCollapsed = void 0;
    void this.completion.complete({ answers });
  }
  toJSON() {
    return {
      kind: this.kind,
      questions: this.questions,
      allowSkip: this.allowSkip,
      resolveId: this.resolveId,
      data: this.data,
      isUsed: this.isUsed,
      answeredExternally: this.answeredExternally,
      autoReply: this.autoReply,
      message: this.message,
      source: this.source,
      terminalId: this.terminalId,
      answerPresentation: this.answerPresentation
    };
  }
}
export {
  ChatQuestionCarouselData
};
