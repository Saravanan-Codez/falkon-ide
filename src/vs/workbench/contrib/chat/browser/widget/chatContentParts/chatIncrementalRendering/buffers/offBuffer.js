class OffBuffer {
  constructor() {
    this.handlesFlush = false;
  }
  getRenderable(fullMarkdown, _lastRendered) {
    return fullMarkdown;
  }
}
export {
  OffBuffer
};
