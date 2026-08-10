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
import { Event } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { FileSystemProviderCapabilities, FileType, IFileService } from "../../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IChatEditingService } from "../../../common/editing/chatEditingService.js";
import { LocalChatSessionUri } from "../../../common/model/chatUri.js";
import { ChatEditingNotebookSnapshotScheme } from "./chatEditingModifiedNotebookSnapshot.js";
let ChatEditingNotebookFileSystemProviderContrib = class extends Disposable {
  constructor(fileService, instantiationService) {
    super();
    this.fileService = fileService;
    const fileSystemProvider = instantiationService.createInstance(ChatEditingNotebookFileSystemProvider);
    this._register(this.fileService.registerProvider(ChatEditingNotebookSnapshotScheme, fileSystemProvider));
  }
  static {
    this.ID = "chatEditingNotebookFileSystemProviderContribution";
  }
};
ChatEditingNotebookFileSystemProviderContrib = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IInstantiationService)
], ChatEditingNotebookFileSystemProviderContrib);
let ChatEditingNotebookFileSystemProvider = class {
  constructor(_chatEditingService) {
    this._chatEditingService = _chatEditingService;
    this.capabilities = FileSystemProviderCapabilities.Readonly | FileSystemProviderCapabilities.FileAtomicRead | FileSystemProviderCapabilities.FileReadWrite;
    this.onDidChangeCapabilities = Event.None;
    this.onDidChangeFile = Event.None;
  }
  static {
    this.registeredFiles = new ResourceMap();
  }
  static registerFile(resource, buffer) {
    ChatEditingNotebookFileSystemProvider.registeredFiles.set(resource, buffer);
    return {
      dispose() {
        if (ChatEditingNotebookFileSystemProvider.registeredFiles.get(resource) === buffer) {
          ChatEditingNotebookFileSystemProvider.registeredFiles.delete(resource);
        }
      }
    };
  }
  watch(_resource, _opts) {
    return Disposable.None;
  }
  async stat(_resource) {
    return {
      type: FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0
    };
  }
  mkdir(_resource) {
    throw new Error("Method not implemented1.");
  }
  readdir(_resource) {
    throw new Error("Method not implemented2.");
  }
  delete(_resource, _opts) {
    throw new Error("Method not implemented3.");
  }
  rename(_from, _to, _opts) {
    throw new Error("Method not implemented4.");
  }
  copy(_from, _to, _opts) {
    throw new Error("Method not implemented5.");
  }
  async readFile(resource) {
    const buffer = ChatEditingNotebookFileSystemProvider.registeredFiles.get(resource);
    if (buffer) {
      return buffer.buffer;
    }
    const queryData = JSON.parse(resource.query);
    if (!queryData.viewType) {
      throw new Error("File not found, viewType not found");
    }
    const session = this._chatEditingService.getEditingSession(LocalChatSessionUri.forSession(queryData.sessionId));
    if (!session || !queryData.requestId) {
      throw new Error("File not found, session not found");
    }
    const snapshotEntry = await session.getSnapshotContents(queryData.requestId, resource, queryData.undoStop || void 0);
    if (!snapshotEntry) {
      throw new Error("File not found, snapshot not found");
    }
    return snapshotEntry.buffer;
  }
  writeFile(__resource, _content, _opts) {
    throw new Error("Method not implemented7.");
  }
  readFileStream(__resource, _opts, _token) {
    throw new Error("Method not implemented8.");
  }
  open(__resource, _opts) {
    throw new Error("Method not implemented9.");
  }
  close(_fd) {
    throw new Error("Method not implemented10.");
  }
  read(_fd, _pos, _data, _offset, _length) {
    throw new Error("Method not implemented11.");
  }
  write(_fd, _pos, _data, _offset, _length) {
    throw new Error("Method not implemented12.");
  }
  cloneFile(_from, __to) {
    throw new Error("Method not implemented13.");
  }
};
ChatEditingNotebookFileSystemProvider = __decorateClass([
  __decorateParam(0, IChatEditingService)
], ChatEditingNotebookFileSystemProvider);
export {
  ChatEditingNotebookFileSystemProvider,
  ChatEditingNotebookFileSystemProviderContrib
};
