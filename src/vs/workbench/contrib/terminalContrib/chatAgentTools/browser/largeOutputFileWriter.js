var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { URI } from "../../../../../base/common/uri.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { MAX_OUTPUT_LENGTH, truncateLargeOutput } from "./outputHelpers.js";
let LargeOutputFileWriter = class extends Disposable {
  constructor(_fileService, _logService, _environmentService) {
    super();
    this._fileService = _fileService;
    this._logService = _logService;
    this._environmentService = _environmentService;
    this._tempFiles = /* @__PURE__ */ new Set();
  }
  /**
   * If the output exceeds MAX_OUTPUT_LENGTH, writes it to a temp file and
   * returns a truncated message with the file path. Otherwise returns the
   * output unchanged.
   */
  async processOutput(output) {
    if (output.length <= MAX_OUTPUT_LENGTH) {
      return output;
    }
    const filePath = await this._writeToTempFile(output);
    if (!filePath) {
      return truncateLargeOutput(output);
    }
    return truncateLargeOutput(output, filePath);
  }
  async _writeToTempFile(output) {
    try {
      const fileName = `copilot-terminal-output-${generateUuid()}.txt`;
      const dirUri = URI.joinPath(this._environmentService.cacheHome, "copilot-terminal-output");
      const fileUri = URI.joinPath(dirUri, fileName);
      const fileContent = this._prettyPrintIfJson(output);
      await this._fileService.writeFile(fileUri, VSBuffer.fromString(fileContent));
      this._tempFiles.add(fileUri);
      this._logService.debug(`LargeOutputFileWriter: wrote ${Math.ceil(output.length / 1024)}KB to ${fileUri.fsPath}`);
      return fileUri.fsPath;
    } catch (e) {
      this._logService.debug(`LargeOutputFileWriter: failed to write temp file: ${e}`);
      return void 0;
    }
  }
  _prettyPrintIfJson(output) {
    const trimmed = output.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return output;
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return output;
    }
  }
  /**
   * Cleans up all tracked temp files. Called on session end.
   */
  cleanup() {
    for (const fileUri of this._tempFiles) {
      this._fileService.del(fileUri).catch(() => {
      });
    }
    this._tempFiles.clear();
  }
  dispose() {
    this.cleanup();
    super.dispose();
  }
};
LargeOutputFileWriter = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ITerminalLogService),
  __decorateParam(2, IEnvironmentService)
], LargeOutputFileWriter);
export {
  LargeOutputFileWriter
};
