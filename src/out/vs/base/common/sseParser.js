var Chr = /* @__PURE__ */ ((Chr2) => {
  Chr2[Chr2["CR"] = 13] = "CR";
  Chr2[Chr2["LF"] = 10] = "LF";
  Chr2[Chr2["COLON"] = 58] = "COLON";
  Chr2[Chr2["SPACE"] = 32] = "SPACE";
  return Chr2;
})(Chr || {});
class SSEParser {
  /**
   * Creates a new SSE parser.
   * @param onEvent The callback to invoke when an event is dispatched.
   */
  constructor(onEvent) {
    this.dataBuffer = "";
    this.eventTypeBuffer = "";
    this.buffer = [];
    this.endedOnCR = false;
    this.onEventHandler = onEvent;
    this.decoder = new TextDecoder("utf-8");
  }
  /**
   * Gets the last event ID received by this parser.
   */
  getLastEventId() {
    return this.lastEventIdBuffer;
  }
  /**
   * Gets the reconnection time in milliseconds, if one was specified by the server.
   */
  getReconnectionTime() {
    return this.reconnectionTime;
  }
  /**
   * Feeds a chunk of the SSE stream to the parser.
   * @param chunk The chunk to parse as a Uint8Array of UTF-8 encoded data.
   */
  feed(chunk) {
    if (chunk.length === 0) {
      return;
    }
    let offset = 0;
    if (this.endedOnCR && chunk[0] === 10 /* LF */) {
      offset++;
    }
    this.endedOnCR = false;
    while (offset < chunk.length) {
      const indexCR = chunk.indexOf(13 /* CR */, offset);
      const indexLF = chunk.indexOf(10 /* LF */, offset);
      const index = indexCR === -1 ? indexLF : indexLF === -1 ? indexCR : Math.min(indexCR, indexLF);
      if (index === -1) {
        break;
      }
      let str = "";
      for (const buf of this.buffer) {
        str += this.decoder.decode(buf, { stream: true });
      }
      str += this.decoder.decode(chunk.subarray(offset, index));
      this.processLine(str);
      this.buffer.length = 0;
      offset = index + (chunk[index] === 13 /* CR */ && chunk[index + 1] === 10 /* LF */ ? 2 : 1);
    }
    if (offset < chunk.length) {
      this.buffer.push(chunk.subarray(offset));
    } else {
      this.endedOnCR = chunk[chunk.length - 1] === 13 /* CR */;
    }
  }
  /**
   * Processes a single line from the SSE stream.
   */
  processLine(line) {
    if (!line.length) {
      this.dispatchEvent();
      return;
    }
    if (line.startsWith(":")) {
      return;
    }
    let field;
    let value;
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      field = line;
      value = "";
    } else {
      field = line.substring(0, colonIndex);
      value = line.substring(colonIndex + 1);
      if (value.startsWith(" ")) {
        value = value.substring(1);
      }
    }
    this.processField(field, value);
  }
  /**
   * Processes a field with the given name and value.
   */
  processField(field, value) {
    switch (field) {
      case "event":
        this.eventTypeBuffer = value;
        break;
      case "data":
        this.dataBuffer += value;
        this.dataBuffer += "\n";
        break;
      case "id":
        if (!value.includes("\0")) {
          this.currentEventId = this.lastEventIdBuffer = value;
        } else {
          this.currentEventId = void 0;
        }
        break;
      case "retry":
        if (/^\d+$/.test(value)) {
          this.reconnectionTime = parseInt(value, 10);
        }
        break;
    }
  }
  /**
   * Dispatches the event based on the current buffer states.
   */
  dispatchEvent() {
    if (this.dataBuffer === "") {
      this.dataBuffer = "";
      this.eventTypeBuffer = "";
      return;
    }
    if (this.dataBuffer.endsWith("\n")) {
      this.dataBuffer = this.dataBuffer.substring(0, this.dataBuffer.length - 1);
    }
    const event = {
      type: this.eventTypeBuffer || "message",
      data: this.dataBuffer
    };
    if (this.currentEventId !== void 0) {
      event.id = this.currentEventId;
    }
    if (this.reconnectionTime !== void 0) {
      event.retry = this.reconnectionTime;
    }
    this.onEventHandler(event);
    this.reset();
  }
  /**
   * Resets the parser state.
   */
  reset() {
    this.dataBuffer = "";
    this.eventTypeBuffer = "";
    this.currentEventId = void 0;
  }
}
export {
  SSEParser
};
