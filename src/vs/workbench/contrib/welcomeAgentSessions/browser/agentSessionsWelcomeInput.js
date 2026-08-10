import { localize } from "../../../../nls.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { URI } from "../../../../base/common/uri.js";
import { Schemas } from "../../../../base/common/network.js";
const agentSessionsWelcomeInputTypeId = "workbench.editors.agentSessionsWelcomeInput";
class AgentSessionsWelcomeInput extends EditorInput {
  static {
    this.ID = agentSessionsWelcomeInputTypeId;
  }
  static {
    this.RESOURCE = URI.from({ scheme: Schemas.walkThrough, authority: "vscode_agent_sessions_welcome" });
  }
  get typeId() {
    return AgentSessionsWelcomeInput.ID;
  }
  get editorId() {
    return this.typeId;
  }
  toUntyped() {
    return {
      resource: AgentSessionsWelcomeInput.RESOURCE,
      options: {
        override: AgentSessionsWelcomeInput.ID,
        pinned: false
      }
    };
  }
  get resource() {
    return AgentSessionsWelcomeInput.RESOURCE;
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    return other instanceof AgentSessionsWelcomeInput;
  }
  constructor(options = {}) {
    super();
    this._showTelemetryNotice = !!options.showTelemetryNotice;
    this._initiator = options.initiator ?? "command";
    this._workspaceKind = options.workspaceKind;
  }
  getName() {
    return localize("agentSessionsWelcome", "Welcome");
  }
  get showTelemetryNotice() {
    return this._showTelemetryNotice;
  }
  set showTelemetryNotice(value) {
    this._showTelemetryNotice = value;
  }
  get initiator() {
    return this._initiator;
  }
  get workspaceKind() {
    return this._workspaceKind;
  }
  getTelemetryDescriptor() {
    const descriptor = super.getTelemetryDescriptor();
    descriptor["initiator"] = this._initiator;
    descriptor["workspaceKind"] = this._workspaceKind;
    return descriptor;
  }
}
export {
  AgentSessionsWelcomeInput,
  agentSessionsWelcomeInputTypeId
};
