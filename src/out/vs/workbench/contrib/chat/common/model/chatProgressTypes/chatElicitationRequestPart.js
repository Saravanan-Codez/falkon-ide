import { observableValue } from "../../../../../../base/common/observable.js";
import { ElicitationState } from "../../chatService/chatService.js";
class ChatElicitationRequestPart {
  constructor(title, message, subtitle, acceptButtonLabel, rejectButtonLabel, _accept, reject, source, moreActions, onHide, riskAssessment) {
    this.title = title;
    this.message = message;
    this.subtitle = subtitle;
    this.acceptButtonLabel = acceptButtonLabel;
    this.rejectButtonLabel = rejectButtonLabel;
    this._accept = _accept;
    this.source = source;
    this.moreActions = moreActions;
    this.onHide = onHide;
    this.riskAssessment = riskAssessment;
    this.kind = "elicitation2";
    this.state = observableValue("state", ElicitationState.Pending);
    this._isHiddenValue = observableValue("isHidden", false);
    this.isHidden = this._isHiddenValue;
    if (reject) {
      this.reject = async () => {
        const state = await reject();
        this.state.set(state, void 0);
      };
    }
  }
  accept(value) {
    return this._accept(value).then((state) => {
      this.state.set(state, void 0);
    });
  }
  hide() {
    if (this._isHiddenValue.get()) {
      return;
    }
    this._isHiddenValue.set(true, void 0, void 0);
    this.onHide?.();
    if (this.state.get() === ElicitationState.Pending) {
      this.state.set(ElicitationState.Rejected, void 0);
    }
  }
  toJSON() {
    const state = this.state.get();
    return {
      kind: "elicitationSerialized",
      title: this.title,
      message: this.message,
      state: state === ElicitationState.Pending ? ElicitationState.Rejected : state,
      acceptedResult: this.acceptedResult,
      subtitle: this.subtitle,
      source: this.source,
      isHidden: this._isHiddenValue.get()
    };
  }
}
export {
  ChatElicitationRequestPart
};
