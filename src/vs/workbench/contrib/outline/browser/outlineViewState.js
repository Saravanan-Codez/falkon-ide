import { Emitter } from "../../../../base/common/event.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { OutlineSortOrder } from "./outline.js";
class OutlineViewState {
  constructor() {
    this._followCursor = false;
    this._filterOnType = true;
    this._sortBy = OutlineSortOrder.ByPosition;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  dispose() {
    this._onDidChange.dispose();
  }
  set followCursor(value) {
    if (value !== this._followCursor) {
      this._followCursor = value;
      this._onDidChange.fire({ followCursor: true });
    }
  }
  get followCursor() {
    return this._followCursor;
  }
  get filterOnType() {
    return this._filterOnType;
  }
  set filterOnType(value) {
    if (value !== this._filterOnType) {
      this._filterOnType = value;
      this._onDidChange.fire({ filterOnType: true });
    }
  }
  set sortBy(value) {
    if (value !== this._sortBy) {
      this._sortBy = value;
      this._onDidChange.fire({ sortBy: true });
    }
  }
  get sortBy() {
    return this._sortBy;
  }
  persist(storageService) {
    storageService.store("outline/state", JSON.stringify({
      followCursor: this.followCursor,
      sortBy: this.sortBy,
      filterOnType: this.filterOnType
    }), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  restore(storageService) {
    const raw = storageService.get("outline/state", StorageScope.WORKSPACE);
    if (!raw) {
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    this.followCursor = data.followCursor;
    this.sortBy = data.sortBy ?? OutlineSortOrder.ByPosition;
    if (typeof data.filterOnType === "boolean") {
      this.filterOnType = data.filterOnType;
    }
  }
}
export {
  OutlineViewState
};
