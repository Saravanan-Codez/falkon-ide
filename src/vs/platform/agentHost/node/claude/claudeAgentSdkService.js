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
import { pathToFileURL } from "url";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { join } from "../../../../base/common/path.js";
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { IAgentSdkDownloader } from "../agentSdkDownloader.js";
import { AgentHostClaudeSdkRootEnvVar } from "../../common/agentService.js";
const ClaudeSdkPackage = {
  id: "claude",
  displayName: "Claude",
  devOverrideEnvVar: AgentHostClaudeSdkRootEnvVar,
  hasSeparateMuslLinuxPackage: true
};
const ClaudeDisablePrecompactSkipEnvVar = "CLAUDE_CODE_DISABLE_PRECOMPACT_SKIP";
const IClaudeAgentSdkService = createDecorator("claudeAgentSdkService");
let ClaudeAgentSdkService = class {
  constructor(_logService, _downloader) {
    this._logService = _logService;
    this._downloader = _downloader;
    /**
     * Latched once we've logged a load failure, so a corrupt postinstall
     * doesn't flood `error` events on every `listSessions()` call.
     */
    this._firstLoadFailureLogged = false;
    if (process.env[ClaudeDisablePrecompactSkipEnvVar] === void 0) {
      process.env[ClaudeDisablePrecompactSkipEnvVar] = "1";
    }
  }
  async listSessions() {
    const sdk = await this._getSdk();
    return sdk.listSessions(void 0);
  }
  async canLoadWithoutDownload() {
    if (process.env[AgentHostClaudeSdkRootEnvVar] || !this._downloader.isAvailable(ClaudeSdkPackage)) {
      return true;
    }
    return this._downloader.isSdkResolvableWithoutDownload(ClaudeSdkPackage);
  }
  async getSessionInfo(sessionId) {
    const sdk = await this._getSdk();
    return sdk.getSessionInfo(sessionId);
  }
  async startup(params) {
    const sdk = await this._getSdk();
    return sdk.startup(params);
  }
  async query(params) {
    const sdk = await this._getSdk();
    return sdk.query(params);
  }
  async getSessionMessages(sessionId, options) {
    const sdk = await this._getSdk();
    return sdk.getSessionMessages(sessionId, options);
  }
  async listSubagents(sessionId, options) {
    const sdk = await this._getSdk();
    return sdk.listSubagents(sessionId, options);
  }
  async getSubagentMessages(sessionId, agentId, options) {
    const sdk = await this._getSdk();
    return sdk.getSubagentMessages(sessionId, agentId, options);
  }
  async forkSession(sessionId, options) {
    const sdk = await this._getSdk();
    return sdk.forkSession(sessionId, options);
  }
  async deleteSession(sessionId, options) {
    const sdk = await this._getSdk();
    return sdk.deleteSession(sessionId, options);
  }
  async createSdkMcpServer(options) {
    const sdk = await this._getSdk();
    return sdk.createSdkMcpServer(options);
  }
  async tool(name, description, inputSchema, handler) {
    const sdk = await this._getSdk();
    return sdk.tool(name, description, inputSchema, handler);
  }
  async _getSdk() {
    if (this._sdkModule) {
      return this._sdkModule;
    }
    try {
      this._sdkModule = await this._loadSdk();
      return this._sdkModule;
    } catch (err) {
      if (!this._firstLoadFailureLogged) {
        this._firstLoadFailureLogged = true;
        this._logService.error("[Claude] Failed to load @anthropic-ai/claude-agent-sdk", err);
      }
      throw err;
    }
  }
  async _loadSdk() {
    const override = process.env[AgentHostClaudeSdkRootEnvVar];
    if (override) {
      const entry = join(override, "node_modules", "@anthropic-ai", "claude-agent-sdk", "sdk.mjs");
      return import(pathToFileURL(entry).href);
    }
    if (this._downloader.isAvailable(ClaudeSdkPackage)) {
      const root = await this._downloader.loadSdkRoot(ClaudeSdkPackage, CancellationToken.None);
      const entry = join(root, "node_modules", "@anthropic-ai", "claude-agent-sdk", "sdk.mjs");
      return import(pathToFileURL(entry).href);
    }
    return import("@anthropic-ai/claude-agent-sdk");
  }
};
ClaudeAgentSdkService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IAgentSdkDownloader)
], ClaudeAgentSdkService);
const _assertBindingsMatchSdk = null;
void _assertBindingsMatchSdk;
export {
  ClaudeAgentSdkService,
  ClaudeSdkPackage,
  IClaudeAgentSdkService
};
