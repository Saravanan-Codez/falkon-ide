import * as fs from "fs";
import { tmpdir } from "os";
import { Queue } from "../../../base/common/async.js";
import { randomPath } from "../../../base/common/extpath.js";
import { resolveTerminalEncoding } from "../../../base/node/terminalEncoding.js";
function hasStdinWithoutTty() {
  try {
    return !process.stdin.isTTY;
  } catch {
  }
  return false;
}
function stdinDataListener(durationinMs) {
  return new Promise((resolve) => {
    const dataListener = () => resolve(true);
    setTimeout(() => {
      process.stdin.removeListener("data", dataListener);
      resolve(false);
    }, durationinMs);
    process.stdin.once("data", dataListener);
  });
}
function getStdinFilePath() {
  return randomPath(tmpdir(), "code-stdin", 3);
}
async function createStdInFile(targetPath) {
  await fs.promises.appendFile(targetPath, "");
  await fs.promises.chmod(targetPath, 384);
}
async function readFromStdin(targetPath, verbose, onEnd) {
  let [encoding, iconv] = await Promise.all([
    resolveTerminalEncoding(verbose),
    // respect terminal encoding when piping into file
    import("@vscode/iconv-lite-umd"),
    // lazy load encoding module for usage
    createStdInFile(targetPath)
    // make sure file exists right away (https://github.com/microsoft/vscode/issues/155341)
  ]);
  if (!iconv.default.encodingExists(encoding)) {
    console.log(`Unsupported terminal encoding: ${encoding}, falling back to UTF-8.`);
    encoding = "utf8";
  }
  const appendFileQueue = new Queue();
  const decoder = iconv.default.getDecoder(encoding);
  process.stdin.on("data", (chunk) => {
    const chunkStr = decoder.write(chunk);
    appendFileQueue.queue(() => fs.promises.appendFile(targetPath, chunkStr));
  });
  process.stdin.on("end", () => {
    const end = decoder.end();
    appendFileQueue.queue(async () => {
      try {
        if (typeof end === "string") {
          await fs.promises.appendFile(targetPath, end);
        }
      } finally {
        onEnd?.();
      }
    });
  });
}
export {
  getStdinFilePath,
  hasStdinWithoutTty,
  readFromStdin,
  stdinDataListener
};
