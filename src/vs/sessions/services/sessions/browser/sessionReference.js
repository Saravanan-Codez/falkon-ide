import { URI } from "../../../../base/common/uri.js";
function isSessionReferenceVariableEntry(entry) {
  const value = entry.value;
  return !!value && typeof value === "object" && value.sessionReference === true && typeof value.sessionResource === "string";
}
function getSessionReferenceResource(entry) {
  if (!isSessionReferenceVariableEntry(entry)) {
    return void 0;
  }
  try {
    return URI.parse(entry.value.sessionResource);
  } catch {
    return void 0;
  }
}
function createSessionReferenceVariableEntry(rawId, name, sessionResource) {
  return {
    kind: "generic",
    id: `session:${rawId}`,
    name,
    value: { sessionReference: true, sessionResource: sessionResource.toString() }
  };
}
export {
  createSessionReferenceVariableEntry,
  getSessionReferenceResource,
  isSessionReferenceVariableEntry
};
