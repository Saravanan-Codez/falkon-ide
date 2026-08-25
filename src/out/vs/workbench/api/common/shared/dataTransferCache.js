import { coalesce } from "../../../../base/common/arrays.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
class DataTransferFileCache {
  constructor() {
    this.requestIdPool = 0;
    this.dataTransferFiles = /* @__PURE__ */ new Map();
  }
  add(dataTransfer) {
    const requestId = this.requestIdPool++;
    this.dataTransferFiles.set(requestId, coalesce(Array.from(dataTransfer, ([, item]) => item.asFile())));
    return {
      id: requestId,
      dispose: () => {
        this.dataTransferFiles.delete(requestId);
      }
    };
  }
  async resolveFileData(requestId, dataItemId) {
    const files = this.dataTransferFiles.get(requestId);
    if (!files) {
      throw new Error("No data transfer found");
    }
    const file = files.find((file2) => file2.id === dataItemId);
    if (!file) {
      throw new Error("No matching file found in data transfer");
    }
    return VSBuffer.wrap(await file.data());
  }
  dispose() {
    this.dataTransferFiles.clear();
  }
}
export {
  DataTransferFileCache
};
