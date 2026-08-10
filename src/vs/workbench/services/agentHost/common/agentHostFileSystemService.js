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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { OS } from "../../../../base/common/platform.js";
import { AgentHostFileSystemProvider } from "../../../../platform/agentHost/common/agentHostFileSystemProvider.js";
import { SYNCED_CUSTOMIZATION_SCHEME } from "../../../../platform/agentHost/common/agentHostFileSystemService.js";
import { AGENT_HOST_LABEL_FORMATTER, AGENT_HOST_SCHEME, agentHostLabelFormatter, LOCAL_AGENT_HOST_AUTHORITY } from "../../../../platform/agentHost/common/agentHostUri.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InMemoryFileSystemProvider } from "../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
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
