import * as fs from "fs/promises";
import { joinPath } from "../../../base/common/resources.js";
function workspacelessScratchDir(userHome, sessionId) {
  return joinPath(userHome, ".copilot", "chats", sessionId);
}
async function ensureWorkspacelessScratchDir(userHome, sessionId) {
  const dir = workspacelessScratchDir(userHome, sessionId);
  await fs.mkdir(dir.fsPath, { recursive: true });
  return dir;
}
export {
  ensureWorkspacelessScratchDir,
  workspacelessScratchDir
};
