import * as crypto from "crypto";
import * as fs from "fs";
import { createSingleCallFunction } from "../common/functional.js";
async function checksum(path, sha256hash) {
  const checksumPromise = new Promise((resolve, reject) => {
    const input = fs.createReadStream(path);
    const hash2 = crypto.createHash("sha256");
    input.pipe(hash2);
    const done = createSingleCallFunction((err, result) => {
      input.removeAllListeners();
      hash2.removeAllListeners();
      input.destroy();
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
    input.once("error", done);
    input.once("end", done);
    hash2.once("error", done);
    hash2.once("data", (data) => done(void 0, data.toString("hex")));
  });
  const hash = await checksumPromise;
  if (hash !== sha256hash) {
    throw new Error("Hash mismatch");
  }
}
export {
  checksum
};
