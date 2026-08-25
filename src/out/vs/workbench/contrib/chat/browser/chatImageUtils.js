import { raceTimeout } from "../../../../base/common/async.js";
import { decodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { LRUCache } from "../../../../base/common/map.js";
import { joinPath } from "../../../../base/common/resources.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
async function resizeImage(data, mimeType) {
  const isGif = mimeType === "image/gif";
  if (typeof data === "string") {
    data = convertStringToUInt8Array(data);
  }
  return new Promise((resolve, reject) => {
    const blob = new Blob([data], { type: mimeType });
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if ((width <= 768 || height <= 768) && !isGif) {
        resolve(data);
        return;
      }
      if (width > 2048 || height > 2048) {
        const scaleFactor2 = 2048 / Math.max(width, height);
        width = Math.round(width * scaleFactor2);
        height = Math.round(height * scaleFactor2);
      }
      const scaleFactor = 768 / Math.min(width, height);
      width = Math.round(width * scaleFactor);
      height = Math.round(height * scaleFactor);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const jpegTypes = ["image/jpeg", "image/jpg"];
        const outputMimeType = mimeType && jpegTypes.includes(mimeType) ? "image/jpeg" : "image/png";
        canvas.toBlob((blob2) => {
          if (blob2) {
            const reader = new FileReader();
            reader.onload = () => {
              resolve(new Uint8Array(reader.result));
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(blob2);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, outputMimeType);
      } else {
        reject(new Error("Failed to get canvas context"));
      }
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
  });
}
function createImageThumbnail(data, maxSize) {
  return new Promise((resolve) => {
    const blob = new Blob([data]);
    const img = document.createElement("img");
    const url = URL.createObjectURL(blob);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const scaleFactor = Math.min(1, maxSize / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scaleFactor));
      const targetHeight = Math.max(1, Math.round(height * scaleFactor));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(void 0);
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const outputMimeType = data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255 ? "image/jpeg" : "image/png";
      canvas.toBlob((thumbnail) => resolve(thumbnail ?? void 0), outputMimeType);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(void 0);
    };
  });
}
const thumbnailCache = new LRUCache(50);
const THUMBNAIL_DECODE_TIMEOUT_MS = 1e4;
const CHAT_IMAGE_HOVER_THUMBNAIL_MAX_SIZE = 768;
function getOrCreateImageThumbnail(cacheKey, data, maxSize) {
  const key = `${cacheKey}:${maxSize}:${data.byteLength}`;
  const cached = thumbnailCache.get(key);
  if (cached) {
    return cached;
  }
  const thumbnail = raceTimeout(createImageThumbnail(data, maxSize), THUMBNAIL_DECODE_TIMEOUT_MS).then((blob) => {
    if (!blob && thumbnailCache.peek(key) === thumbnail) {
      thumbnailCache.delete(key);
    }
    return blob;
  });
  thumbnailCache.set(key, thumbnail);
  return thumbnail;
}
function convertStringToUInt8Array(data) {
  const base64Data = data.includes(",") ? data.split(",")[1] : data;
  if (isValidBase64(base64Data)) {
    return decodeBase64(base64Data).buffer;
  }
  return new TextEncoder().encode(data);
}
function convertUint8ArrayToString(data) {
  try {
    const decoder = new TextDecoder();
    const decodedString = decoder.decode(data);
    return decodedString;
  } catch {
    return "";
  }
}
function isValidBase64(str) {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str) && (() => {
    try {
      atob(str);
      return true;
    } catch {
      return false;
    }
  })();
}
async function createFileForMedia(fileService, imagesFolder, dataTransfer, mimeType) {
  const exists = await fileService.exists(imagesFolder);
  if (!exists) {
    await fileService.createFolder(imagesFolder);
  }
  const ext = mimeType.split("/")[1] || "png";
  const filename = `image-${Date.now()}.${ext}`;
  const fileUri = joinPath(imagesFolder, filename);
  const buffer = VSBuffer.wrap(dataTransfer);
  await fileService.writeFile(fileUri, buffer);
  return fileUri;
}
async function cleanupOldImages(fileService, logService, imagesFolder) {
  const exists = await fileService.exists(imagesFolder);
  if (!exists) {
    return;
  }
  const duration = 7 * 24 * 60 * 60 * 1e3;
  const files = await fileService.resolve(imagesFolder);
  if (!files.children) {
    return;
  }
  await Promise.all(files.children.map(async (file) => {
    try {
      const timestamp = getTimestampFromFilename(file.name);
      if (timestamp && Date.now() - timestamp > duration) {
        await fileService.del(file.resource);
      }
    } catch (err) {
      logService.error("Failed to clean up old images", err);
    }
  }));
}
function getTimestampFromFilename(filename) {
  const match = filename.match(/image-(\d+)\./);
  if (match) {
    return parseInt(match[1], 10);
  }
  return void 0;
}
CommandsRegistry.registerCommand("_chat.resizeImage", async (_accessor, data, mimeType) => {
  if (data instanceof VSBuffer) {
    data = data.buffer;
  }
  return resizeImage(data, mimeType);
});
export {
  CHAT_IMAGE_HOVER_THUMBNAIL_MAX_SIZE,
  cleanupOldImages,
  convertStringToUInt8Array,
  convertUint8ArrayToString,
  createFileForMedia,
  getOrCreateImageThumbnail,
  resizeImage
};
