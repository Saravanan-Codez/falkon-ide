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
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { hashAsync } from "../../../../../base/common/hash.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { revive } from "../../../../../base/common/marshalling.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { getChatSessionStorageResource } from "../../common/model/chatUri.js";
import { getKeyForChatSessionResource } from "./chatEditingOperations.js";
const STORAGE_CONTENTS_FOLDER = "contents";
const STORAGE_STATE_FILE = "state.json";
let ChatEditingSessionStorage = class {
  constructor(_chatSessionResource, _fileService, _environmentService, _logService, _workspaceContextService) {
    this._chatSessionResource = _chatSessionResource;
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._workspaceContextService = _workspaceContextService;
    this.storageKey = getKeyForChatSessionResource(_chatSessionResource);
  }
  _getStorageLocation() {
    const workspaceId = this._workspaceContextService.getWorkspace().id;
    const storageRoot = joinPath(this._environmentService.workspaceStorageHome, workspaceId, "chatEditingSessions");
    return getChatSessionStorageResource(storageRoot, this.storageKey);
  }
  async restoreState() {
    const storageLocation = this._getStorageLocation();
    const fileContents = /* @__PURE__ */ new Map();
    const getFileContent = (hash) => {
      let readPromise = fileContents.get(hash);
      if (!readPromise) {
        readPromise = this._fileService.readFile(joinPath(storageLocation, STORAGE_CONTENTS_FOLDER, hash)).then((content) => content.value.toString());
        fileContents.set(hash, readPromise);
      }
      return readPromise;
    };
    const deserializeSnapshotEntriesDTO = async (dtoEntries) => {
      const entries = new ResourceMap();
      for (const entryDTO of dtoEntries) {
        const entry = await deserializeSnapshotEntry(entryDTO);
        entries.set(entry.resource, entry);
      }
      return entries;
    };
    const deserializeChatEditingStopDTO = async (stopDTO) => {
      const entries = await deserializeSnapshotEntriesDTO(stopDTO.entries);
      return { stopId: "stopId" in stopDTO ? stopDTO.stopId : void 0, entries };
    };
    const deserializeSnapshotEntry = async (entry) => {
      return {
        resource: URI.parse(entry.resource),
        languageId: entry.languageId,
        original: await getFileContent(entry.originalHash),
        current: await getFileContent(entry.currentHash),
        state: entry.state,
        snapshotUri: URI.parse(entry.snapshotUri),
        telemetryInfo: {
          requestId: entry.telemetryInfo.requestId,
          agentId: entry.telemetryInfo.agentId,
          command: entry.telemetryInfo.command,
          sessionResource: this._chatSessionResource,
          result: void 0,
          modelId: entry.telemetryInfo.modelId,
          modeId: entry.telemetryInfo.modeId,
          applyCodeBlockSuggestionId: entry.telemetryInfo.applyCodeBlockSuggestionId,
          feature: entry.telemetryInfo.feature
        },
        isDeleted: entry.isDeleted
      };
    };
    try {
      const stateFilePath = joinPath(storageLocation, STORAGE_STATE_FILE);
      if (!await this._fileService.exists(stateFilePath)) {
        this._logService.debug(`chatEditingSession: No editing session state found at ${stateFilePath.toString()}`);
        return void 0;
      }
      this._logService.debug(`chatEditingSession: Restoring editing session at ${stateFilePath.toString()}`);
      const stateFileContent = await this._fileService.readFile(stateFilePath);
      const data = JSON.parse(stateFileContent.value.toString());
      if (!COMPATIBLE_STORAGE_VERSIONS.includes(data.version)) {
        return void 0;
      }
      const initialFileContents = new ResourceMap();
      for (const fileContentDTO of data.initialFileContents) {
        initialFileContents.set(URI.parse(fileContentDTO[0]), await getFileContent(fileContentDTO[1]));
      }
      const recentSnapshot = await deserializeChatEditingStopDTO(data.recentSnapshot);
      return {
        initialFileContents,
        recentSnapshot,
        timeline: revive(data.timeline)
      };
    } catch (e) {
      this._logService.error(`Error restoring chat editing session from ${storageLocation.toString()}`, e);
    }
    return void 0;
  }
  async storeState(state) {
    const storageFolder = this._getStorageLocation();
    const contentsFolder = URI.joinPath(storageFolder, STORAGE_CONTENTS_FOLDER);
    const existingContents = /* @__PURE__ */ new Set();
    try {
      const stat = await this._fileService.resolve(contentsFolder);
      stat.children?.forEach((child) => {
        if (child.isFile) {
          existingContents.add(child.name);
        }
      });
    } catch (e) {
      try {
        await this._fileService.createFolder(contentsFolder);
      } catch (e2) {
        this._logService.error(`Error creating chat editing session content folder ${contentsFolder.toString()}`, e2);
        return;
      }
    }
    const contentWritePromises = /* @__PURE__ */ new Map();
    const writeContent = async (content) => {
      const buffer = VSBuffer.fromString(content);
      const hash = (await hashAsync(buffer)).substring(0, 7);
      if (!existingContents.has(hash)) {
        await this._fileService.writeFile(joinPath(contentsFolder, hash), buffer);
      }
      return hash;
    };
    const addFileContent = async (content) => {
      let storedContentHash = contentWritePromises.get(content);
      if (!storedContentHash) {
        storedContentHash = writeContent(content);
        contentWritePromises.set(content, storedContentHash);
      }
      return storedContentHash;
    };
    const serializeResourceMap = async (resourceMap, serialize) => {
      return await Promise.all(Array.from(resourceMap.entries()).map(async ([resourceURI, value]) => [resourceURI.toString(), await serialize(value)]));
    };
    const serializeChatEditingSessionStop = async (stop) => {
      return {
        stopId: stop.stopId,
        entries: await Promise.all(Array.from(stop.entries.values()).map(serializeSnapshotEntry))
      };
    };
    const serializeSnapshotEntry = async (entry) => {
      return {
        resource: entry.resource.toString(),
        languageId: entry.languageId,
        originalHash: await addFileContent(entry.original),
        currentHash: await addFileContent(entry.current),
        state: entry.state,
        snapshotUri: entry.snapshotUri.toString(),
        telemetryInfo: { requestId: entry.telemetryInfo.requestId, agentId: entry.telemetryInfo.agentId, command: entry.telemetryInfo.command, modelId: entry.telemetryInfo.modelId, modeId: entry.telemetryInfo.modeId },
        isDeleted: entry.isDeleted
      };
    };
    try {
      const data = {
        version: STORAGE_VERSION,
        initialFileContents: await serializeResourceMap(state.initialFileContents, (value) => addFileContent(value)),
        timeline: state.timeline,
        recentSnapshot: await serializeChatEditingSessionStop(state.recentSnapshot)
      };
      this._logService.debug(`chatEditingSession: Storing editing session at ${storageFolder.toString()}: ${contentWritePromises.size} files`);
      await this._fileService.writeFile(joinPath(storageFolder, STORAGE_STATE_FILE), VSBuffer.fromString(JSON.stringify(data)));
    } catch (e) {
      this._logService.debug(`Error storing chat editing session to ${storageFolder.toString()}`, e);
    }
  }
  async clearState() {
    const storageFolder = this._getStorageLocation();
    if (await this._fileService.exists(storageFolder)) {
      this._logService.debug(`chatEditingSession: Clearing editing session at ${storageFolder.toString()}`);
      try {
        await this._fileService.del(storageFolder, { recursive: true });
      } catch (e) {
        this._logService.debug(`Error clearing chat editing session from ${storageFolder.toString()}`, e);
      }
    }
  }
};
ChatEditingSessionStorage = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IWorkspaceContextService)
], ChatEditingSessionStorage);
const COMPATIBLE_STORAGE_VERSIONS = [1, 2];
const STORAGE_VERSION = 2;
export {
  ChatEditingSessionStorage
};
