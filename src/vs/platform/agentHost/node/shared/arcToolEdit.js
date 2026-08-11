function extractArcTextEdit(toolName, input, beforeText, afterText) {
  const object = asObject(input);
  let edit;
  switch (toolName) {
    case "Write":
      edit = fullReplacement(beforeText, readString(object, "content"));
      break;
    case "create":
      edit = fullReplacement(beforeText, readString(object, "file_text"));
      break;
    case "Edit":
      edit = stringReplacement(beforeText, readString(object, "old_string"), readString(object, "new_string"), object?.replace_all === true);
      break;
    case "edit":
    case "str_replace":
      edit = stringReplacement(beforeText, readString(object, "old_str"), readString(object, "new_str"), false);
      break;
    case "str_replace_editor":
      if (object?.command === "create") {
        edit = fullReplacement(beforeText, readString(object, "file_text"));
      } else if (object?.command === "str_replace") {
        edit = stringReplacement(beforeText, readString(object, "old_str"), readString(object, "new_str"), false);
      }
      break;
  }
  return edit && applyEdit(beforeText, edit) === afterText ? edit : void 0;
}
function createArcTextEditFromDiff(changes, beforeText, afterText) {
  const edit = {
    replacements: changes.map((change) => ({
      start: change.startOffset,
      endExclusive: change.endOffsetExclusive,
      text: change.newText
    }))
  };
  return applyEdit(beforeText, edit) === afterText ? edit : {
    replacements: [{ start: 0, endExclusive: beforeText.length, text: afterText }]
  };
}
function fullReplacement(beforeText, text) {
  return text === void 0 ? void 0 : {
    replacements: [{ start: 0, endExclusive: beforeText.length, text }]
  };
}
function stringReplacement(beforeText, oldText, newText, replaceAll) {
  if (oldText === void 0 || newText === void 0 || oldText.length === 0) {
    return void 0;
  }
  const replacements = [];
  let offset = 0;
  while (offset <= beforeText.length) {
    const start = beforeText.indexOf(oldText, offset);
    if (start === -1) {
      break;
    }
    replacements.push({ start, endExclusive: start + oldText.length, text: newText });
    if (!replaceAll) {
      break;
    }
    offset = start + oldText.length;
  }
  return replacements.length > 0 ? { replacements } : void 0;
}
function applyEdit(value, edit) {
  let result = "";
  let offset = 0;
  for (const replacement of edit.replacements) {
    result += value.substring(offset, replacement.start);
    result += replacement.text;
    offset = replacement.endExclusive;
  }
  return result + value.substring(offset);
}
function asObject(value) {
  return typeof value === "object" && value !== null ? value : void 0;
}
function readString(object, key) {
  const value = object?.[key];
  return typeof value === "string" ? value : void 0;
}
export {
  createArcTextEditFromDiff,
  extractArcTextEdit
};
