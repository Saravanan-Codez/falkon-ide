function decideHostKeyTrust(request, trustedKeys) {
  const strict = request.strictHostKeyChecking;
  if (request.knownHostsMatch === "revoked") {
    return { kind: "deny", reason: "revoked" };
  }
  if (strict === "no" || strict === "off") {
    const storedUnderOptOut = trustedKeys.find((key) => key.keyType === request.keyType);
    if (storedUnderOptOut && storedUnderOptOut.fingerprint !== request.fingerprint) {
      return { kind: "deny", reason: "mismatch", source: "stored" };
    }
    if (request.knownHostsMatch === "mismatch") {
      return { kind: "deny", reason: "mismatch", source: "known-hosts" };
    }
    return { kind: "trust", persist: false, reason: "strict-disabled" };
  }
  const storedForKeyType = trustedKeys.find((key) => key.keyType === request.keyType);
  if (storedForKeyType) {
    return storedForKeyType.fingerprint === request.fingerprint ? { kind: "trust", persist: false, reason: "stored" } : { kind: "deny", reason: "mismatch", source: "stored" };
  }
  if (request.knownHostsMatch === "mismatch") {
    return { kind: "deny", reason: "mismatch", source: "known-hosts" };
  }
  if (request.knownHostsMatch === "match") {
    return { kind: "trust", persist: true, reason: "known-hosts" };
  }
  if (strict === "yes") {
    return { kind: "deny", reason: "strict-yes" };
  }
  if (strict === "accept-new") {
    return { kind: "trust", persist: true, reason: "strict-accept-new" };
  }
  if (!request.userInitiated) {
    return { kind: "deny", reason: "not-user-initiated" };
  }
  return { kind: "prompt", reason: request.knownHostsMatch === "ca-only" ? "ca-only" : "unknown" };
}
export {
  decideHostKeyTrust
};
