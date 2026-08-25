const MAX_BUFFERED_CHARS = 4e3;
function lastBlockBoundary(text) {
  let lastValid = -1;
  let inFence = false;
  for (let i = 0; i < text.length; i++) {
    if ((i === 0 || text[i - 1] === "\n") && (text[i] === "`" && text[i + 1] === "`" && text[i + 2] === "`" || text[i] === "~" && text[i + 1] === "~" && text[i + 2] === "~")) {
      inFence = !inFence;
      i += 2;
      continue;
    }
    if (!inFence && text[i] === "\n" && text[i + 1] === "\n") {
      lastValid = i;
    }
  }
  return lastValid;
}
class ParagraphBuffer {
  constructor() {
    this.handlesFlush = false;
  }
  getRenderable(fullMarkdown, _lastRendered) {
    const lastBlock = lastBlockBoundary(fullMarkdown);
    let renderable = lastBlock === -1 ? fullMarkdown : fullMarkdown.slice(0, lastBlock + 2);
    if (fullMarkdown.length - renderable.length > MAX_BUFFERED_CHARS) {
      renderable = fullMarkdown;
    }
    return renderable;
  }
}
export {
  ParagraphBuffer,
  lastBlockBoundary
};
