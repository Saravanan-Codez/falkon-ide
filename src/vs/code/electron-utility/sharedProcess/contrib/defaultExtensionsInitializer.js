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
import { dirname, join } from "../../../../base/common/path.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isWindows } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { INativeServerExtensionManagementService } from "../../../../platform/extensionManagement/node/extensionManagementService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { getErrorMessage } from "../../../../base/common/errors.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
const defaultExtensionsInitStatusKey = "initializing-default-extensions";
let DefaultExtensionsInitializer = class extends Disposable {
  constructor(environmentService, extensionManagementService, storageService, fileService, logService, productService) {
    super();
    this.environmentService = environmentService;
    this.extensionManagementService = extensionManagementService;
    this.fileService = fileService;
    this.logService = logService;
    this.productService = productService;
    if (isWindows && storageService.getBoolean(defaultExtensionsInitStatusKey, StorageScope.APPLICATION, true)) {
      storageService.store(defaultExtensionsInitStatusKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
      this.initializeDefaultExtensions().then(() => storageService.store(defaultExtensionsInitStatusKey, false, StorageScope.APPLICATION, StorageTarget.MACHINE));
    }
  }
  async initializeDefaultExtensions() {
    const extensionsLocation = this.getDefaultExtensionVSIXsLocation();
    let stat;
    try {
      stat = await this.fileService.resolve(extensionsLocation);
      if (!stat.children) {
        this.logService.debug("There are no default extensions to initialize", extensionsLocation.toString());
        return;
      }
    } catch (error) {
      if (toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND) {
        this.logService.debug("There are no default extensions to initialize", extensionsLocation.toString());
        return;
      }
      this.logService.error("Error initializing extensions", error);
      return;
    }
    const vsixs = stat.children.filter((child) => child.name.toLowerCase().endsWith(".vsix"));
    if (vsixs.length === 0) {
      this.logService.debug("There are no default extensions to initialize", extensionsLocation.toString());
      return;
    }
    this.logService.info("Initializing default extensions", extensionsLocation.toString());
    await Promise.all(vsixs.map(async (vsix) => {
      this.logService.info("Installing default extension", vsix.resource.toString());
      try {
        await this.extensionManagementService.install(vsix.resource, { donotIncludePackAndDependencies: true, keepExisting: false });
        this.logService.info("Default extension installed", vsix.resource.toString());
      } catch (error) {
        this.logService.error("Error installing default extension", vsix.resource.toString(), getErrorMessage(error));
      }
    }));
    this.logService.info("Default extensions initialized", extensionsLocation.toString());
  }
  getDefaultExtensionVSIXsLocation() {
    if (this.productService.win32VersionedUpdate) {
      return URI.file(join(dirname(dirname(dirname(this.environmentService.appRoot))), "bootstrap", "extensions"));
    } else {
      return URI.file(join(dirname(dirname(this.environmentService.appRoot)), "bootstrap", "extensions"));
    }
  }
};
DefaultExtensionsInitializer = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, INativeServerExtensionManagementService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IProductService)
], DefaultExtensionsInitializer);
export {
  DefaultExtensionsInitializer
};
