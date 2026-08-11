import { createWriteStream, promises } from "fs";
import { createCancelablePromise, Sequencer } from "../common/async.js";
import * as path from "../common/path.js";
import { assertReturnsDefined } from "../common/types.js";
import { Promises } from "./pfs.js";
import * as nls from "../../nls.js";
const CorruptZipMessage = "end of central directory record signature not found";
const CORRUPT_ZIP_PATTERN = new RegExp(CorruptZipMessage);
class ExtractError extends Error {
  constructor(type, cause) {
    let message = cause.message;
    switch (type) {
      case "CorruptZip":
        message = `Corrupt ZIP: ${message}`;
        break;
    }
    super(message);
    this.type = type;
    this.cause = cause;
  }
}
function modeFromEntry(entry) {
  const attr = entry.externalFileAttributes >> 16 || 33188;
  return [
    448,
    56,
    7
    /* S_IRWXO */
  ].map((mask) => attr & mask).reduce(
    (a, b) => a + b,
    attr & 61440
    /* S_IFMT */
  );
}
function toExtractError(err) {
  if (err instanceof ExtractError) {
    return err;
  }
  let type = void 0;
  if (CORRUPT_ZIP_PATTERN.test(err.message)) {
    type = "CorruptZip";
  }
  return new ExtractError(type, err);
}
function extractEntry(stream, fileName, mode, targetPath, options, token) {
  const dirName = path.dirname(fileName);
  const targetDirName = path.join(targetPath, dirName);
  if (!targetDirName.startsWith(targetPath)) {
    return Promise.reject(new Error(nls.localize("invalid file", "Error extracting {0}. Invalid file.", fileName)));
  }
  const targetFileName = path.join(targetPath, fileName);
  let istream;
  const listener = token.onCancellationRequested(() => {
    istream?.destroy();
  });
  return Promise.resolve(promises.mkdir(targetDirName, { recursive: true })).then(() => new Promise((c, e) => {
    if (token.isCancellationRequested) {
      c();
      return;
    }
    try {
      istream = createWriteStream(targetFileName, { mode });
      istream.once("close", () => c());
      istream.once("error", e);
      stream.once("error", e);
      stream.pipe(istream);
    } catch (error) {
      e(error);
    }
  })).finally(() => listener.dispose());
}
function extractZip(zipfile, targetPath, options, token) {
  let last = createCancelablePromise(() => Promise.resolve());
  let extractedEntriesCount = 0;
  const listener = token.onCancellationRequested(() => {
    last.cancel();
    zipfile.close();
  });
  return new Promise((c, e) => {
    const throttler = new Sequencer();
    const readNextEntry = (token2) => {
      if (token2.isCancellationRequested) {
        return;
      }
      extractedEntriesCount++;
      zipfile.readEntry();
    };
    zipfile.once("error", e);
    zipfile.once("close", () => last.then(() => {
      if (token.isCancellationRequested || zipfile.entryCount === extractedEntriesCount) {
        c();
      } else {
        e(new ExtractError("Incomplete", new Error(nls.localize("incompleteExtract", "Incomplete. Found {0} of {1} entries", extractedEntriesCount, zipfile.entryCount))));
      }
    }, e));
    zipfile.readEntry();
    zipfile.on("entry", (entry) => {
      if (token.isCancellationRequested) {
        return;
      }
      if (!options.sourcePathRegex.test(entry.fileName)) {
        readNextEntry(token);
        return;
      }
      const fileName = entry.fileName.replace(options.sourcePathRegex, "");
      if (/\/$/.test(fileName)) {
        const targetFileName = path.join(targetPath, fileName);
        last = createCancelablePromise((token2) => promises.mkdir(targetFileName, { recursive: true }).then(() => readNextEntry(token2)).then(void 0, e));
        return;
      }
      const stream = openZipStream(zipfile, entry);
      const mode = modeFromEntry(entry);
      last = createCancelablePromise((token2) => throttler.queue(() => stream.then((stream2) => extractEntry(stream2, fileName, mode, targetPath, options, token2).then(() => readNextEntry(token2)))).then(null, e));
    });
  }).finally(() => listener.dispose());
}
async function openZip(zipFile, lazy = false) {
  const { open } = await import("yauzl");
  return new Promise((resolve, reject) => {
    open(zipFile, lazy ? { lazyEntries: true } : void 0, (error, zipfile) => {
      if (error) {
        reject(toExtractError(error));
      } else {
        resolve(assertReturnsDefined(zipfile));
      }
    });
  });
}
function openZipStream(zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(toExtractError(error));
      } else {
        resolve(assertReturnsDefined(stream));
      }
    });
  });
}
async function zip(zipPath, files) {
  const { ZipFile } = await import("yazl");
  const zip2 = new ZipFile();
  const zipStream = createWriteStream(zipPath);
  const result = new Promise((c, e) => {
    zip2.outputStream.once("error", e);
    zipStream.once("error", e);
    zipStream.once("finish", () => c(zipPath));
  });
  zip2.outputStream.pipe(zipStream);
  for (const f of files) {
    if (f.contents !== void 0) {
      zip2.addBuffer(typeof f.contents === "string" ? Buffer.from(f.contents, "utf8") : f.contents, f.path);
    } else if (f.localPath) {
      if (f.localPathSize === void 0) {
        zip2.addFile(f.localPath, f.path);
      } else {
        let handle;
        try {
          handle = await promises.open(f.localPath, "r");
        } catch (error) {
          if (error.code === "ENOENT") {
            continue;
          }
          throw error;
        }
        let streamOwnsHandle = false;
        try {
          const size = Math.min(f.localPathSize, (await handle.stat()).size);
          if (size === 0) {
            zip2.addBuffer(Buffer.alloc(0), f.path);
          } else {
            const readStream = handle.createReadStream({ start: 0, end: size - 1 });
            readStream.once("error", (error) => zip2.outputStream.emit("error", error));
            zip2.addReadStream(readStream, f.path, { size });
            streamOwnsHandle = true;
          }
        } finally {
          if (!streamOwnsHandle) {
            await handle.close();
          }
        }
      }
    }
  }
  zip2.end();
  return result;
}
function extract(zipPath, targetPath, options = {}, token) {
  const sourcePathRegex = new RegExp(options.sourcePath ? `^${options.sourcePath}` : "");
  let promise = openZip(zipPath, true);
  if (options.overwrite) {
    promise = promise.then((zipfile) => Promises.rm(targetPath).then(() => zipfile));
  }
  return promise.then((zipfile) => extractZip(zipfile, targetPath, { sourcePathRegex }, token));
}
function read(zipPath, filePath) {
  return openZip(zipPath).then((zipfile) => {
    return new Promise((c, e) => {
      zipfile.once("error", (err) => e(toExtractError(err)));
      zipfile.on("entry", (entry) => {
        if (entry.fileName === filePath) {
          openZipStream(zipfile, entry).then((stream) => c(stream), (err) => e(err));
        }
      });
      zipfile.once("close", () => e(new Error(nls.localize("notFound", "{0} not found inside zip.", filePath))));
    });
  });
}
function buffer(zipPath, filePath) {
  return read(zipPath, filePath).then((stream) => {
    return new Promise((c, e) => {
      const buffers = [];
      stream.once("error", e);
      stream.on("data", (b) => buffers.push(b));
      stream.on("end", () => c(Buffer.concat(buffers)));
    });
  });
}
export {
  CorruptZipMessage,
  ExtractError,
  buffer,
  extract,
  zip
};
