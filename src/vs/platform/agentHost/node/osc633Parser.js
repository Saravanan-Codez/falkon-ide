var Osc633EventType = /* @__PURE__ */ ((Osc633EventType2) => {
  Osc633EventType2[Osc633EventType2["PromptStart"] = 0] = "PromptStart";
  Osc633EventType2[Osc633EventType2["CommandStart"] = 1] = "CommandStart";
  Osc633EventType2[Osc633EventType2["CommandExecuted"] = 2] = "CommandExecuted";
  Osc633EventType2[Osc633EventType2["CommandFinished"] = 3] = "CommandFinished";
  Osc633EventType2[Osc633EventType2["CommandLine"] = 4] = "CommandLine";
  Osc633EventType2[Osc633EventType2["Property"] = 5] = "Property";
  return Osc633EventType2;
})(Osc633EventType || {});
function deserializeOscMessage(message) {
  if (message.indexOf("\\") === -1) {
    return message;
  }
  return message.replaceAll(
    /\\(\\|x([0-9a-f]{2}))/gi,
    (_match, op, hex) => hex ? String.fromCharCode(parseInt(hex, 16)) : op
  );
}
function parseOsc633Payload(payload) {
  const semiIdx = payload.indexOf(";");
  if ((semiIdx === -1 ? payload.length : semiIdx) !== 1) {
    return void 0;
  }
  const command = payload[0];
  const argsRaw = semiIdx === -1 ? "" : payload.substring(semiIdx + 1);
  switch (command) {
    case "A":
      return { type: 0 /* PromptStart */ };
    case "B":
      return { type: 1 /* CommandStart */ };
    case "C":
      return { type: 2 /* CommandExecuted */ };
    case "D": {
      const exitCode = argsRaw.length > 0 ? parseInt(argsRaw, 10) : void 0;
      return {
        type: 3 /* CommandFinished */,
        exitCode: exitCode !== void 0 && !isNaN(exitCode) ? exitCode : void 0
      };
    }
    case "E": {
      const nonceIdx = argsRaw.indexOf(";");
      const commandLine = deserializeOscMessage(nonceIdx === -1 ? argsRaw : argsRaw.substring(0, nonceIdx));
      const nonce = nonceIdx === -1 ? void 0 : argsRaw.substring(nonceIdx + 1);
      return { type: 4 /* CommandLine */, commandLine, nonce };
    }
    case "P": {
      const deserialized = deserializeOscMessage(argsRaw);
      const eqIdx = deserialized.indexOf("=");
      if (eqIdx === -1) {
        return void 0;
      }
      return {
        type: 5 /* Property */,
        key: deserialized.substring(0, eqIdx),
        value: deserialized.substring(eqIdx + 1)
      };
    }
    default:
      return void 0;
  }
}
const ESC = "\x1B";
const OSC_START = ESC + "]";
const BEL = "\x07";
const ST = ESC + "\\";
class Osc633Parser {
  constructor() {
    /** Buffer for an incomplete OSC sequence (from ESC] up to but not including the terminator). */
    this._pendingOsc = "";
    /** Whether we are currently accumulating an OSC sequence. */
    this._inOsc = false;
    /** Set when the previous chunk ended with ESC inside an OSC body (potential ST start). */
    this._pendingEscInOsc = false;
  }
  /**
   * Parse a chunk of PTY data.
   * Returns cleaned data (all OSC 633 sequences removed) and extracted events.
   *
   * This is a convenience view over {@link parseSegments} that concatenates the
   * cleaned-data segments and collects the events. Callers that need to know
   * whether a run of output arrived before or after an event (for correct
   * command-output attribution) should use {@link parseSegments} instead.
   */
  parse(data) {
    const events = [];
    let cleanedData = "";
    for (const segment of this.parseSegments(data)) {
      if (segment.kind === "data") {
        cleanedData += segment.data;
      } else {
        events.push(segment.event);
      }
    }
    return { cleanedData, events };
  }
  /**
   * Parse a chunk of PTY data into an ordered list of segments, preserving the
   * relative order of cleaned output data and OSC 633 events as they appear in
   * the stream. Handles partial sequences that span multiple chunks.
   *
   * Preserving order matters because a single PTY read frequently contains a
   * command's output immediately followed by its `CommandFinished` marker;
   * consumers must append that output to the command before handling the
   * finished event, otherwise the output is lost from the command result.
   */
  parseSegments(data) {
    const segments = [];
    let pending = "";
    const appendData = (value) => {
      pending += value;
    };
    const flushData = () => {
      if (pending.length > 0) {
        segments.push({ kind: "data", data: pending });
        pending = "";
      }
    };
    const emitEvent = (event) => {
      flushData();
      segments.push({ kind: "event", event });
    };
    if (!this._inOsc && data.indexOf(OSC_START) === -1) {
      appendData(data);
      flushData();
      return segments;
    }
    let i = 0;
    while (i < data.length) {
      if (this._inOsc) {
        if (this._pendingEscInOsc) {
          this._pendingEscInOsc = false;
          if (data[i] === "\\") {
            i++;
            this._inOsc = false;
            const payload2 = this._pendingOsc;
            this._pendingOsc = "";
            this._handleOscPayload(payload2, emitEvent, appendData, ST);
            continue;
          }
          this._inOsc = false;
          const payload = this._pendingOsc;
          this._pendingOsc = "";
          this._handleOscPayload(payload, emitEvent, appendData);
          continue;
        }
        const result2 = this._consumeOscBody(data, i);
        i = result2.nextIndex;
        if (result2.complete) {
          this._inOsc = false;
          const payload = this._pendingOsc;
          this._pendingOsc = "";
          this._handleOscPayload(payload, emitEvent, appendData, result2.terminator);
        } else if (result2.pendingEsc) {
          this._pendingEscInOsc = true;
        }
        continue;
      }
      const escIdx = data.indexOf(OSC_START, i);
      if (escIdx === -1) {
        appendData(data.substring(i));
        i = data.length;
        continue;
      }
      appendData(data.substring(i, escIdx));
      i = escIdx + 2;
      this._pendingOsc = "";
      this._inOsc = true;
      const result = this._consumeOscBody(data, i);
      i = result.nextIndex;
      if (result.complete) {
        this._inOsc = false;
        const payload = this._pendingOsc;
        this._pendingOsc = "";
        this._handleOscPayload(payload, emitEvent, appendData, result.terminator);
      } else if (result.pendingEsc) {
        this._pendingEscInOsc = true;
      }
    }
    flushData();
    return segments;
  }
  /**
   * Consume characters from the OSC body, appending to _pendingOsc until a
   * terminator (BEL or ST) is found.
   */
  _consumeOscBody(data, startIdx) {
    const belIdx = data.indexOf(BEL, startIdx);
    const escIdx = data.indexOf(ESC, startIdx);
    if (belIdx !== -1 && (escIdx === -1 || belIdx < escIdx)) {
      this._pendingOsc += data.substring(startIdx, belIdx);
      return { nextIndex: belIdx + 1, complete: true, terminator: BEL };
    }
    if (escIdx !== -1) {
      if (escIdx + 1 >= data.length) {
        this._pendingOsc += data.substring(startIdx, escIdx);
        return { nextIndex: data.length, complete: false, pendingEsc: true };
      }
      this._pendingOsc += data.substring(startIdx, escIdx);
      if (data[escIdx + 1] === "\\") {
        return { nextIndex: escIdx + 2, complete: true, terminator: ST };
      }
      return { nextIndex: escIdx, complete: true };
    }
    this._pendingOsc += data.substring(startIdx);
    return { nextIndex: data.length, complete: false };
  }
  /**
   * Process a complete OSC payload. If it's a 633; sequence, extract the
   * event via {@link emitEvent}. Otherwise, reconstruct the original bytes and
   * pass them through to the cleaned output via {@link appendData}.
   */
  _handleOscPayload(payload, emitEvent, appendData, terminator = BEL) {
    if (payload.startsWith("633;")) {
      const oscContent = payload.substring(4);
      const event = parseOsc633Payload(oscContent);
      if (event) {
        emitEvent(event);
      }
    } else {
      appendData(OSC_START + payload + terminator);
    }
  }
}
export {
  Osc633EventType,
  Osc633Parser
};
