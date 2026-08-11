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
import { Disposable } from "../../../base/common/lifecycle.js";
import { OS } from "../../../base/common/platform.js";
import { IFileService } from "../../files/common/files.js";
import { InMemoryFileSystemProvider } from "../../files/common/inMemoryFilesystemProvider.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILabelService } from "../../label/common/label.js";
import { AgentHostFileSystemProvider } from "./agentHostFileSystemProvider.js";
import { AGENT_HOST_LABEL_FORMATTER, AGENT_HOST_SCHEME, agentHostLabelFormatter, LOCAL_AGENT_HOST_AUTHORITY } from "./agentHostUri.js";
const SYNCED_CUSTOMIZATION_SCHEME = "vscode-synced-customization";
const IAgentHostFileSystemService = createDecorator("agentHostFileSystemService");
let AgentHostFileSystemService = class extends Disposable {
  constructor(_fileService, labelService) {
    super();
    this._fileService = _fileService;
    this._syncedCustomizationProviderRegistered = false;
    this._fsProvider = this._register(new AgentHostFileSystemProvider());
    this._register(_fileService.registerProvider(AGENT_HOST_SCHEME, this._fsProvider));
    this._register(labelService.registerFormatter(AGENT_HOST_LABEL_FORMATTER));
    this._register(labelService.registerFormatter(agentHostLabelFormatter(LOCAL_AGENT_HOST_AUTHORITY, OS)));
  }
  registerAuthority(authority, connection) {
    return this._fsProvider.registerAuthority(authority, connection);
  }
  ensureSyncedCustomizationProvider() {
    if (!this._syncedCustomizationProviderRegistered) {
      this._syncedCustomizationProviderRegistered = true;
      const provider = this._register(new InMemoryFileSystemProvider());
      this._register(this._fileService.registerProvider(SYNCED_CUSTOMIZATION_SCHEME, provider));
    }
  }
};
AgentHostFileSystemService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ILabelService)
], AgentHostFileSystemService);
registerSingleton(IAgentHostFileSystemService, AgentHostFileSystemService, InstantiationType.Delayed);
export {
  IAgentHostFileSystemService,
  SYNCED_CUSTOMIZATION_SCHEME
};
