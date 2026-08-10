import { compareProtocolVersions } from "./registry.js";
function tryParseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    return void 0;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function isCompatibleProtocolVersion(offered, current) {
  const a = tryParseSemver(offered);
  const b = tryParseSemver(current);
  if (!a || !b) {
    return false;
  }
  if (a[0] !== b[0]) {
    return false;
  }
  if (a[0] === 0 && a[1] !== b[1]) {
    return false;
  }
  return compareProtocolVersions(offered, current) <= 0;
}
function negotiateProtocolVersion(offered, current) {
  let best;
  for (const v of offered) {
    if (!isCompatibleProtocolVersion(v, current)) {
      continue;
    }
    if (best === void 0 || compareProtocolVersions(v, best) > 0) {
      best = v;
    }
  }
  return best;
}
export {
  isCompatibleProtocolVersion,
  negotiateProtocolVersion
};
