import { encodeBase64 } from "../../../../../../base/common/buffer.js";
import { observableValue } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../chatService/chatService.js";
import { isToolResultOutputDetails } from "../../tools/languageModelToolsService.js";
class ChatToolInvocation {
  constructor(preparedInvocation, toolData, toolCallId, subAgentInvocationId, parameters, startOptions = {}, chatRequestId) {
    this.toolCallId = toolCallId;
    this.kind = "toolInvocation";
    this.isAttachedToThinking = false;
    this._toolSpecificDataKind = observableValue(this, void 0);
    this.toolSpecificDataKind = this._toolSpecificDataKind;
    this._progress = observableValue(this, { progress: 0 });
    // Streaming-related observables
    this._partialInput = observableValue(this, void 0);
    this._streamingMessage = observableValue(this, void 0);
    let defaultMessage = "";
    if (startOptions.startInStreaming) {
      defaultMessage = toolData.displayName;
    } else if (startOptions.startInCancelled) {
      defaultMessage = startOptions.cancelReasonMessage ?? localize("toolDeniedMessage", 'Tool "{0}" was denied', toolData.displayName);
    }
    this.invocationMessage = preparedInvocation?.invocationMessage ?? defaultMessage;
    this.pastTenseMessage = preparedInvocation?.pastTenseMessage;
    this.originMessage = preparedInvocation?.originMessage;
    this.confirmationMessages = preparedInvocation?.confirmationMessages;
    this.presentation = preparedInvocation?.presentation;
    this.toolSpecificData = preparedInvocation?.toolSpecificData;
    this.toolId = toolData.id;
    this.icon = preparedInvocation?.icon ?? (toolData.icon && ThemeIcon.isThemeIcon(toolData.icon) ? toolData.icon : void 0);
    this.source = toolData.source;
    this.subAgentInvocationId = subAgentInvocationId;
    this.parameters = parameters;
    this.chatRequestId = chatRequestId;
    if (startOptions.startInCancelled) {
      this._state = observableValue(this, {
        type: IChatToolInvocation.StateKind.Cancelled,
        reason: startOptions.cancelReason ?? ToolConfirmKind.Denied,
        reasonMessage: startOptions.cancelReasonMessage,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages
      });
    } else if (startOptions.startInStreaming) {
      this._state = observableValue(this, {
        type: IChatToolInvocation.StateKind.Streaming,
        partialInput: this._partialInput,
        streamingMessage: this._streamingMessage
      });
    } else if (!this.confirmationMessages?.title) {
      this._state = observableValue(this, {
        type: IChatToolInvocation.StateKind.Executing,
        confirmed: { type: ToolConfirmKind.ConfirmationNotNeeded, reason: this.confirmationMessages?.confirmationNotNeededReason },
        progress: this._progress,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages
      });
    } else {
      this._state = observableValue(this, {
        type: IChatToolInvocation.StateKind.WaitingForConfirmation,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages,
        confirm: (reason) => this._confirm(reason)
      });
    }
  }
  get toolSpecificData() {
    return this._toolSpecificData;
  }
  set toolSpecificData(value) {
    this._toolSpecificData = value;
    this._toolSpecificDataKind.set(value?.kind, void 0);
  }
  get state() {
    return this._state;
  }
  /**
   * Create a tool invocation in streaming state.
   * Use this when the tool call is beginning to stream partial input from the LM.
   */
  static createStreaming(options) {
    return new ChatToolInvocation(void 0, options.toolData, options.toolCallId, options.subagentInvocationId, void 0, { startInStreaming: true }, options.chatRequestId);
  }
  /**
   * Create a tool invocation already in cancelled state.
   * Use this when a hook denies tool execution before it even starts.
   */
  static createCancelled(options, parameters, reason, reasonMessage) {
    return new ChatToolInvocation(void 0, options.toolData, options.toolCallId, options.subagentInvocationId, parameters, { startInCancelled: true, cancelReason: reason, cancelReasonMessage: reasonMessage }, options.chatRequestId);
  }
  /**
   * Shared confirmation handler used by every `WaitingForConfirmation` state
   * this invocation can enter (initial construction, transition out of
   * streaming, and re-arming via {@link requestConfirmation}). Denials/skips
   * cancel; anything else moves to executing.
   */
  _confirm(reason) {
    if (reason.type === ToolConfirmKind.Denied || reason.type === ToolConfirmKind.Skipped) {
      this._state.set({
        type: IChatToolInvocation.StateKind.Cancelled,
        reason: reason.type,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages
      }, void 0);
    } else {
      this._state.set({
        type: IChatToolInvocation.StateKind.Executing,
        confirmed: reason,
        progress: this._progress,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages
      }, void 0);
    }
  }
  /**
   * Update the partial input observable during streaming.
   */
  updatePartialInput(input) {
    if (this._state.get().type !== IChatToolInvocation.StateKind.Streaming) {
      return;
    }
    this._partialInput.set(input, void 0);
  }
  /**
   * Update the streaming message (from handleToolStream).
   */
  updateStreamingMessage(message) {
    const state = this._state.get();
    if (state.type !== IChatToolInvocation.StateKind.Streaming) {
      return;
    }
    this._streamingMessage.set(message, void 0);
  }
  /**
   * Notifies state observers that `toolSpecificData` has been mutated.
   * Since `toolSpecificData` isn't observable, this re-sets the internal
   * state to trigger autoruns that need to re-read tool metadata.
   */
  notifyToolSpecificDataChanged() {
    const current = this._state.get();
    this._state.set({ ...current }, void 0);
  }
  updateConfirmationMessages(confirmationMessages) {
    const current = this._state.get();
    if (current.type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return;
    }
    this.confirmationMessages = confirmationMessages;
    this._state.set({ ...current, confirmationMessages }, void 0);
  }
  /**
   * Cancel a streaming invocation directly (e.g., when preToolUse hook denies).
   * Only works when in Streaming state.
   * @returns true if the cancellation was applied, false if not in streaming state
   */
  cancelFromStreaming(reason, reasonMessage) {
    const currentState = this._state.get();
    if (currentState.type !== IChatToolInvocation.StateKind.Streaming) {
      return false;
    }
    this._state.set({
      type: IChatToolInvocation.StateKind.Cancelled,
      reason,
      reasonMessage,
      parameters: this.parameters,
      confirmationMessages: this.confirmationMessages
    }, void 0);
    return true;
  }
  /**
   * Transition from streaming state to prepared/executing state.
   * Called when the full tool call is ready.
   */
  transitionFromStreaming(preparedInvocation, parameters, autoConfirmed) {
    const currentState = this._state.get();
    if (currentState.type !== IChatToolInvocation.StateKind.Streaming) {
      return;
    }
    const lastStreamingMessage = this._streamingMessage.get();
    if (lastStreamingMessage && !preparedInvocation?.invocationMessage) {
      this.invocationMessage = lastStreamingMessage;
    }
    this._updatePreparedInvocation(preparedInvocation, parameters);
    if (autoConfirmed) {
      this._confirm(autoConfirmed);
    } else if (!this.confirmationMessages?.title) {
      this._state.set({
        type: IChatToolInvocation.StateKind.Executing,
        confirmed: { type: ToolConfirmKind.ConfirmationNotNeeded, reason: this.confirmationMessages?.confirmationNotNeededReason },
        progress: this._progress,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages
      }, void 0);
    } else {
      this._state.set({
        type: IChatToolInvocation.StateKind.WaitingForConfirmation,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages,
        confirm: (reason) => this._confirm(reason)
      }, void 0);
    }
  }
  /**
   * Applies locally prepared parameters and presentation without changing an
   * invocation state already established by an external protocol.
   */
  updatePreparedInvocation(preparedInvocation, parameters) {
    const currentState = this._state.get();
    if (currentState.type === IChatToolInvocation.StateKind.Streaming || currentState.type === IChatToolInvocation.StateKind.Completed || currentState.type === IChatToolInvocation.StateKind.Cancelled) {
      return false;
    }
    this._updatePreparedInvocation(preparedInvocation, parameters);
    this._state.set({
      ...currentState,
      parameters: this.parameters,
      confirmationMessages: this.confirmationMessages
    }, void 0);
    return true;
  }
  _updatePreparedInvocation(preparedInvocation, parameters) {
    this.parameters = parameters;
    if (!preparedInvocation) {
      return;
    }
    if (preparedInvocation.invocationMessage) {
      this.invocationMessage = preparedInvocation.invocationMessage;
    }
    this.pastTenseMessage = preparedInvocation.pastTenseMessage;
    this.confirmationMessages = preparedInvocation.confirmationMessages;
    this.presentation = preparedInvocation.presentation;
    this.toolSpecificData = preparedInvocation.toolSpecificData;
  }
  /** Moves an active invocation into confirmation while preserving the same tool card. */
  requestConfirmation(preparedInvocation) {
    const currentType = this._state.get().type;
    if (currentType === IChatToolInvocation.StateKind.Streaming) {
      this.transitionFromStreaming(preparedInvocation, this.parameters, void 0);
      return;
    }
    if (currentType === IChatToolInvocation.StateKind.Completed || currentType === IChatToolInvocation.StateKind.Cancelled || currentType === IChatToolInvocation.StateKind.WaitingForConfirmation) {
      return;
    }
    if (preparedInvocation.invocationMessage) {
      this.invocationMessage = preparedInvocation.invocationMessage;
    }
    this.pastTenseMessage = preparedInvocation.pastTenseMessage;
    this.confirmationMessages = preparedInvocation.confirmationMessages;
    this.presentation = preparedInvocation.presentation;
    this.toolSpecificData = preparedInvocation.toolSpecificData;
    if (!this.confirmationMessages?.title) {
      return;
    }
    this._state.set({
      type: IChatToolInvocation.StateKind.WaitingForConfirmation,
      parameters: this.parameters,
      confirmationMessages: this.confirmationMessages,
      confirm: (reason) => this._confirm(reason)
    }, void 0);
  }
  _setCompleted(result, postConfirmed) {
    if (postConfirmed && (postConfirmed.type === ToolConfirmKind.Denied || postConfirmed.type === ToolConfirmKind.Skipped)) {
      this._state.set({
        type: IChatToolInvocation.StateKind.Cancelled,
        reason: postConfirmed.type,
        parameters: this.parameters,
        confirmationMessages: this.confirmationMessages
      }, void 0);
      return;
    }
    this._state.set({
      type: IChatToolInvocation.StateKind.Completed,
      confirmed: IChatToolInvocation.executionConfirmedOrDenied(this) || { type: ToolConfirmKind.ConfirmationNotNeeded },
      resultDetails: result?.toolResultDetails,
      postConfirmed,
      contentForModel: result?.content || [],
      parameters: this.parameters,
      confirmationMessages: this.confirmationMessages
    }, void 0);
  }
  async didExecuteTool(result, final, checkIfResultAutoApproved) {
    if (result?.toolSpecificData) {
      this.toolSpecificData = result.toolSpecificData;
    }
    if (result?.toolResultMessage) {
      this.pastTenseMessage = result.toolResultMessage;
    } else if (this._progress.get().message) {
      this.pastTenseMessage = this._progress.get().message;
    }
    if (this.confirmationMessages?.confirmResults && !result?.toolResultError && result?.confirmResults !== false && !final) {
      const autoApproved = await checkIfResultAutoApproved?.();
      if (autoApproved) {
        this._setCompleted(result, autoApproved);
      } else {
        this._state.set({
          type: IChatToolInvocation.StateKind.WaitingForPostApproval,
          confirmed: IChatToolInvocation.executionConfirmedOrDenied(this) || { type: ToolConfirmKind.ConfirmationNotNeeded },
          resultDetails: result?.toolResultDetails,
          contentForModel: result?.content || [],
          confirm: (reason) => this._setCompleted(result, reason),
          parameters: this.parameters,
          confirmationMessages: this.confirmationMessages
        }, void 0);
      }
    } else {
      this._setCompleted(result);
    }
    return this._state.get();
  }
  setAuthenticationRequired(server, cancel = () => {
  }) {
    const state = this._state.get();
    if (state.type !== IChatToolInvocation.StateKind.Executing && state.type !== IChatToolInvocation.StateKind.WaitingForAuthentication) {
      return;
    }
    this._state.set({
      type: IChatToolInvocation.StateKind.WaitingForAuthentication,
      server,
      // Agent-host status can refresh while the same authentication request
      // remains pending. Keep the callback that identifies and cancels this
      // occurrence; replace it only after authentication resolves and the tool
      // enters a new WaitingForAuthentication state.
      cancel: state.type === IChatToolInvocation.StateKind.WaitingForAuthentication ? state.cancel : cancel,
      confirmed: state.confirmed,
      parameters: state.parameters,
      confirmationMessages: state.confirmationMessages
    }, void 0);
  }
  setAuthenticationResolved() {
    const state = this._state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForAuthentication) {
      return;
    }
    this._state.set({
      type: IChatToolInvocation.StateKind.Executing,
      confirmed: state.confirmed,
      progress: this._progress,
      parameters: state.parameters,
      confirmationMessages: state.confirmationMessages
    }, void 0);
  }
  acceptProgress(step) {
    const prev = this._progress.get();
    this._progress.set({
      progress: step.progress || prev.progress || 0,
      message: step.message
    }, void 0);
  }
  toJSON() {
    const waitingForPostApproval = this.state.get().type === IChatToolInvocation.StateKind.WaitingForPostApproval;
    const details = waitingForPostApproval ? void 0 : IChatToolInvocation.resultDetails(this);
    return {
      kind: "toolInvocationSerialized",
      presentation: this.presentation,
      invocationMessage: this.invocationMessage,
      pastTenseMessage: this.pastTenseMessage,
      originMessage: this.originMessage,
      isConfirmed: waitingForPostApproval ? { type: ToolConfirmKind.Skipped } : IChatToolInvocation.executionConfirmedOrDenied(this),
      isComplete: true,
      source: this.source,
      resultDetails: isToolResultOutputDetails(details) ? { output: { type: "data", mimeType: details.output.mimeType, base64Data: encodeBase64(details.output.value) } } : details,
      toolSpecificData: this.toolSpecificData?.kind === "automationConfiguration" ? void 0 : this.toolSpecificData,
      toolCallId: this.toolCallId,
      toolId: this.toolId,
      subAgentInvocationId: this.subAgentInvocationId,
      generatedTitle: this.generatedTitle
    };
  }
}
export {
  ChatToolInvocation
};
