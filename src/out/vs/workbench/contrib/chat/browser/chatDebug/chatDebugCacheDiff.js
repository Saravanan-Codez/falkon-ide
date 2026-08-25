var CacheDiffKind = /* @__PURE__ */ ((CacheDiffKind2) => {
  CacheDiffKind2["Identical"] = "identical";
  CacheDiffKind2["ContentDrift"] = "contentDrift";
  CacheDiffKind2["LengthChange"] = "lengthChange";
  CacheDiffKind2["OnlyInA"] = "onlyInA";
  CacheDiffKind2["OnlyInB"] = "onlyInB";
  return CacheDiffKind2;
})(CacheDiffKind || {});
function parseInputMessages(inputMessagesJson) {
  if (!inputMessagesJson) {
    return [];
  }
  let raw;
  try {
    raw = JSON.parse(inputMessagesJson);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const toolNameByCallId = /* @__PURE__ */ new Map();
  for (const m of raw) {
    if (!m || typeof m !== "object" || !Array.isArray(m.parts)) {
      continue;
    }
    for (const p of m.parts) {
      if (p && typeof p === "object" && p.type === "tool_call" && typeof p.id === "string" && typeof p.name === "string" && p.name) {
        toolNameByCallId.set(p.id, p.name);
      }
    }
  }
  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") {
      continue;
    }
    let role = typeof m.role === "string" ? m.role : "unknown";
    let name = typeof m.name === "string" && m.name ? m.name : void 0;
    let text = "";
    let toolResponseName;
    let hasToolResponse = false;
    let hasToolCall = false;
    let hasToolSearchOutput = false;
    let hasText = false;
    if (Array.isArray(m.parts)) {
      for (const p of m.parts) {
        if (!p || typeof p !== "object") {
          continue;
        }
        switch (p.type) {
          case void 0:
          case "text":
          case "reasoning":
            if (typeof p.content === "string") {
              text += p.content;
              hasText = true;
            }
            break;
          case "tool_call_response":
          case "tool_result":
            if (typeof p.response === "string") {
              text += p.response;
            } else if (p.response !== void 0) {
              text += stableStringify(p.response);
            } else if (typeof p.content === "string") {
              text += p.content;
            } else if (p.content !== void 0) {
              text += stableStringify(p.content);
            }
            if (toolResponseName === void 0 && typeof p.id === "string") {
              toolResponseName = toolNameByCallId.get(p.id);
            }
            hasToolResponse = true;
            break;
          case "tool_call":
            if (p.name) {
              text += `call:${p.name}`;
            }
            if (p.arguments !== void 0) {
              text += stableStringify(p.arguments);
            }
            hasToolCall = true;
            break;
          case "tool_search_output":
            text += stableStringify({
              id: p.id,
              status: p.status,
              tools: p.tools
            });
            hasToolSearchOutput = true;
            break;
        }
      }
    }
    if (hasToolSearchOutput && !hasText) {
      role = "tool_search";
    } else if (hasToolResponse && !hasText) {
      role = "tool";
      name = name ?? toolResponseName;
    } else if (hasToolCall && !hasText && role === "assistant") {
      role = "assistant";
    }
    if (text.length === 0 && role === "unknown") {
      text = stableStringify(m);
    }
    out.push({ role, name, text, charLength: text.length });
  }
  return out;
}
function stableStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function messagesEqual(a, b) {
  return a.role === b.role && a.name === b.name && a.charLength === b.charLength && a.text === b.text;
}
function diffPromptSignature(a, b) {
  const signature = [];
  const drift = [];
  const counts = { identical: 0, contentDrift: 0, lengthChange: 0, onlyInA: 0, onlyInB: 0 };
  let breakResult;
  let broken = false;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const ai = a[i];
    const bi = b[i];
    if (ai && !bi) {
      counts.onlyInA++;
      signature.push({ index: i, kind: "onlyInA" /* OnlyInA */, aRole: ai.role, aName: ai.name, aCharLength: ai.charLength });
      drift.push({ name: `messages[${i}]`, role: ai.role, status: "onlyInA" /* OnlyInA */, aSize: ai.charLength, bSize: 0 });
      if (!broken) {
        broken = true;
        breakResult = { index: i, kind: "onlyInA" /* OnlyInA */ };
      }
      continue;
    }
    if (bi && !ai) {
      counts.onlyInB++;
      signature.push({ index: i, kind: "onlyInB" /* OnlyInB */, bRole: bi.role, bName: bi.name, bCharLength: bi.charLength });
      drift.push({ name: `messages[${i}]`, role: bi.role, status: "onlyInB" /* OnlyInB */, aSize: 0, bSize: bi.charLength });
      if (!broken) {
        broken = true;
        breakResult = { index: i, kind: "onlyInB" /* OnlyInB */ };
      }
      continue;
    }
    if (!ai || !bi) {
      continue;
    }
    if (messagesEqual(ai, bi)) {
      counts.identical++;
      signature.push({
        index: i,
        kind: "identical" /* Identical */,
        aRole: ai.role,
        aName: ai.name,
        aCharLength: ai.charLength,
        bRole: bi.role,
        bName: bi.name,
        bCharLength: bi.charLength
      });
      continue;
    }
    const kind = ai.charLength === bi.charLength ? "contentDrift" /* ContentDrift */ : "lengthChange" /* LengthChange */;
    if (kind === "contentDrift" /* ContentDrift */) {
      counts.contentDrift++;
    } else {
      counts.lengthChange++;
    }
    signature.push({
      index: i,
      kind,
      aRole: ai.role,
      aName: ai.name,
      aCharLength: ai.charLength,
      bRole: bi.role,
      bName: bi.name,
      bCharLength: bi.charLength
    });
    drift.push({ name: `messages[${i}]`, role: ai.role, status: kind, aSize: ai.charLength, bSize: bi.charLength });
    if (!broken) {
      broken = true;
      breakResult = { index: i, kind };
    }
  }
  return { signature, break: breakResult, drift, counts };
}
const PREFIX_COMPONENT_ORDER = ["system", "tools"];
function insertPrefixComponent(drift, entry) {
  const prefixEntries = [];
  const rest = [];
  for (const d of drift) {
    if (PREFIX_COMPONENT_ORDER.includes(d.name)) {
      if (d.name !== entry.name) {
        prefixEntries.push(d);
      }
    } else {
      rest.push(d);
    }
  }
  prefixEntries.push(entry);
  prefixEntries.sort((a, b) => PREFIX_COMPONENT_ORDER.indexOf(a.name) - PREFIX_COMPONENT_ORDER.indexOf(b.name));
  return [...prefixEntries, ...rest];
}
function classifyStringDrift(a, b) {
  if (a === b) {
    return void 0;
  }
  if (!a) {
    return "onlyInB" /* OnlyInB */;
  }
  if (!b) {
    return "onlyInA" /* OnlyInA */;
  }
  return a.length === b.length ? "contentDrift" /* ContentDrift */ : "lengthChange" /* LengthChange */;
}
function appendSystemDrift(drift, aSystem, bSystem) {
  const status = classifyStringDrift(aSystem, bSystem);
  if (status === void 0) {
    return drift;
  }
  return insertPrefixComponent(drift, { name: "system", status, aSize: aSystem?.length ?? 0, bSize: bSystem?.length ?? 0 });
}
function appendToolsDrift(drift, aTools, bTools) {
  const status = classifyStringDrift(aTools, bTools);
  if (status === void 0) {
    return drift;
  }
  return insertPrefixComponent(drift, { name: "tools", status, aSize: aTools?.length ?? 0, bSize: bTools?.length ?? 0 });
}
function formatSignatureToken(token) {
  const role = token.bRole ?? token.aRole ?? "unknown";
  const name = token.bName ?? token.aName;
  const a = token.aCharLength;
  const b = token.bCharLength;
  const sizeText = a !== void 0 && b !== void 0 && a !== b ? `${a}\u2192${b}` : a !== void 0 && b === void 0 ? `${a}\u21920` : a === void 0 && b !== void 0 ? `0\u2192${b}` : `${b ?? a ?? 0}`;
  return name ? `${role}-${name}:${sizeText}` : `${role}:${sizeText}`;
}
export {
  CacheDiffKind,
  appendSystemDrift,
  appendToolsDrift,
  diffPromptSignature,
  formatSignatureToken,
  parseInputMessages
};
