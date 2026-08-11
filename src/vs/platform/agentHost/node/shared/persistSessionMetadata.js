import { URI } from "../../../../base/common/uri.js";
function persistSessionMetadata(sessionDataService, logService, session, key, value) {
  const onError = (err) => {
    logService.warn(`[AgentHost] Failed to persist session metadata '${key}'`, err);
  };
  try {
    const ref = sessionDataService.openDatabase(URI.parse(session));
    ref.object.setMetadata(key, value).catch(onError).finally(() => {
      ref.dispose();
    });
  } catch (err) {
    onError(err);
  }
}
export {
  persistSessionMetadata
};
