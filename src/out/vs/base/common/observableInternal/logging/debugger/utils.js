class Debouncer {
  constructor() {
    this._timeout = void 0;
  }
  debounce(fn, timeoutMs) {
    if (this._timeout !== void 0) {
      clearTimeout(this._timeout);
    }
    this._timeout = setTimeout(() => {
      this._timeout = void 0;
      fn();
    }, timeoutMs);
  }
  dispose() {
    if (this._timeout !== void 0) {
      clearTimeout(this._timeout);
    }
  }
}
class Throttler {
  constructor() {
    this._timeout = void 0;
  }
  throttle(fn, timeoutMs) {
    if (this._timeout === void 0) {
      this._timeout = setTimeout(() => {
        this._timeout = void 0;
        fn();
      }, timeoutMs);
    }
  }
  dispose() {
    if (this._timeout !== void 0) {
      clearTimeout(this._timeout);
    }
  }
}
function deepAssign(target, source) {
  for (const key in source) {
    if (!!target[key] && typeof target[key] === "object" && !!source[key] && typeof source[key] === "object") {
      deepAssign(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
function deepAssignDeleteNulls(target, source) {
  for (const key in source) {
    if (source[key] === null) {
      delete target[key];
    } else if (!!target[key] && typeof target[key] === "object" && !!source[key] && typeof source[key] === "object") {
      deepAssignDeleteNulls(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
export {
  Debouncer,
  Throttler,
  deepAssign,
  deepAssignDeleteNulls
};
