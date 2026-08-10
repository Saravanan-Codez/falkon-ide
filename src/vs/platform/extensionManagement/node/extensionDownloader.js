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
import { Promises } from "../../../base/common/async.js";
import { getErrorMessage } from "../../../base/common/errors.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { joinPath } from "../../../base/common/resources.js";
import * as semver from "../../../base/common/semver/semver.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { Promises as FSPromises } from "../../../base/node/pfs.js";
import { buffer, CorruptZipMessage } from "../../../base/node/zip.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { toExtensionManagementError } from "../common/abstractExtensionManagementService.js";
import { ExtensionManagementError, ExtensionManagementErrorCode, ExtensionSignatureVerificationCode, IExtensionGalleryService } from "../common/extensionManagement.js";
import { ExtensionKey, groupByExtension } from "../common/extensionManagementUtil.js";
import { fromExtractError } from "./extensionManagementUtil.js";
import { IExtensionSignatureVerificationService } from "./extensionSignatureVerificationService.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
let ExtensionsDownloader = class extends Disposable {
  constructor(environmentService, fileService, extensionGalleryService, extensionSignatureVerificationService, telemetryService, uriIdentityService, logService) {
    super();
    this.fileService = fileService;
    this.extensionGalleryService = extensionGalleryService;
    this.extensionSignatureVerificationService = extensionSignatureVerificationService;
    this.telemetryService = telemetryService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.extensionsDownloadDir = environmentService.extensionsDownloadLocation;
    this.extensionsTrashDir = uriIdentityService.extUri.joinPath(environmentService.extensionsDownloadLocation, `.trash`);
    this.cache = 20;
    this.cleanUpPromise = this.cleanUp();
  }
  static {
    this.SignatureArchiveExtension = ".sigzip";
  }
  async download(extension, operation, verifySignature, clientTargetPlatform) {
    await this.cleanUpPromise;
    const location = await this.downloadVSIX(extension, operation);
    if (!verifySignature) {
      return { location, verificationStatus: void 0 };
    }
    if (!extension.isSigned) {
      return { location, verificationStatus: ExtensionSignatureVerificationCode.NotSigned };
    }
    let signatureArchiveLocation;
    try {
      signatureArchiveLocation = await this.downloadSignatureArchive(extension);
      const verificationStatus = (await this.extensionSignatureVerificationService.verify(extension.identifier.id, extension.version, location.fsPath, signatureArchiveLocation.fsPath, clientTargetPlatform))?.code;
      if (verificationStatus === ExtensionSignatureVerificationCode.PackageIsInvalidZip || verificationStatus === ExtensionSignatureVerificationCode.SignatureArchiveIsInvalidZip) {
        try {
          await this.delete(location);
        } catch (error) {
          this.logService.error(error);
        }
        throw new ExtensionManagementError(CorruptZipMessage, ExtensionManagementErrorCode.CorruptZip);
      }
      return { location, verificationStatus };
    } catch (error) {
      try {
        await this.delete(location);
      } catch (error2) {
        this.logService.error(error2);
      }
      throw error;
    } finally {
      if (signatureArchiveLocation) {
        try {
          await this.delete(signatureArchiveLocation);
        } catch (error) {
          this.logService.error(error);
        }
      }
    }
  }
  async downloadVSIX(extension, operation) {
    try {
      const location = joinPath(this.extensionsDownloadDir, this.getName(extension));
      const attempts = await this.doDownload(extension, "vsix", async () => {
        await this.downloadFile(extension, location, (location2) => this.extensionGalleryService.download(extension, location2, operation));
        try {
          await this.validate(location.fsPath, "extension/package.json");
        } catch (error) {
          try {
            await this.fileService.del(location);
          } catch (e) {
            this.logService.warn(`Error while deleting: ${location.path}`, getErrorMessage(e));
          }
          throw error;
        }
      }, 2);
      if (attempts > 1) {
        this.telemetryService.publicLog2("extensiongallery:downloadvsix:retry", {
          extensionId: extension.identifier.id,
          attempts
        });
      }
      return location;
    } catch (e) {
      throw toExtensionManagementError(e, ExtensionManagementErrorCode.Download);
    }
  }
  async downloadSignatureArchive(extension) {
    try {
      const location = joinPath(this.extensionsDownloadDir, `${this.getName(extension)}${ExtensionsDownloader.SignatureArchiveExtension}`);
      const attempts = await this.doDownload(extension, "sigzip", async () => {
        await this.extensionGalleryService.downloadSignatureArchive(extension, location);
        try {
          await this.validate(location.fsPath, ".signature.p7s");
        } catch (error) {
          try {
            await this.fileService.del(location);
          } catch (e) {
            this.logService.warn(`Error while deleting: ${location.path}`, getErrorMessage(e));
          }
          throw error;
        }
      }, 2);
      if (attempts > 1) {
        this.telemetryService.publicLog2("extensiongallery:downloadsigzip:retry", {
          extensionId: extension.identifier.id,
          attempts
        });
      }
      return location;
    } catch (e) {
      throw toExtensionManagementError(e, ExtensionManagementErrorCode.DownloadSignature);
    }
  }
  async downloadFile(extension, location, downloadFn) {
    if (await this.fileService.exists(location)) {
      return;
    }
    if (location.scheme !== Schemas.file) {
      await downloadFn(location);
      return;
    }
    const tempLocation = joinPath(this.extensionsDownloadDir, `.${generateUuid()}`);
    try {
      await downloadFn(tempLocation);
    } catch (error) {
      try {
        await this.fileService.del(tempLocation);
      } catch (e) {
      }
      throw error;
    }
    try {
      await FSPromises.rename(
        tempLocation.fsPath,
        location.fsPath,
        2 * 60 * 1e3
        /* Retry for 2 minutes */
      );
    } catch (error) {
      try {
        await this.fileService.del(tempLocation);
      } catch (e) {
      }
      let exists = false;
      try {
        exists = await this.fileService.exists(location);
      } catch (e) {
      }
      if (exists) {
        this.logService.info(`Rename failed because the file was downloaded by another source. So ignoring renaming.`, extension.identifier.id, location.path);
      } else {
        this.logService.info(`Rename failed because of ${getErrorMessage(error)}. Deleted the file from downloaded location`, tempLocation.path);
        throw error;
      }
    }
  }
  async doDownload(extension, name, downloadFn, retries) {
    let attempts = 1;
    while (true) {
      try {
        await downloadFn();
        return attempts;
      } catch (e) {
        if (attempts++ > retries) {
          throw e;
        }
        this.logService.warn(`Failed downloading ${name}. ${getErrorMessage(e)}. Retry again...`, extension.identifier.id);
      }
    }
  }
  async validate(zipPath, filePath) {
    try {
      await buffer(zipPath, filePath);
    } catch (e) {
      throw fromExtractError(e);
    }
  }
  async delete(location) {
    await this.cleanUpPromise;
    const trashRelativePath = this.uriIdentityService.extUri.relativePath(this.extensionsDownloadDir, location);
    if (trashRelativePath) {
      await this.fileService.move(location, this.uriIdentityService.extUri.joinPath(this.extensionsTrashDir, trashRelativePath), true);
    } else {
      await this.fileService.del(location);
    }
  }
  async cleanUp() {
    try {
      if (!await this.fileService.exists(this.extensionsDownloadDir)) {
        this.logService.trace("Extension VSIX downloads cache dir does not exist");
        return;
      }
      try {
        await this.fileService.del(this.extensionsTrashDir, { recursive: true });
      } catch (error) {
        if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
          this.logService.error(error);
        }
      }
      const folderStat = await this.fileService.resolve(this.extensionsDownloadDir, { resolveMetadata: true });
      if (folderStat.children) {
        const toDelete = [];
        const vsixs = [];
        const signatureArchives = [];
        for (const stat of folderStat.children) {
          if (stat.name.endsWith(ExtensionsDownloader.SignatureArchiveExtension)) {
            signatureArchives.push(stat.resource);
          } else {
            const extension = ExtensionKey.parse(stat.name);
            if (extension) {
              vsixs.push([extension, stat]);
            }
          }
        }
        const byExtension = groupByExtension(vsixs, ([extension]) => extension);
        const distinct = [];
        for (const p of byExtension) {
          p.sort((a, b) => semver.rcompare(a[0].version, b[0].version));
          toDelete.push(...p.slice(1).map((e) => e[1].resource));
          distinct.push(p[0][1]);
        }
        distinct.sort((a, b) => a.mtime - b.mtime);
        toDelete.push(...distinct.slice(0, Math.max(0, distinct.length - this.cache)).map((s) => s.resource));
        toDelete.push(...signatureArchives);
        await Promises.settled(toDelete.map((resource) => {
          this.logService.trace("Deleting from cache", resource.path);
          return this.fileService.del(resource);
        }));
      }
    } catch (e) {
      this.logService.error(e);
    }
  }
  getName(extension) {
    return ExtensionKey.create(extension).toString().toLowerCase();
  }
};
ExtensionsDownloader = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IExtensionGalleryService),
  __decorateParam(3, IExtensionSignatureVerificationService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, ILogService)
], ExtensionsDownloader);
export {
  ExtensionsDownloader
};
