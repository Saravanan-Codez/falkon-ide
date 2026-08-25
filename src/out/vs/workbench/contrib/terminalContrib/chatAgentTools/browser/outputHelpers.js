const MAX_OUTPUT_LENGTH = 2e4;
const PREVIEW_CHARS = 500;
function truncateLargeOutput(output, filePath) {
  const totalLength = output.length;
  const previewEnd = Math.min(PREVIEW_CHARS, totalLength);
  const preview = output.slice(0, previewEnd);
  const sizeKB = Math.ceil(totalLength / 1024);
  let header;
  if (filePath) {
    header = `[Output too large (${sizeKB}KB). Full output saved to: ${filePath}]
[Use readFile or grep to examine the full output.]

`;
  } else {
    header = `[Output too large (${sizeKB}KB). Showing preview and tail.]

`;
  }
  const separator = "\n\n[... middle of output truncated ...]\n\n";
  const availableForTail = MAX_OUTPUT_LENGTH - header.length - preview.length - separator.length;
  if (availableForTail <= 0) {
    return (header + preview).slice(0, MAX_OUTPUT_LENGTH);
  }
  const tail = output.slice(-availableForTail);
  return header + preview + separator + tail;
}
function getRawOutput(instance, startMarker, options) {
  if (!instance.xterm || !instance.xterm.raw) {
    return "";
  }
  const buffer = instance.xterm.raw.buffer.active;
  let startLine = Math.max(startMarker?.line ?? 0, 0);
  while (startLine > 0 && buffer.getLine(startLine)?.isWrapped) {
    startLine--;
  }
  const endLine = buffer.length;
  const lines = [];
  let currentLine = "";
  for (let y = startLine; y < endLine; y++) {
    const line = buffer.getLine(y);
    if (!line) {
      continue;
    }
    const isWrapped = !!buffer.getLine(y + 1)?.isWrapped;
    currentLine += line.translateToString(!isWrapped);
    if (!isWrapped) {
      lines.push(currentLine);
      currentLine = "";
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  const output = lines.join("\n");
  if (options?.lastNLines !== void 0) {
    const nonEmpty = output.split("\n").filter((line) => line.trim().length > 0);
    return nonEmpty.slice(-options.lastNLines).join("\n");
  }
  return output;
}
function getOutput(instance, startMarker, options) {
  return getRawOutput(instance, startMarker, options);
}
export {
  MAX_OUTPUT_LENGTH,
  getOutput,
  getRawOutput,
  truncateLargeOutput
};
