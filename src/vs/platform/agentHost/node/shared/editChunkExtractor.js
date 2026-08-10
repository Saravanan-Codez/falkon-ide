function extractAiChunks(toolName, input, forFilePath) {
  switch (toolName) {
    // ---- Claude SDK -------------------------------------------------
    case "Write":
      return readStringField(input, "content");
    case "Edit":
      return readStringField(input, "new_string");
    case "MultiEdit":
      return readMultiEdit(input, "new_string");
    // ---- Copilot CLI ------------------------------------------------
    case "create":
      return readStringField(input, "file_text");
    case "edit":
    case "str_replace":
    case "insert":
      return readStringField(input, "new_str");
    case "str_replace_editor":
      return readStrReplaceEditor(input);
    case "apply_patch":
    case "git_apply_patch":
      return readApplyPatch(input, forFilePath);
    default:
      return [];
  }
}
function readStringField(input, field) {
  if (typeof input !== "object" || input === null) {
    return [];
  }
  const value = input[field];
  return typeof value === "string" ? [value] : [];
}
function readMultiEdit(input, field) {
  if (typeof input !== "object" || input === null) {
    return [];
  }
  const edits = input.edits;
  if (!Array.isArray(edits)) {
    return [];
  }
  const chunks = [];
  for (const entry of edits) {
    if (typeof entry === "object" && entry !== null) {
      const value = entry[field];
      if (typeof value === "string") {
        chunks.push(value);
      }
    }
  }
  return chunks;
}
function readStrReplaceEditor(input) {
  if (typeof input !== "object" || input === null) {
    return [];
  }
  const obj = input;
  switch (obj.command) {
    case "create":
      return typeof obj.file_text === "string" ? [obj.file_text] : [];
    case "str_replace":
    case "insert":
      return typeof obj.new_str === "string" ? [obj.new_str] : [];
    default:
      return [];
  }
}
const APPLY_PATCH_FILE_HEADERS = [
  /^\s*\*\*\*\s+Update File:\s*(.+?)\s*$/,
  /^\s*\*\*\*\s+Add File:\s*(.+?)\s*$/,
  /^\s*\*\*\*\s+Delete File:\s*(.+?)\s*$/,
  /^\s*\*\*\*\s+Move to:\s*(.+?)\s*$/
];
function readApplyPatch(input, forFilePath) {
  let text;
  if (typeof input === "string") {
    text = input;
  } else if (typeof input === "object" && input !== null) {
    const obj = input;
    if (typeof obj.input === "string") {
      text = obj.input;
    } else if (typeof obj.patch === "string") {
      text = obj.patch;
    }
  }
  if (!text) {
    return [];
  }
  const additionsByFile = /* @__PURE__ */ new Map();
  const order = [];
  let currentFile;
  for (const line of text.split("\n")) {
    let matchedHeader = false;
    for (const re of APPLY_PATCH_FILE_HEADERS) {
      const m = re.exec(line);
      if (m && m[1]) {
        currentFile = m[1];
        if (!additionsByFile.has(currentFile)) {
          additionsByFile.set(currentFile, []);
          order.push(currentFile);
        }
        matchedHeader = true;
        break;
      }
    }
    if (matchedHeader || !currentFile) {
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additionsByFile.get(currentFile).push(line.slice(1));
    }
  }
  const joinLines = (lines) => lines.length === 0 ? "" : lines.join("\n") + "\n";
  if (forFilePath !== void 0) {
    const lines = additionsByFile.get(forFilePath);
    if (!lines || lines.length === 0) {
      return [];
    }
    return [joinLines(lines)];
  }
  const out = [];
  for (const file of order) {
    const joined = joinLines(additionsByFile.get(file));
    if (joined.length > 0) {
      out.push(joined);
    }
  }
  return out;
}
export {
  extractAiChunks
};
