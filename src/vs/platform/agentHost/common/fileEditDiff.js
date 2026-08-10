import { URI } from "../../../base/common/uri.js";
import { isEqual } from "../../../base/common/resources.js";
import { canonicalizeSessionDbUri } from "./sessionDbUri.js";
import { FileEditKind } from "./state/sessionState.js";
function normalizeFileEdit(edit) {
  const beforeUri = edit.before ? URI.parse(edit.before.uri) : void 0;
  const afterUri = edit.after ? URI.parse(edit.after.uri) : void 0;
  const resource = afterUri ?? beforeUri;
  if (!resource) {
    return void 0;
  }
  let kind;
  if (!beforeUri && afterUri) {
    kind = FileEditKind.Create;
  } else if (beforeUri && !afterUri) {
    kind = FileEditKind.Delete;
  } else if (beforeUri && afterUri && !isEqual(beforeUri, afterUri)) {
    kind = FileEditKind.Rename;
  } else {
    kind = FileEditKind.Edit;
  }
  return {
    kind,
    resource,
    beforeUri,
    afterUri,
    beforeContentUri: edit.before?.content.uri && beforeUri ? canonicalizeSessionDbUri(URI.parse(edit.before.content.uri), beforeUri) : void 0,
    afterContentUri: edit.after?.content.uri && afterUri ? canonicalizeSessionDbUri(URI.parse(edit.after.content.uri), afterUri) : void 0
  };
}
export {
  normalizeFileEdit
};
