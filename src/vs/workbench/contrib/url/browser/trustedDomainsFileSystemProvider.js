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
import { Event } from "../../../../base/common/event.js";
import { parse } from "../../../../base/common/json.js";
import { FileSystemProviderCapabilities, FileType, IFileService } from "../../../../platform/files/common/files.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { readTrustedDomains, TRUSTED_DOMAINS_CONTENT_STORAGE_KEY, TRUSTED_DOMAINS_STORAGE_KEY } from "./trustedDomains.js";
import { assertReturnsDefined } from "../../../../base/common/types.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
const TRUSTED_DOMAINS_SCHEMA = "trustedDomains";
const TRUSTED_DOMAINS_STAT = {
  type: FileType.File,
  ctime: Date.now(),
  mtime: Date.now(),
  size: 0
};
const CONFIG_HELP_TEXT_PRE = `// Links matching one or more entries in the list below can be opened without link protection.
// The following examples show what entries can look like:
// - "https://microsoft.com": Matches this specific domain using https
// - "https://microsoft.com:8080": Matches this specific domain on this port using https
// - "https://microsoft.com:*": Matches this specific domain on any port using https
// - "https://microsoft.com/foo": Matches https://microsoft.com/foo and https://microsoft.com/foo/bar,
//   but not https://microsoft.com/foobar or https://microsoft.com/bar
// - "https://*.microsoft.com": Match all domains ending in "microsoft.com" using https
// - "microsoft.com": Match this specific domain using either http or https
// - "*.microsoft.com": Match all domains ending in "microsoft.com" using either http or https
// - "http://192.168.0.1: Matches this specific IP using http
// - "http://192.168.0.*: Matches all IP's with this prefix using http
// - "*": Match all domains using either http or https
//
`;
const CONFIG_HELP_TEXT_AFTER = `//
// You can use the "Manage Trusted Domains" command to open this file.
// Save this file to apply the trusted domains rules.
`;
const CONFIG_PLACEHOLDER_TEXT = `[
	// "https://microsoft.com"
]`;
function computeTrustedDomainContent(defaultTrustedDomains, trustedDomains, configuring) {
  let content = CONFIG_HELP_TEXT_PRE;
  if (defaultTrustedDomains.length > 0) {
    content += `// By default, VS Code trusts "localhost" as well as the following domains:
`;
    defaultTrustedDomains.forEach((d) => {
      content += `// - "${d}"
`;
    });
  } else {
    content += `// By default, VS Code trusts "localhost".
`;
  }
  content += CONFIG_HELP_TEXT_AFTER;
  content += configuring ? `
// Currently configuring trust for ${configuring}
` : "";
  if (trustedDomains.length === 0) {
    content += CONFIG_PLACEHOLDER_TEXT;
  } else {
    content += JSON.stringify(trustedDomains, null, 2);
  }
  return content;
}
let TrustedDomainsFileSystemProvider = class {
  constructor(fileService, storageService, instantiationService) {
    this.fileService = fileService;
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.capabilities = FileSystemProviderCapabilities.FileReadWrite;
    this.onDidChangeCapabilities = Event.None;
    this.onDidChangeFile = Event.None;
    this.fileService.registerProvider(TRUSTED_DOMAINS_SCHEMA, this);
  }
  static {
    this.ID = "workbench.contrib.trustedDomainsFileSystemProvider";
  }
  stat(resource) {
    return Promise.resolve(TRUSTED_DOMAINS_STAT);
  }
  async readFile(resource) {
    let trustedDomainsContent = this.storageService.get(
      TRUSTED_DOMAINS_CONTENT_STORAGE_KEY,
      StorageScope.APPLICATION
    );
    const configuring = resource.fragment;
    const { defaultTrustedDomains, trustedDomains } = await this.instantiationService.invokeFunction(readTrustedDomains);
    if (!trustedDomainsContent || trustedDomainsContent.indexOf(CONFIG_HELP_TEXT_PRE) === -1 || trustedDomainsContent.indexOf(CONFIG_HELP_TEXT_AFTER) === -1 || trustedDomainsContent.indexOf(configuring ?? "") === -1 || [...defaultTrustedDomains, ...trustedDomains].some((d) => !assertReturnsDefined(trustedDomainsContent).includes(d))) {
      trustedDomainsContent = computeTrustedDomainContent(defaultTrustedDomains, trustedDomains, configuring);
    }
    const buffer = VSBuffer.fromString(trustedDomainsContent).buffer;
    return buffer;
  }
  writeFile(resource, content, opts) {
    try {
      const trustedDomainsContent = VSBuffer.wrap(content).toString();
      const trustedDomains = parse(trustedDomainsContent);
      this.storageService.store(TRUSTED_DOMAINS_CONTENT_STORAGE_KEY, trustedDomainsContent, StorageScope.APPLICATION, StorageTarget.USER);
      this.storageService.store(
        TRUSTED_DOMAINS_STORAGE_KEY,
        JSON.stringify(trustedDomains) || "",
        StorageScope.APPLICATION,
        StorageTarget.USER
      );
    } catch (err) {
    }
    return Promise.resolve();
  }
  watch(resource, opts) {
    return {
      dispose() {
        return;
      }
    };
  }
  mkdir(resource) {
    return Promise.resolve(void 0);
  }
  readdir(resource) {
    return Promise.resolve(void 0);
  }
  delete(resource, opts) {
    return Promise.resolve(void 0);
  }
  rename(from, to, opts) {
    return Promise.resolve(void 0);
  }
};
TrustedDomainsFileSystemProvider = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IInstantiationService)
], TrustedDomainsFileSystemProvider);
export {
  TrustedDomainsFileSystemProvider
};
