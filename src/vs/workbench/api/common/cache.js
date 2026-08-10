class Cache {
  constructor(id) {
    this.id = id;
    this._data = /* @__PURE__ */ new Map();
    this._idPool = 1;
  }
  static {
    this.enableDebugLogging = false;
  }
  add(item) {
    const id = this._idPool++;
    this._data.set(id, item);
    this.logDebugInfo();
    return id;
  }
  get(pid, id) {
    return this._data.has(pid) ? this._data.get(pid)[id] : void 0;
  }
  delete(id) {
    this._data.delete(id);
    this.logDebugInfo();
  }
  logDebugInfo() {
    if (!Cache.enableDebugLogging) {
      return;
    }
    console.log(`${this.id} cache size - ${this._data.size}`);
  }
}
export {
  Cache
};
