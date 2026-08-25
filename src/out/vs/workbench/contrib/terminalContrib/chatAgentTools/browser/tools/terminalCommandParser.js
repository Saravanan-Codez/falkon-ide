const WRAPPER_PROGRAMS = /* @__PURE__ */ new Set([
  "sudo",
  "doas",
  "time",
  "command",
  "builtin",
  "exec",
  "nice",
  "ionice",
  "nohup",
  "env",
  "xargs",
  "stdbuf",
  "unbuffer",
  "script",
  "timeout"
]);
const ENV_ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*=.*$/;
function tokenize(segment) {
  const tokens = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  let hasContent = false;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && i + 1 < segment.length) {
        const next = segment[i + 1];
        if (next === "\\" || next === '"' || next === "$" || next === "`") {
          cur += next;
          i++;
          continue;
        }
        cur += ch;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === "\\" && i + 1 < segment.length) {
      cur += segment[i + 1];
      i++;
      hasContent = true;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      hasContent = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      hasContent = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0 || hasContent) {
        tokens.push(cur);
        cur = "";
        hasContent = false;
      }
      continue;
    }
    cur += ch;
    hasContent = true;
  }
  if (cur.length > 0 || hasContent) {
    tokens.push(cur);
  }
  return tokens;
}
function splitSegments(command) {
  const out = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  const push = (sep) => {
    const trimmed = cur.trim();
    if (trimmed.length > 0 || sep !== void 0) {
      out.push({ raw: trimmed, sep });
    }
    cur = "";
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (inSingle) {
      cur += ch;
      if (ch === "'") {
        inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (ch === "\\" && i + 1 < command.length) {
        cur += ch + command[i + 1];
        i++;
        continue;
      }
      cur += ch;
      if (ch === '"') {
        inDouble = false;
      }
      continue;
    }
    if (ch === "\\" && i + 1 < command.length) {
      cur += ch + command[i + 1];
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      cur += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      cur += ch;
      continue;
    }
    if (ch === "|" && command[i + 1] === "|") {
      push("||");
      i++;
      continue;
    }
    if (ch === "|" && command[i + 1] === "&") {
      push("|&");
      i++;
      continue;
    }
    if (ch === "|") {
      push("|");
      continue;
    }
    if (ch === "&" && command[i + 1] === "&") {
      push("&&");
      i++;
      continue;
    }
    if (ch === ";") {
      push(";");
      continue;
    }
    cur += ch;
  }
  push(void 0);
  return out;
}
function stripPrefixesAndWrappers(rawTokens) {
  const envPrefixes = [];
  const wrappers = [];
  let i = 0;
  while (i < rawTokens.length && ENV_ASSIGN_RE.test(rawTokens[i])) {
    envPrefixes.push(rawTokens[i]);
    i++;
  }
  while (i < rawTokens.length) {
    const tok = rawTokens[i];
    if (WRAPPER_PROGRAMS.has(tok)) {
      wrappers.push(tok);
      i++;
      while (i < rawTokens.length) {
        const next = rawTokens[i];
        if (next === "--") {
          i++;
          break;
        }
        if (next.startsWith("-")) {
          i++;
          continue;
        }
        if (ENV_ASSIGN_RE.test(next)) {
          envPrefixes.push(next);
          i++;
          continue;
        }
        if ((tok === "timeout" || tok === "nice" || tok === "ionice") && /^\d/.test(next)) {
          i++;
          continue;
        }
        break;
      }
      continue;
    }
    break;
  }
  return {
    tokens: rawTokens.slice(i),
    envPrefixes,
    wrappers
  };
}
function parseCommand(command) {
  if (!command) {
    return void 0;
  }
  const trimmed = command.trim();
  if (!trimmed) {
    return void 0;
  }
  const rawSegments = splitSegments(trimmed);
  if (rawSegments.length === 0) {
    return void 0;
  }
  const segments = rawSegments.map((seg) => {
    const rawTokens = tokenize(seg.raw);
    const { tokens, envPrefixes, wrappers } = stripPrefixesAndWrappers(rawTokens);
    return {
      raw: seg.raw,
      rawTokens,
      tokens,
      envPrefixes,
      wrappers,
      trailingSeparator: seg.sep
    };
  });
  return { raw: trimmed, segments };
}
function segmentHead(segment) {
  const tokens = segment.tokens;
  if (tokens.length === 0) {
    return void 0;
  }
  const head = tokens[0];
  let sub;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].startsWith("--")) {
      continue;
    }
    sub = tokens[i];
    break;
  }
  return { head, sub };
}
function parseCommandHead(command) {
  const parsed = parseCommand(command);
  if (!parsed || parsed.segments.length === 0) {
    return void 0;
  }
  return segmentHead(parsed.segments[0]);
}
function segmentHasFlag(segment, flags) {
  const longFlags = flags.filter((f) => f.length > 1).map((f) => `--${f}`);
  const shortFlags = flags.filter((f) => f.length === 1);
  for (const tok of segment.tokens) {
    if (!tok.startsWith("-") || tok === "--") {
      continue;
    }
    if (tok.startsWith("--")) {
      const name = tok.slice(2).split("=")[0];
      if (longFlags.includes(`--${name}`)) {
        return true;
      }
      continue;
    }
    const bundled = tok.slice(1);
    for (const f of shortFlags) {
      if (bundled.includes(f)) {
        return true;
      }
    }
  }
  return false;
}
function findSegments(parsed, predicate) {
  const out = [];
  for (const seg of parsed.segments) {
    const head = segmentHead(seg);
    if (!head) {
      continue;
    }
    if (predicate(head, seg)) {
      out.push(seg);
    }
  }
  return out;
}
export {
  findSegments,
  parseCommand,
  parseCommandHead,
  segmentHasFlag,
  segmentHead,
  tokenize
};
