import { Lazy } from "./lazy.js";
import * as streams from "./stream.js";
const hasBuffer = typeof Buffer !== "undefined";
const indexOfTable = new Lazy(() => new Uint8Array(256));
let textEncoder;
let textDecoder;
class VSBuffer {
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static alloc(byteLength) {
    if (hasBuffer) {
      return new VSBuffer(Buffer.allocUnsafe(byteLength));
    } else {
      return new VSBuffer(new Uint8Array(byteLength));
    }
  }
  /**
   * When running in a nodejs context, if `actual` is not a nodejs Buffer, the backing store for
   * the returned `VSBuffer` instance might use a nodejs Buffer allocated from node's Buffer pool,
   * which is not transferrable.
   */
  static wrap(actual) {
    if (hasBuffer && !Buffer.isBuffer(actual)) {
      actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
    }
    return new VSBuffer(actual);
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static fromString(source, options) {
    const dontUseNodeBuffer = options?.dontUseNodeBuffer || false;
    if (!dontUseNodeBuffer && hasBuffer) {
      return new VSBuffer(Buffer.from(source));
    } else {
      if (!textEncoder) {
        textEncoder = new TextEncoder();
      }
      return new VSBuffer(textEncoder.encode(source));
    }
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static fromByteArray(source) {
    const result = VSBuffer.alloc(source.length);
    for (let i = 0, len = source.length; i < len; i++) {
      result.buffer[i] = source[i];
    }
    return result;
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  static concat(buffers, totalLength) {
    if (typeof totalLength === "undefined") {
      totalLength = 0;
      for (let i = 0, len = buffers.length; i < len; i++) {
        totalLength += buffers[i].byteLength;
      }
    }
    const ret = VSBuffer.alloc(totalLength);
    let offset = 0;
    for (let i = 0, len = buffers.length; i < len; i++) {
      const element = buffers[i];
      ret.set(element, offset);
      offset += element.byteLength;
    }
    return ret;
  }
  static isNativeBuffer(buffer) {
    return hasBuffer && Buffer.isBuffer(buffer);
  }
  constructor(buffer) {
    this.buffer = buffer;
    this.byteLength = this.buffer.byteLength;
  }
  /**
   * When running in a nodejs context, the backing store for the returned `VSBuffer` instance
   * might use a nodejs Buffer allocated from node's Buffer pool, which is not transferrable.
   */
  clone() {
    const result = VSBuffer.alloc(this.byteLength);
    result.set(this);
    return result;
  }
  toString() {
    if (hasBuffer) {
      return this.buffer.toString();
    } else {
      if (!textDecoder) {
        textDecoder = new TextDecoder(void 0, { ignoreBOM: true });
      }
      return textDecoder.decode(this.buffer);
    }
  }
  slice(start, end) {
    return new VSBuffer(this.buffer.subarray(start, end));
  }
  set(array, offset) {
    if (array instanceof VSBuffer) {
      this.buffer.set(array.buffer, offset);
    } else if (array instanceof Uint8Array) {
      this.buffer.set(array, offset);
    } else if (array instanceof ArrayBuffer) {
      this.buffer.set(new Uint8Array(array), offset);
    } else if (ArrayBuffer.isView(array)) {
      this.buffer.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), offset);
    } else {
      throw new Error(`Unknown argument 'array'`);
    }
  }
  readUInt32BE(offset) {
    return readUInt32BE(this.buffer, offset);
  }
  writeUInt32BE(value, offset) {
    writeUInt32BE(this.buffer, value, offset);
  }
  readUInt32LE(offset) {
    return readUInt32LE(this.buffer, offset);
  }
  writeUInt32LE(value, offset) {
    writeUInt32LE(this.buffer, value, offset);
  }
  readUInt8(offset) {
    return readUInt8(this.buffer, offset);
  }
  writeUInt8(value, offset) {
    writeUInt8(this.buffer, value, offset);
  }
  indexOf(subarray, offset = 0) {
    return binaryIndexOf(this.buffer, subarray instanceof VSBuffer ? subarray.buffer : subarray, offset);
  }
  equals(other) {
    if (this === other) {
      return true;
    }
    if (this.byteLength !== other.byteLength) {
      return false;
    }
    return this.buffer.every((value, index) => value === other.buffer[index]);
  }
}
function binaryIndexOf(haystack, needle, offset = 0) {
  const needleLen = needle.byteLength;
  const haystackLen = haystack.byteLength;
  if (needleLen === 0) {
    return 0;
  }
  if (needleLen === 1) {
    return haystack.indexOf(needle[0], offset);
  }
  if (needleLen > haystackLen - offset) {
    return -1;
  }
  const table = indexOfTable.value;
  table.fill(needle.length);
  for (let i2 = 0; i2 < needle.length; i2++) {
    table[needle[i2]] = needle.length - i2 - 1;
  }
  let i = offset + needle.length - 1;
  let j = i;
  let result = -1;
  while (i < haystackLen) {
    if (haystack[i] === needle[j]) {
      if (j === 0) {
        result = i;
        break;
      }
      i--;
      j--;
    } else {
      i += Math.max(needle.length - j, table[haystack[i]]);
      j = needle.length - 1;
    }
  }
  return result;
}
function readUInt16LE(source, offset) {
  return source[offset + 0] << 0 >>> 0 | source[offset + 1] << 8 >>> 0;
}
function writeUInt16LE(destination, value, offset) {
  destination[offset + 0] = value & 255;
  value = value >>> 8;
  destination[offset + 1] = value & 255;
}
function readUInt32BE(source, offset) {
  return source[offset] * 2 ** 24 + source[offset + 1] * 2 ** 16 + source[offset + 2] * 2 ** 8 + source[offset + 3];
}
function writeUInt32BE(destination, value, offset) {
  destination[offset + 3] = value;
  value = value >>> 8;
  destination[offset + 2] = value;
  value = value >>> 8;
  destination[offset + 1] = value;
  value = value >>> 8;
  destination[offset] = value;
}
function readUInt32LE(source, offset) {
  return source[offset + 0] << 0 >>> 0 | source[offset + 1] << 8 >>> 0 | source[offset + 2] << 16 >>> 0 | source[offset + 3] << 24 >>> 0;
}
function writeUInt32LE(destination, value, offset) {
  destination[offset + 0] = value & 255;
  value = value >>> 8;
  destination[offset + 1] = value & 255;
  value = value >>> 8;
  destination[offset + 2] = value & 255;
  value = value >>> 8;
  destination[offset + 3] = value & 255;
}
function readUInt8(source, offset) {
  return source[offset];
}
function writeUInt8(destination, value, offset) {
  destination[offset] = value;
}
function readableToBuffer(readable) {
  return streams.consumeReadable(readable, (chunks) => VSBuffer.concat(chunks));
}
function bufferToReadable(buffer) {
  return streams.toReadable(buffer);
}
function streamToBuffer(stream) {
  return streams.consumeStream(stream, (chunks) => VSBuffer.concat(chunks));
}
async function bufferedStreamToBuffer(bufferedStream) {
  if (bufferedStream.ended) {
    return VSBuffer.concat(bufferedStream.buffer);
  }
  return VSBuffer.concat([
    // Include already read chunks...
    ...bufferedStream.buffer,
    // ...and all additional chunks
    await streamToBuffer(bufferedStream.stream)
  ]);
}
function bufferToStream(buffer) {
  return streams.toStream(buffer, (chunks) => VSBuffer.concat(chunks));
}
function streamToBufferReadableStream(stream) {
  return streams.transform(stream, { data: (data) => typeof data === "string" ? VSBuffer.fromString(data) : VSBuffer.wrap(data) }, (chunks) => VSBuffer.concat(chunks));
}
function newWriteableBufferStream(options) {
  return streams.newWriteableStream((chunks) => VSBuffer.concat(chunks), options);
}
function prefixedBufferReadable(prefix, readable) {
  return streams.prefixedReadable(prefix, readable, (chunks) => VSBuffer.concat(chunks));
}
function prefixedBufferStream(prefix, stream) {
  return streams.prefixedStream(prefix, stream, (chunks) => VSBuffer.concat(chunks));
}
function decodeBase64(encoded) {
  let building = 0;
  let remainder = 0;
  let bufi = 0;
  const buffer = new Uint8Array(Math.floor(encoded.length / 4 * 3));
  const append = (value) => {
    switch (remainder) {
      case 3:
        buffer[bufi++] = building | value;
        remainder = 0;
        break;
      case 2:
        buffer[bufi++] = building | value >>> 2;
        building = value << 6;
        remainder = 3;
        break;
      case 1:
        buffer[bufi++] = building | value >>> 4;
        building = value << 4;
        remainder = 2;
        break;
      default:
        building = value << 2;
        remainder = 1;
    }
  };
  for (let i = 0; i < encoded.length; i++) {
    const code = encoded.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      append(code - 65);
    } else if (code >= 97 && code <= 122) {
      append(code - 97 + 26);
    } else if (code >= 48 && code <= 57) {
      append(code - 48 + 52);
    } else if (code === 43 || code === 45) {
      append(62);
    } else if (code === 47 || code === 95) {
      append(63);
    } else if (code === 61) {
      break;
    } else {
      throw new SyntaxError(`Unexpected base64 character ${encoded[i]}`);
    }
  }
  const unpadded = bufi;
  while (remainder > 0) {
    append(0);
  }
  return VSBuffer.wrap(buffer).slice(0, unpadded);
}
const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64UrlSafeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function encodeBase64({ buffer }, padded = true, urlSafe = false) {
  const dictionary = urlSafe ? base64UrlSafeAlphabet : base64Alphabet;
  let output = "";
  const remainder = buffer.byteLength % 3;
  let i = 0;
  for (; i < buffer.byteLength - remainder; i += 3) {
    const a = buffer[i + 0];
    const b = buffer[i + 1];
    const c = buffer[i + 2];
    output += dictionary[a >>> 2];
    output += dictionary[(a << 4 | b >>> 4) & 63];
    output += dictionary[(b << 2 | c >>> 6) & 63];
    output += dictionary[c & 63];
  }
  if (remainder === 1) {
    const a = buffer[i + 0];
    output += dictionary[a >>> 2];
    output += dictionary[a << 4 & 63];
    if (padded) {
      output += "==";
    }
  } else if (remainder === 2) {
    const a = buffer[i + 0];
    const b = buffer[i + 1];
    output += dictionary[a >>> 2];
    output += dictionary[(a << 4 | b >>> 4) & 63];
    output += dictionary[b << 2 & 63];
    if (padded) {
      output += "=";
    }
  }
  return output;
}
const hexChars = "0123456789abcdef";
function encodeHex({ buffer }) {
  let result = "";
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    result += hexChars[byte >>> 4];
    result += hexChars[byte & 15];
  }
  return result;
}
function decodeHex(hex) {
  if (hex.length % 2 !== 0) {
    throw new SyntaxError("Hex string must have an even length");
  }
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < hex.length; ) {
    out[i >> 1] = decodeHexChar(hex, i++) << 4 | decodeHexChar(hex, i++);
  }
  return VSBuffer.wrap(out);
}
function decodeHexChar(str, position) {
  const s = str.charCodeAt(position);
  if (s >= 48 && s <= 57) {
    return s - 48;
  } else if (s >= 97 && s <= 102) {
    return s - 87;
  } else if (s >= 65 && s <= 70) {
    return s - 55;
  } else {
    throw new SyntaxError(`Invalid hex character at position ${position}`);
  }
}
export {
  VSBuffer,
  binaryIndexOf,
  bufferToReadable,
  bufferToStream,
  bufferedStreamToBuffer,
  decodeBase64,
  decodeHex,
  encodeBase64,
  encodeHex,
  newWriteableBufferStream,
  prefixedBufferReadable,
  prefixedBufferStream,
  readUInt16LE,
  readUInt32BE,
  readUInt32LE,
  readUInt8,
  readableToBuffer,
  streamToBuffer,
  streamToBufferReadableStream,
  writeUInt16LE,
  writeUInt32BE,
  writeUInt32LE,
  writeUInt8
};
