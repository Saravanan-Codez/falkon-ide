import { encodeHex, VSBuffer } from "../../../../base/common/buffer.js";
import { URI } from "../../../../base/common/uri.js";
import { InMemoryFileSystemProvider } from "../../../files/common/inMemoryFilesystemProvider.js";
const PENDING_EDIT_CONTENT_SCHEME = "pending-edit-content";
function buildPendingEditContentUri(sessionUri, toolCallId, filePath) {
  return URI.from({
    scheme: PENDING_EDIT_CONTENT_SCHEME,
    authority: encodeHex(VSBuffer.fromString(sessionUri)).toString(),
    path: `/${encodeURIComponent(toolCallId)}/${encodeHex(VSBuffer.fromString(filePath))}`
  });
}
function registerPendingEditContentProvider(fileService) {
  const provider = new InMemoryFileSystemProvider();
  const registration = fileService.registerProvider(PENDING_EDIT_CONTENT_SCHEME, provider);
  return {
    dispose() {
      registration.dispose();
      provider.dispose();
    }
  };
}
export {
  PENDING_EDIT_CONTENT_SCHEME,
  buildPendingEditContentUri,
  registerPendingEditContentProvider
};
