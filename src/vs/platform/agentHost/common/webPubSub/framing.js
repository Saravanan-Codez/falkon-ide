import { chunk } from "./chunking.js";
import { parseGroupName } from "./groups.js";
const RELIABLE_JSON_SUBPROTOCOL = "json.reliable.webpubsub.azure.v1";
function buildPublish(options) {
  const envelopes = chunk(options.payload, options.chunkOptions);
  return envelopes.map(
    (envelope) => ({
      type: "sendToGroup",
      group: options.group,
      ackId: options.nextAckId(),
      dataType: "json",
      noEcho: true,
      data: envelope
    })
  );
}
class FramingError extends Error {
  constructor(message) {
    super(message);
    this.name = "FramingError";
  }
}
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function parseInbound(frame, options) {
  if (!isObject(frame)) {
    return { kind: "ignored" };
  }
  if (frame["type"] !== "message" || frame["from"] !== "group") {
    return { kind: "ignored" };
  }
  if (frame["dataType"] !== "json") {
    throw new FramingError(`group-fanout frame has unsupported dataType '${String(frame["dataType"])}'`);
  }
  if (typeof frame["group"] !== "string") {
    throw new FramingError(`group-fanout frame is missing a string 'group' field`);
  }
  if (!isObject(frame["data"])) {
    throw new FramingError(`group-fanout frame is missing a 'data' ChunkEnvelope`);
  }
  const group = parseGroupName(frame["group"], options.groupValidation);
  const envelope = frame["data"];
  const payload = options.reassembler.ingest(envelope);
  if (payload === null) {
    return { kind: "pending", group };
  }
  return { kind: "payload", group, payload };
}
export {
  FramingError,
  RELIABLE_JSON_SUBPROTOCOL,
  buildPublish,
  parseInbound
};
