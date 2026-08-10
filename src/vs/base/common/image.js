function readImageDimensions(buffer) {
  const bytes = buffer.buffer;
  if (bytes.length < 12) {
    return void 0;
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    return readJpegDimensions(bytes);
  }
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) {
    return readPngDimensions(bytes);
  }
  if (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56 && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97) {
    return readGifDimensions(bytes);
  }
  if (bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
    return readWebPDimensions(bytes);
  }
  return void 0;
}
function readJpegDimensions(bytes) {
  let i = 2;
  while (i < bytes.length - 9) {
    while (i < bytes.length && bytes[i] === 255) {
      i++;
    }
    if (i >= bytes.length) {
      return void 0;
    }
    const marker = bytes[i];
    i++;
    if (marker === 216 || marker === 217 || marker === 1 || marker >= 208 && marker <= 215) {
      continue;
    }
    if (i + 1 >= bytes.length) {
      return void 0;
    }
    const segLength = bytes[i] << 8 | bytes[i + 1];
    if (segLength < 2) {
      return void 0;
    }
    if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
      if (i + 6 >= bytes.length) {
        return void 0;
      }
      const height = bytes[i + 3] << 8 | bytes[i + 4];
      const width = bytes[i + 5] << 8 | bytes[i + 6];
      return { width, height };
    }
    i += segLength;
  }
  return void 0;
}
function readPngDimensions(bytes) {
  if (bytes.length < 24 || bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) {
    return void 0;
  }
  const width = (bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19]) >>> 0;
  const height = (bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23]) >>> 0;
  return { width, height };
}
function readGifDimensions(bytes) {
  if (bytes.length < 10) {
    return void 0;
  }
  const width = bytes[6] | bytes[7] << 8;
  const height = bytes[8] | bytes[9] << 8;
  return { width, height };
}
function readWebPDimensions(bytes) {
  if (bytes.length < 30) {
    return void 0;
  }
  const chunkSize = (bytes[16] | bytes[17] << 8 | bytes[18] << 16 | bytes[19] << 24) >>> 0;
  if (chunkSize > bytes.length - 20) {
    return void 0;
  }
  if (bytes[12] === 86 && bytes[13] === 80 && bytes[14] === 56 && bytes[15] === 32) {
    if (chunkSize < 10 || bytes[23] !== 157 || bytes[24] !== 1 || bytes[25] !== 42) {
      return void 0;
    }
    const width = (bytes[26] | bytes[27] << 8) & 16383;
    const height = (bytes[28] | bytes[29] << 8) & 16383;
    return { width, height };
  }
  if (bytes[12] === 86 && bytes[13] === 80 && bytes[14] === 56 && bytes[15] === 76) {
    if (chunkSize < 5 || bytes[20] !== 47) {
      return void 0;
    }
    const width = ((bytes[21] | bytes[22] << 8) & 16383) + 1;
    const height = ((bytes[22] >> 6 | bytes[23] << 2 | (bytes[24] & 15) << 10) & 16383) + 1;
    return { width, height };
  }
  if (bytes[12] === 86 && bytes[13] === 80 && bytes[14] === 56 && bytes[15] === 88) {
    if (chunkSize < 10) {
      return void 0;
    }
    const width = ((bytes[24] | bytes[25] << 8 | bytes[26] << 16) & 16777215) + 1;
    const height = ((bytes[27] | bytes[28] << 8 | bytes[29] << 16) & 16777215) + 1;
    return { width, height };
  }
  return void 0;
}
export {
  readImageDimensions
};
