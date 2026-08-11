import { addDisposableListener } from "./dom.js";
import { Disposable } from "../common/lifecycle.js";
import { Mimes } from "../common/mime.js";
class DelayedDragHandler extends Disposable {
  constructor(container, callback) {
    super();
    this.timeout = void 0;
    this._register(addDisposableListener(container, "dragover", (e) => {
      e.preventDefault();
      if (!this.timeout) {
        this.timeout = setTimeout(() => {
          callback();
          this.timeout = void 0;
        }, 800);
      }
    }));
    ["dragleave", "drop", "dragend"].forEach((type) => {
      this._register(addDisposableListener(container, type, () => {
        this.clearDragTimeout();
      }));
    });
  }
  clearDragTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = void 0;
    }
  }
  dispose() {
    super.dispose();
    this.clearDragTimeout();
  }
}
const DataTransfers = {
  /**
   * Application specific resource transfer type
   */
  RESOURCES: "ResourceURLs",
  /**
   * Browser specific transfer type to download
   */
  DOWNLOAD_URL: "DownloadURL",
  /**
   * Browser specific transfer type for files
   */
  FILES: "Files",
  /**
   * Typically transfer type for copy/paste transfers.
   */
  TEXT: Mimes.text,
  /**
   * Internal type used to pass around text/uri-list data.
   *
   * This is needed to work around https://bugs.chromium.org/p/chromium/issues/detail?id=239745.
   */
  INTERNAL_URI_LIST: "application/vnd.code.uri-list"
};
export {
  DataTransfers,
  DelayedDragHandler
};
