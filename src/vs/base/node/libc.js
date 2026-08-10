import { familySync, MUSL } from "detect-libc";
import * as Platform from "../common/platform.js";
let _cached;
let _cacheValid = false;
function detectLibcSync() {
  if (_cacheValid) {
    return _cached;
  }
  if (Platform.isLinux) {
    _cached = familySync() === MUSL ? "musl" : "glibc";
  } else {
    _cached = void 0;
  }
  _cacheValid = true;
  return _cached;
}
export {
  detectLibcSync
};
