function getUNCHostAllowlist() {
  const allowlist = processUNCHostAllowlist();
  if (allowlist) {
    return Array.from(allowlist);
  }
  return [];
}
function processUNCHostAllowlist() {
  return process.uncHostAllowlist;
}
function addUNCHostToAllowlist(allowedHost) {
  if (process.platform !== "win32") {
    return;
  }
  const allowlist = processUNCHostAllowlist();
  if (allowlist) {
    if (typeof allowedHost === "string") {
      allowlist.add(allowedHost.toLowerCase());
    } else {
      for (const host of toSafeStringArray(allowedHost)) {
        addUNCHostToAllowlist(host);
      }
    }
  }
}
function toSafeStringArray(arg0) {
  const allowedUNCHosts = /* @__PURE__ */ new Set();
  if (Array.isArray(arg0)) {
    for (const host of arg0) {
      if (typeof host === "string") {
        allowedUNCHosts.add(host);
      }
    }
  }
  return Array.from(allowedUNCHosts);
}
function getUNCHost(maybeUNCPath) {
  if (typeof maybeUNCPath !== "string") {
    return void 0;
  }
  const uncRoots = [
    "\\\\.\\UNC\\",
    // DOS Device paths (https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats)
    "\\\\?\\UNC\\",
    "\\\\"
    // standard UNC path
  ];
  let host = void 0;
  for (const uncRoot of uncRoots) {
    const indexOfUNCRoot = maybeUNCPath.indexOf(uncRoot);
    if (indexOfUNCRoot !== 0) {
      continue;
    }
    const indexOfUNCPath = maybeUNCPath.indexOf("\\", uncRoot.length);
    if (indexOfUNCPath === -1) {
      continue;
    }
    const hostCandidate = maybeUNCPath.substring(uncRoot.length, indexOfUNCPath);
    if (hostCandidate) {
      host = hostCandidate;
      break;
    }
  }
  return host;
}
function disableUNCAccessRestrictions() {
  if (process.platform !== "win32") {
    return;
  }
  process.restrictUNCAccess = false;
}
function isUNCAccessRestrictionsDisabled() {
  if (process.platform !== "win32") {
    return true;
  }
  return process.restrictUNCAccess === false;
}
export {
  addUNCHostToAllowlist,
  disableUNCAccessRestrictions,
  getUNCHost,
  getUNCHostAllowlist,
  isUNCAccessRestrictionsDisabled
};
