import { startProfiling } from "../../../base/node/profiling.js";
import { generateUuid } from "../../../base/common/uuid.js";
class InspectProfilingService {
  constructor() {
    this._sessions = /* @__PURE__ */ new Map();
  }
  async startProfiling(options) {
    const session = await startProfiling({ host: options.host, port: options.port, checkForPaused: true });
    const id = generateUuid();
    this._sessions.set(id, session);
    return id;
  }
  async stopProfiling(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`UNKNOWN session '${sessionId}'`);
    }
    const result = await session.stop();
    this._sessions.delete(sessionId);
    return result.profile;
  }
}
export {
  InspectProfilingService
};
