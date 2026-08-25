import { parentPort } from "worker_threads";
import { DefaultLinesDiffComputer } from "../../../editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js";
function computeDiffCounts(originalText, modifiedText, timeoutMs) {
  const originalLines = originalText.split(/\r\n|\r|\n/);
  const modifiedLines = modifiedText.split(/\r\n|\r|\n/);
  const diffComputer = new DefaultLinesDiffComputer();
  const options = {
    ignoreTrimWhitespace: true,
    maxComputationTimeMs: timeoutMs,
    computeMoves: false
  };
  const result = diffComputer.computeDiff(originalLines, modifiedLines, options);
  let added = 0;
  let removed = 0;
  for (const change of result.changes) {
    removed += change.original.length;
    added += change.modified.length;
  }
  const originalLineStarts = getLineStarts(originalText);
  const modifiedLineStarts = getLineStarts(modifiedText);
  const changes = result.changes.flatMap((change) => {
    const rangeMappings = change.innerChanges ?? [change.toRangeMapping2(originalLines, modifiedLines)];
    return rangeMappings.map((mapping) => ({
      startOffset: getOffset(mapping.originalRange, originalLineStarts, false),
      endOffsetExclusive: getOffset(mapping.originalRange, originalLineStarts, true),
      newText: modifiedText.substring(
        getOffset(mapping.modifiedRange, modifiedLineStarts, false),
        getOffset(mapping.modifiedRange, modifiedLineStarts, true)
      )
    }));
  });
  return { added, removed, changes };
}
function getLineStarts(content) {
  const result = [0];
  for (let index = 0; index < content.length; index++) {
    const charCode = content.charCodeAt(index);
    if (charCode === 13) {
      if (content.charCodeAt(index + 1) === 10) {
        index++;
      }
      result.push(index + 1);
    } else if (charCode === 10) {
      result.push(index + 1);
    }
  }
  return result;
}
function getOffset(range, lineStarts, end) {
  const lineNumber = end ? range.endLineNumber : range.startLineNumber;
  const column = end ? range.endColumn : range.startColumn;
  const lineStart = lineStarts[Math.min(lineNumber - 1, lineStarts.length - 1)];
  return lineStart + column - 1;
}
function computeDetailedDiff(originalText, modifiedText, timeoutMs) {
  const originalLines = originalText.split(/\r\n|\r|\n/);
  const modifiedLines = modifiedText.split(/\r\n|\r|\n/);
  const diffComputer = new DefaultLinesDiffComputer();
  const result = diffComputer.computeDiff(originalLines, modifiedLines, {
    ignoreTrimWhitespace: false,
    maxComputationTimeMs: timeoutMs,
    computeMoves: false
  });
  let added = 0;
  let removed = 0;
  let replacements = [];
  const originalOffsets = new LineOffsetConverter(originalText);
  const modifiedOffsets = new LineOffsetConverter(modifiedText);
  for (const change of result.changes) {
    removed += change.original.length;
    added += change.modified.length;
    const mappings = change.innerChanges ?? [change.toRangeMapping2(originalLines, modifiedLines)];
    for (const mapping of mappings) {
      replacements.push(toReplacement(mapping, originalText, modifiedText, originalOffsets, modifiedOffsets));
    }
  }
  if (applyReplacements(originalText, replacements) !== modifiedText) {
    replacements = [{ start: 0, endExclusive: originalText.length, text: modifiedText }];
  }
  return { added, removed, replacements, hitTimeout: result.hitTimeout };
}
function toReplacement(mapping, _originalText, modifiedText, originalOffsets, modifiedOffsets) {
  const start = originalOffsets.getOffset(mapping.originalRange.startLineNumber, mapping.originalRange.startColumn);
  const endExclusive = originalOffsets.getOffset(mapping.originalRange.endLineNumber, mapping.originalRange.endColumn);
  const modifiedStart = modifiedOffsets.getOffset(mapping.modifiedRange.startLineNumber, mapping.modifiedRange.startColumn);
  const modifiedEndExclusive = modifiedOffsets.getOffset(mapping.modifiedRange.endLineNumber, mapping.modifiedRange.endColumn);
  return {
    start,
    endExclusive,
    text: modifiedText.substring(modifiedStart, modifiedEndExclusive)
  };
}
function applyReplacements(value, replacements) {
  let result = "";
  let offset = 0;
  for (const replacement of replacements) {
    result += value.substring(offset, replacement.start);
    result += replacement.text;
    offset = replacement.endExclusive;
  }
  return result + value.substring(offset);
}
class LineOffsetConverter {
  constructor(_text) {
    this._text = _text;
    this._lineStarts = [0];
    const lineBreak = /\r\n|\r|\n/g;
    let match;
    while (match = lineBreak.exec(_text)) {
      this._lineStarts.push(match.index + match[0].length);
    }
  }
  getOffset(lineNumber, column) {
    const lineStart = this._lineStarts[Math.min(Math.max(lineNumber - 1, 0), this._lineStarts.length - 1)];
    return Math.min(lineStart + Math.max(column - 1, 0), this._text.length);
  }
}
function main() {
  const port = parentPort;
  if (!port) {
    throw new Error("This module should only be used in a worker thread.");
  }
  port.on("message", ({ id, fn, args }) => {
    try {
      if (fn === "computeDiffCounts") {
        const res = computeDiffCounts(args[0], args[1], args[2]);
        port.postMessage({ id, res });
      } else if (fn === "computeDetailedDiff") {
        const res = computeDetailedDiff(args[0], args[1], args[2]);
        port.postMessage({ id, res });
      } else {
        port.postMessage({ id, err: { message: `Unknown function: ${fn}` } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : void 0;
      port.postMessage({ id, err: { message, stack } });
    }
  });
}
if (parentPort) {
  main();
}
export {
  computeDetailedDiff,
  computeDiffCounts
};
