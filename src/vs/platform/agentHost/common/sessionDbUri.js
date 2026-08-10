import { decodeHex } from "../../../base/common/buffer.js";
import { URI } from "../../../base/common/uri.js";
const SESSION_DB_SCHEME = "session-db";
function buildSessionDbUri(sessionUri, toolCallId, filePath, part) {
  return sessionDbUri(URI.file(filePath).path, { sessionUri, toolCallId, filePath, part }).toString();
}
function sessionDbUri(path, fields) {
  return URI.from({ scheme: SESSION_DB_SCHEME, path, query: JSON.stringify(fields) });
}
function parseSessionDbUri(raw) {
  let parsed;
  try {
    parsed = URI.parse(raw);
  } catch {
    return void 0;
  }
  if (parsed.scheme !== SESSION_DB_SCHEME) {
    return void 0;
  }
  return parsed.query ? parseSessionDbUriQuery(parsed.query) : parseLegacySessionDbUri(parsed);
}
function canonicalizeSessionDbUri(uri, fileUri) {
  if (uri.scheme !== SESSION_DB_SCHEME || uri.query) {
    return uri;
  }
  const fields = parseLegacySessionDbUri(uri);
  if (!fields) {
    return uri;
  }
  return sessionDbUri(fileUri.path, fields);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function parseSessionDbUriQuery(query) {
  let fields;
  try {
    fields = JSON.parse(query);
  } catch {
    return void 0;
  }
  if (typeof fields !== "object" || fields === null) {
    return void 0;
  }
  const { sessionUri, toolCallId, filePath, part } = fields;
  if (!isNonEmptyString(sessionUri) || !isNonEmptyString(toolCallId) || !isNonEmptyString(filePath) || part !== "before" && part !== "after") {
    return void 0;
  }
  return { sessionUri, toolCallId, filePath, part };
}
function parseLegacySessionDbUri(uri) {
  const [, toolCallId, filePath, part] = uri.path.split("/");
  if (!toolCallId || !filePath || part !== "before" && part !== "after") {
    return void 0;
  }
  try {
    return {
      sessionUri: decodeHex(uri.authority).toString(),
      toolCallId: decodeURIComponent(toolCallId),
      filePath: decodeHex(filePath).toString(),
      part
    };
  } catch {
    return void 0;
  }
}
export {
  buildSessionDbUri,
  canonicalizeSessionDbUri,
  parseSessionDbUri
};
