import { createHash, createHmac, timingSafeEqual } from "crypto";
function computeHostKeyFingerprint(keyBlob) {
  const digest = createHash("sha256").update(keyBlob).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}
function readHostKeyType(keyBlob) {
  if (keyBlob.length < 4) {
    return void 0;
  }
  const length = keyBlob.readUInt32BE(0);
  if (length === 0 || length > 64 || 4 + length > keyBlob.length) {
    return void 0;
  }
  return keyBlob.subarray(4, 4 + length).toString("ascii");
}
function parseKnownHostsLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return void 0;
  }
  const fields = trimmed.split(/\s+/);
  let index = 0;
  let marker;
  if (fields[index]?.startsWith("@")) {
    const raw = fields[index].substring(1);
    if (raw !== "revoked" && raw !== "cert-authority") {
      return void 0;
    }
    marker = raw;
    index++;
  }
  const hostField = fields[index++];
  const keyType = fields[index++];
  const keyBase64 = fields[index++];
  if (!hostField || !keyType || !keyBase64) {
    return void 0;
  }
  let key;
  try {
    key = Buffer.from(keyBase64, "base64");
  } catch {
    return void 0;
  }
  if (key.length === 0 || readHostKeyType(key) !== keyType) {
    return void 0;
  }
  if (hostField.startsWith("|1|")) {
    const parts = hostField.split("|");
    if (parts.length !== 4) {
      return void 0;
    }
    const salt = Buffer.from(parts[2], "base64");
    const hash = Buffer.from(parts[3], "base64");
    if (salt.length === 0 || hash.length !== 20) {
      return void 0;
    }
    return { marker, patterns: [], hashedHost: { salt, hash }, keyType, key };
  }
  return { marker, patterns: hostField.split(","), keyType, key };
}
function parseKnownHosts(contents) {
  const entries = [];
  for (const line of contents.split("\n")) {
    const entry = parseKnownHostsLine(line);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}
function hostCandidates(host, port) {
  const lower = host.toLowerCase();
  return port === 22 ? [lower] : [`[${lower}]:${port}`];
}
function matchesPattern(pattern, candidate) {
  const escaped = pattern.toLowerCase().replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return regex.test(candidate);
}
function entryAppliesToCandidate(patterns, candidate) {
  let matched = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      if (matchesPattern(pattern.substring(1), candidate)) {
        return false;
      }
    } else if (matchesPattern(pattern, candidate)) {
      matched = true;
    }
  }
  return matched;
}
function hashedEntryAppliesToCandidate(hashedHost, candidate) {
  const computed = createHmac("sha1", hashedHost.salt).update(candidate).digest();
  return computed.length === hashedHost.hash.length && timingSafeEqual(computed, hashedHost.hash);
}
function entryApplies(entry, candidates) {
  return candidates.some((candidate) => entry.hashedHost ? hashedEntryAppliesToCandidate(entry.hashedHost, candidate) : entryAppliesToCandidate(entry.patterns, candidate));
}
function matchKnownHosts(entries, host, port, keyType, keyBlob) {
  const candidates = hostCandidates(host, port);
  const applicable = entries.filter((entry) => entryApplies(entry, candidates));
  if (applicable.some((entry) => entry.marker === "revoked" && entry.key.equals(keyBlob))) {
    return "revoked";
  }
  let sawSameTypeEntry = false;
  let sawCertAuthority = false;
  for (const entry of applicable) {
    if (entry.marker === "revoked") {
      continue;
    }
    if (entry.marker === "cert-authority") {
      sawCertAuthority = true;
      continue;
    }
    if (entry.keyType !== keyType) {
      continue;
    }
    if (entry.key.equals(keyBlob)) {
      return "match";
    }
    sawSameTypeEntry = true;
  }
  if (sawSameTypeEntry) {
    return "mismatch";
  }
  return sawCertAuthority ? "ca-only" : "unknown";
}
export {
  computeHostKeyFingerprint,
  matchKnownHosts,
  parseKnownHosts,
  parseKnownHostsLine,
  readHostKeyType
};
