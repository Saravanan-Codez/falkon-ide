import { localize } from "../../../../../../nls.js";
import { RawContextKey } from "../../../../../../platform/contextkey/common/contextkey.js";
const inAgentSessionProjection = new RawContextKey("chatInAgentSessionProjection", false, { type: "boolean", description: localize("chatInAgentSessionProjection", "True when the workbench is in agent session projection mode for reviewing an agent session.") });
export {
  inAgentSessionProjection
};
