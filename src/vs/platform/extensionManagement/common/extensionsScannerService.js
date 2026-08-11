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
import { coalesce } from "../../../base/common/arrays.js";
import { ThrottledDelayer } from "../../../base/common/async.js";
import * as objects from "../../../base/common/objects.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { getErrorMessage } from "../../../base/common/errors.js";
import { getNodeType, parse } from "../../../base/common/json.js";
import { getParseErrorMessage } from "../../../base/common/jsonErrorMessages.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { FileAccess, Schemas } from "../../../base/common/network.js";
import * as path from "../../../base/common/path.js";
import * as platform from "../../../base/common/platform.js";
import { basename, isEqual, joinPath } from "../../../base/common/resources.js";
import * as semver from "../../../base/common/semver/semver.js";
import Severity from "../../../base/common/severity.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { areSameExtensions, computeTargetPlatform, getExtensionId, getGalleryExtensionId } from "./extensionManagementUtil.js";
import { ExtensionType, ExtensionIdentifier, TargetPlatform, UNDEFINED_PUBLISHER, BUILTIN_MANIFEST_CACHE_FILE, USER_MANIFEST_CACHE_FILE, ExtensionIdentifierMap, parseEnabledApiProposalNames } from "../../extensions/common/extensions.js";
import { validateExtensionManifest } from "../../extensions/common/extensionValidator.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { Emitter } from "../../../base/common/event.js";
import { revive } from "../../../base/common/marshalling.js";
import { ExtensionsProfileScanningError, ExtensionsProfileScanningErrorCode, IExtensionsProfileScannerService } from "./extensionsProfileScannerService.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { localizeManifest } from "./extensionNls.js";
var Translations;
((Translations2) => {
  function equals(a, b) {
    if (a === b) {
      return true;
    }
    const aKeys = Object.keys(a);
    const bKeys = /* @__PURE__ */ new Set();
    for (const key of Object.keys(b)) {
      bKeys.add(key);
    }
    if (aKeys.length !== bKeys.size) {
      return false;
    }
    for (const key of aKeys) {
      if (a[key] !== b[key]) {
        return false;
      }
      bKeys.delete(key);
    }
    return bKeys.size === 0;
  }
  Translations2.equals = equals;
})(Translations || (Translations = {}));
function getProductBuiltInExtensionsEnabledWithAutoUpdates(productService, environmentService) {
  const result = /* @__PURE__ */ new Set();
  for (const id of productService.builtInExtensionsEnabledWithAutoUpdates) {
    const toLowerCaseId = id.toLowerCase();
    if (environmentService.skipBuiltinExtensions?.some((skipId) => skipId.toLowerCase() === toLowerCaseId)) {
      continue;
    }
    result.add(toLowerCaseId);
  }
  return result;
}
const IExtensionsScannerService = createDecorator("IExtensionsScannerService");
let AbstractExtensionsScannerService = class extends Disposable {
  constructor(systemExtensionsLocation, userExtensionsLocation, extensionsControlLocation, currentProfile, userDataProfilesService, extensionsProfileScannerService, fileService, logService, environmentService, productService, uriIdentityService, instantiationService) {
    super();
    this.systemExtensionsLocation = systemExtensionsLocation;
    this.userExtensionsLocation = userExtensionsLocation;
    this.extensionsControlLocation = extensionsControlLocation;
    this.userDataProfilesService = userDataProfilesService;
    this.extensionsProfileScannerService = extensionsProfileScannerService;
    this.fileService = fileService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.productService = productService;
    this.uriIdentityService = uriIdentityService;
    this.instantiationService = instantiationService;
    this._onDidChangeCache = this._register(new Emitter());
    this.onDidChangeCache = this._onDidChangeCache.event;
    this.initializeDefaultProfileExtensionsPromise = void 0;
    this.systemExtensionsCachedScanner = this._register(this.instantiationService.createInstance(CachedExtensionsScanner, currentProfile));
    this.userExtensionsCachedScanner = this._register(this.instantiationService.createInstance(CachedExtensionsScanner, currentProfile));
    this.extensionsScanner = this._register(this.instantiationService.createInstance(ExtensionsScanner));
    this._register(this.systemExtensionsCachedScanner.onDidChangeCache(() => this._onDidChangeCache.fire(ExtensionType.System)));
    this._register(this.userExtensionsCachedScanner.onDidChangeCache(() => this._onDidChangeCache.fire(ExtensionType.User)));
  }
  getTargetPlatform() {
    if (!this._targetPlatformPromise) {
      this._targetPlatformPromise = computeTargetPlatform(this.fileService, this.logService);
    }
    return this._targetPlatformPromise;
  }
  async scanAllExtensions(systemScanOptions, userScanOptions) {
    const [system, user] = await Promise.all([
      this.scanSystemExtensions(systemScanOptions),
      this.scanUserExtensions(userScanOptions)
    ]);
    return this.dedupExtensions(system, user, [], await this.getTargetPlatform(), true);
  }
  async scanSystemExtensions(scanOptions) {
    const promises = [];
    promises.push(this.scanDefaultSystemExtensions(scanOptions.language));
    promises.push(this.scanDevSystemExtensions(scanOptions.language, !!scanOptions.checkControlFile));
    const [defaultSystemExtensions, devSystemExtensions] = await Promise.all(promises);
    let allSystemExtensions = [...defaultSystemExtensions, ...devSystemExtensions];
    if (this.environmentService.skipBuiltinExtensions?.length) {
      const skipSet = new Set(this.environmentService.skipBuiltinExtensions.map((id) => id.toLowerCase()));
      allSystemExtensions = allSystemExtensions.filter((ext) => !skipSet.has(ext.identifier.id.toLowerCase()));
    }
    return this.applyScanOptions(allSystemExtensions, ExtensionType.System, { pickLatest: false });
  }
  async scanUserExtensions(scanOptions) {
    this.logService.trace("Started scanning user extensions", scanOptions.profileLocation);
    const profileScanOptions = this.uriIdentityService.extUri.isEqual(scanOptions.profileLocation, this.userDataProfilesService.defaultProfile.extensionsResource) ? { bailOutWhenFileNotFound: true } : void 0;
    const extensionsScannerInput = await this.createExtensionScannerInput(scanOptions.profileLocation, true, ExtensionType.User, scanOptions.language, true, profileScanOptions, scanOptions.productVersion ?? this.getProductVersion());
    const extensionsScanner = scanOptions.useCache && !extensionsScannerInput.devMode ? this.userExtensionsCachedScanner : this.extensionsScanner;
    let extensions;
    try {
      extensions = await extensionsScanner.scanExtensions(extensionsScannerInput);
    } catch (error) {
      if (error instanceof ExtensionsProfileScanningError && error.code === ExtensionsProfileScanningErrorCode.ERROR_PROFILE_NOT_FOUND) {
        await this.doInitializeDefaultProfileExtensions();
        extensions = await extensionsScanner.scanExtensions(extensionsScannerInput);
      } else {
        throw error;
      }
    }
    extensions = await this.applyScanOptions(extensions, ExtensionType.User, { includeInvalid: scanOptions.includeInvalid, pickLatest: true });
    this.logService.trace("Scanned user extensions:", extensions.length);
    return extensions;
  }
  async scanAllUserExtensions(scanOptions = { includeInvalid: true, includeAllVersions: true }) {
    const extensionsScannerInput = await this.createExtensionScannerInput(this.userExtensionsLocation, false, ExtensionType.User, void 0, true, void 0, this.getProductVersion());
    const extensions = await this.extensionsScanner.scanExtensions(extensionsScannerInput);
    return this.applyScanOptions(extensions, ExtensionType.User, { includeAllVersions: scanOptions.includeAllVersions, includeInvalid: scanOptions.includeInvalid });
  }
  async scanExtensionsUnderDevelopment(existingExtensions, scanOptions) {
    if (this.environmentService.isExtensionDevelopment && this.environmentService.extensionDevelopmentLocationURI) {
      const extensions = (await Promise.all(this.environmentService.extensionDevelopmentLocationURI.filter((extLoc) => extLoc.scheme === Schemas.file).map(async (extensionDevelopmentLocationURI) => {
        const input = await this.createExtensionScannerInput(extensionDevelopmentLocationURI, false, ExtensionType.User, scanOptions.language, false, void 0, this.getProductVersion());
        const extensions2 = await this.extensionsScanner.scanOneOrMultipleExtensions(input);
        return extensions2.map((extension) => {
          extension.type = existingExtensions.find((e) => areSameExtensions(e.identifier, extension.identifier))?.type ?? extension.type;
          return this.extensionsScanner.validate(extension, input);
        });
      }))).flat();
      return this.applyScanOptions(extensions, "development", { includeInvalid: scanOptions.includeInvalid, pickLatest: true });
    }
    return [];
  }
  async scanExistingExtension(extensionLocation, extensionType, scanOptions) {
    const extensionsScannerInput = await this.createExtensionScannerInput(extensionLocation, false, extensionType, scanOptions.language, true, void 0, this.getProductVersion());
    const extension = await this.extensionsScanner.scanExtension(extensionsScannerInput);
    if (!extension) {
      return null;
    }
    if (!scanOptions.includeInvalid && !extension.isValid) {
      return null;
    }
    return extension;
  }
  async scanOneOrMultipleExtensions(extensionLocation, extensionType, scanOptions) {
    const extensionsScannerInput = await this.createExtensionScannerInput(extensionLocation, false, extensionType, scanOptions.language, true, void 0, this.getProductVersion());
    const extensions = await this.extensionsScanner.scanOneOrMultipleExtensions(extensionsScannerInput);
    return this.applyScanOptions(extensions, extensionType, { includeInvalid: scanOptions.includeInvalid, pickLatest: true });
  }
  async scanMultipleExtensions(extensionLocations, extensionType, scanOptions) {
    const extensions = [];
    await Promise.all(extensionLocations.map(async (extensionLocation) => {
      const scannedExtensions = await this.scanOneOrMultipleExtensions(extensionLocation, extensionType, scanOptions);
      extensions.push(...scannedExtensions);
    }));
    return this.applyScanOptions(extensions, extensionType, { includeInvalid: scanOptions.includeInvalid, pickLatest: true });
  }
  async updateManifestMetadata(extensionLocation, metaData) {
    const manifestLocation = joinPath(extensionLocation, "package.json");
    const content = (await this.fileService.readFile(manifestLocation)).value.toString();
    const manifest = JSON.parse(content);
    manifest.__metadata = { ...manifest.__metadata, ...metaData };
    await this.fileService.writeFile(joinPath(extensionLocation, "package.json"), VSBuffer.fromString(JSON.stringify(manifest, null, "	")));
  }
  async initializeDefaultProfileExtensions() {
    try {
      await this.extensionsProfileScannerService.scanProfileExtensions(this.userDataProfilesService.defaultProfile.extensionsResource, { bailOutWhenFileNotFound: true });
    } catch (error) {
      if (error instanceof ExtensionsProfileScanningError && error.code === ExtensionsProfileScanningErrorCode.ERROR_PROFILE_NOT_FOUND) {
        await this.doInitializeDefaultProfileExtensions();
      } else {
        throw error;
      }
    }
  }
  async doInitializeDefaultProfileExtensions() {
    if (!this.initializeDefaultProfileExtensionsPromise) {
      this.initializeDefaultProfileExtensionsPromise = (async () => {
        try {
          this.logService.info("Started initializing default profile extensions in extensions installation folder.", this.userExtensionsLocation.toString());
          const userExtensions = await this.scanAllUserExtensions({ includeInvalid: true });
          if (userExtensions.length) {
            await this.extensionsProfileScannerService.addExtensionsToProfile(userExtensions.map((e) => [e, e.metadata]), this.userDataProfilesService.defaultProfile.extensionsResource);
          } else {
            try {
              await this.fileService.createFile(this.userDataProfilesService.defaultProfile.extensionsResource, VSBuffer.fromString(JSON.stringify([])));
            } catch (error) {
              if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
                this.logService.warn("Failed to create default profile extensions manifest in extensions installation folder.", this.userExtensionsLocation.toString(), getErrorMessage(error));
              }
            }
          }
          this.logService.info("Completed initializing default profile extensions in extensions installation folder.", this.userExtensionsLocation.toString());
        } catch (error) {
          this.logService.error(error);
        } finally {
          this.initializeDefaultProfileExtensionsPromise = void 0;
        }
      })();
    }
    return this.initializeDefaultProfileExtensionsPromise;
  }
  async applyScanOptions(extensions, type, scanOptions = {}) {
    if (!scanOptions.includeAllVersions) {
      extensions = this.dedupExtensions(type === ExtensionType.System ? extensions : void 0, type === ExtensionType.User ? extensions : void 0, type === "development" ? extensions : void 0, await this.getTargetPlatform(), !!scanOptions.pickLatest);
    }
    if (!scanOptions.includeInvalid) {
      extensions = extensions.filter((extension) => extension.isValid);
    }
    return extensions.sort((a, b) => {
      const aLastSegment = path.basename(a.location.fsPath);
      const bLastSegment = path.basename(b.location.fsPath);
      if (aLastSegment < bLastSegment) {
        return -1;
      }
      if (aLastSegment > bLastSegment) {
        return 1;
      }
      return 0;
    });
  }
  dedupExtensions(system, user, development, targetPlatform, pickLatest) {
    const pick = (existing, extension, isDevelopment) => {
      if (!isDevelopment && !(existing.isBuiltin || extension.isBuiltin)) {
        if (existing.metadata?.isApplicationScoped && !extension.metadata?.isApplicationScoped) {
          return false;
        }
        if (!existing.metadata?.isApplicationScoped && extension.metadata?.isApplicationScoped) {
          return true;
        }
      }
      if (existing.isValid && !extension.isValid) {
        return false;
      }
      if (existing.isValid === extension.isValid) {
        if (pickLatest && semver.gt(existing.manifest.version, extension.manifest.version)) {
          this.logService.debug(`Skipping extension ${extension.location.path} with lower version ${extension.manifest.version} in favour of ${existing.location.path} with version ${existing.manifest.version}`);
          return false;
        }
        if (semver.eq(existing.manifest.version, extension.manifest.version)) {
          if (existing.type === ExtensionType.System) {
            this.logService.debug(`Skipping extension ${extension.location.path} in favour of system extension ${existing.location.path} with same version`);
            return false;
          }
          if (existing.targetPlatform === targetPlatform) {
            this.logService.debug(`Skipping extension ${extension.location.path} from different target platform ${extension.targetPlatform}`);
            return false;
          }
        }
      }
      if (isDevelopment) {
        this.logService.warn(`Overwriting user extension ${existing.location.path} with ${extension.location.path}.`);
      } else {
        this.logService.debug(`Overwriting user extension ${existing.location.path} with ${extension.location.path}.`);
      }
      return true;
    };
    const result = new ExtensionIdentifierMap();
    system?.forEach((extension) => {
      const existing = result.get(extension.identifier.id);
      if (!existing || pick(existing, extension, false)) {
        result.set(extension.identifier.id, extension);
      }
    });
    const productBuiltInExtensionsEnabledWithAutoUpdates = getProductBuiltInExtensionsEnabledWithAutoUpdates(this.productService, this.environmentService);
    user?.forEach((extension) => {
      const existing = result.get(extension.identifier.id);
      if (!existing && system && extension.type === ExtensionType.System) {
        this.logService.debug(`Skipping obsolete system extension ${extension.location.path}.`);
        return;
      }
      if (productBuiltInExtensionsEnabledWithAutoUpdates.has(extension.identifier.id.toLowerCase()) && !extension.forceAutoUpdate) {
        this.logService.info(`Skipping user installed builtin extension ${extension.identifier.id} with version ${extension.manifest.version} because it is not allowed to in the current product quality ${this.productService.quality}`);
        return;
      }
      if (!existing || pick(existing, extension, false)) {
        result.set(extension.identifier.id, extension);
      }
    });
    development?.forEach((extension) => {
      const existing = result.get(extension.identifier.id);
      if (!existing || pick(existing, extension, true)) {
        result.set(extension.identifier.id, extension);
      }
      result.set(extension.identifier.id, extension);
    });
    return [...result.values()];
  }
  async scanDefaultSystemExtensions(language) {
    this.logService.trace("Started scanning system extensions");
    const extensionsScannerInput = await this.createExtensionScannerInput(this.systemExtensionsLocation, false, ExtensionType.System, language, true, void 0, this.getProductVersion());
    const extensionsScanner = extensionsScannerInput.devMode ? this.extensionsScanner : this.systemExtensionsCachedScanner;
    const result = await extensionsScanner.scanExtensions(extensionsScannerInput);
    this.logService.trace("Scanned system extensions:", result.length);
    return result;
  }
  async scanDevSystemExtensions(language, checkControlFile) {
    const devSystemExtensionsList = this.environmentService.isBuilt ? [] : this.productService.builtInExtensions;
    if (!devSystemExtensionsList?.length) {
      return [];
    }
    this.logService.trace("Started scanning dev system extensions");
    const builtinExtensionControl = checkControlFile ? await this.getBuiltInExtensionControl() : {};
    const devSystemExtensionsLocations = [];
    const devSystemExtensionsLocation = URI.file(path.normalize(path.join(FileAccess.asFileUri("").fsPath, "..", ".build", "builtInExtensions")));
    for (const extension of devSystemExtensionsList) {
      const controlState = builtinExtensionControl[extension.name] || "marketplace";
      switch (controlState) {
        case "disabled":
          break;
        case "marketplace":
          devSystemExtensionsLocations.push(joinPath(devSystemExtensionsLocation, extension.name));
          break;
        default:
          devSystemExtensionsLocations.push(URI.file(controlState));
          break;
      }
    }
    const result = await Promise.all(devSystemExtensionsLocations.map(async (location) => this.extensionsScanner.scanExtension(await this.createExtensionScannerInput(location, false, ExtensionType.System, language, true, void 0, this.getProductVersion()))));
    this.logService.trace("Scanned dev system extensions:", result.length);
    return coalesce(result);
  }
  async getBuiltInExtensionControl() {
    try {
      const content = await this.fileService.readFile(this.extensionsControlLocation);
      return JSON.parse(content.value.toString());
    } catch (error) {
      return {};
    }
  }
  async createExtensionScannerInput(location, profile, type, language, validate, profileScanOptions, productVersion) {
    const translations = await this.getTranslations(language ?? platform.language);
    const mtime = await this.getMtime(location);
    const applicationExtensionsLocation = profile && !this.uriIdentityService.extUri.isEqual(location, this.userDataProfilesService.defaultProfile.extensionsResource) ? this.userDataProfilesService.defaultProfile.extensionsResource : void 0;
    const applicationExtensionsLocationMtime = applicationExtensionsLocation ? await this.getMtime(applicationExtensionsLocation) : void 0;
    return new ExtensionScannerInput(
      location,
      mtime,
      applicationExtensionsLocation,
      applicationExtensionsLocationMtime,
      profile,
      profileScanOptions,
      type,
      validate,
      productVersion.version,
      productVersion.date,
      this.productService.commit,
      !this.environmentService.isBuilt,
      language,
      translations
    );
  }
  async getMtime(location) {
    try {
      const stat = await this.fileService.stat(location);
      if (typeof stat.mtime === "number") {
        return stat.mtime;
      }
    } catch (err) {
    }
    return void 0;
  }
  getProductVersion() {
    return {
      version: this.productService.version,
      date: this.productService.date
    };
  }
};
AbstractExtensionsScannerService = __decorateClass([
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IExtensionsProfileScannerService),
  __decorateParam(6, IFileService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IEnvironmentService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IUriIdentityService),
  __decorateParam(11, IInstantiationService)
], AbstractExtensionsScannerService);
class ExtensionScannerInput {
  constructor(location, mtime, applicationExtensionslocation, applicationExtensionslocationMtime, profile, profileScanOptions, type, validate, productVersion, productDate, productCommit, devMode, language, translations) {
    this.location = location;
    this.mtime = mtime;
    this.applicationExtensionslocation = applicationExtensionslocation;
    this.applicationExtensionslocationMtime = applicationExtensionslocationMtime;
    this.profile = profile;
    this.profileScanOptions = profileScanOptions;
    this.type = type;
    this.validate = validate;
    this.productVersion = productVersion;
    this.productDate = productDate;
    this.productCommit = productCommit;
    this.devMode = devMode;
    this.language = language;
    this.translations = translations;
  }
  static createNlsConfiguration(input) {
    return {
      language: input.language,
      pseudo: input.language === "pseudo",
      devMode: input.devMode,
      translations: input.translations
    };
  }
  static equals(a, b) {
    return isEqual(a.location, b.location) && a.mtime === b.mtime && isEqual(a.applicationExtensionslocation, b.applicationExtensionslocation) && a.applicationExtensionslocationMtime === b.applicationExtensionslocationMtime && a.profile === b.profile && objects.equals(a.profileScanOptions, b.profileScanOptions) && a.type === b.type && a.validate === b.validate && a.productVersion === b.productVersion && a.productDate === b.productDate && a.productCommit === b.productCommit && a.devMode === b.devMode && a.language === b.language && Translations.equals(a.translations, b.translations);
  }
}
let ExtensionsScanner = class extends Disposable {
  constructor(extensionsProfileScannerService, uriIdentityService, fileService, productService, environmentService, logService) {
    super();
    this.extensionsProfileScannerService = extensionsProfileScannerService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.logService = logService;
    this.productQuality = productService.quality;
    this.productBuiltInExtensionsEnabledWithAutoUpdates = getProductBuiltInExtensionsEnabledWithAutoUpdates(productService, environmentService);
  }
  async scanExtensions(input) {
    return input.profile ? this.scanExtensionsFromProfile(input) : this.scanExtensionsFromLocation(input);
  }
  async scanExtensionsFromLocation(input) {
    const stat = await this.fileService.resolve(input.location);
    if (!stat.children?.length) {
      return [];
    }
    const extensions = await Promise.all(
      stat.children.map(async (c) => {
        if (!c.isDirectory) {
          return null;
        }
        if (input.type === ExtensionType.User && basename(c.resource).indexOf(".") === 0) {
          return null;
        }
        const extensionScannerInput = new ExtensionScannerInput(c.resource, input.mtime, input.applicationExtensionslocation, input.applicationExtensionslocationMtime, input.profile, input.profileScanOptions, input.type, input.validate, input.productVersion, input.productDate, input.productCommit, input.devMode, input.language, input.translations);
        return this.scanExtension(extensionScannerInput);
      })
    );
    return coalesce(extensions).sort((a, b) => a.location.path < b.location.path ? -1 : 1);
  }
  async scanExtensionsFromProfile(input) {
    let profileExtensions = await this.scanExtensionsFromProfileResource(input.location, () => true, input);
    if (input.applicationExtensionslocation && !this.uriIdentityService.extUri.isEqual(input.location, input.applicationExtensionslocation)) {
      profileExtensions = profileExtensions.filter((e) => !e.metadata?.isApplicationScoped);
      const applicationExtensions = await this.scanExtensionsFromProfileResource(input.applicationExtensionslocation, (e) => !!e.metadata?.isBuiltin || !!e.metadata?.isApplicationScoped, input);
      profileExtensions.push(...applicationExtensions);
    }
    return profileExtensions;
  }
  async scanExtensionsFromProfileResource(profileResource, filter, input) {
    const scannedProfileExtensions = await this.extensionsProfileScannerService.scanProfileExtensions(profileResource, input.profileScanOptions);
    if (!scannedProfileExtensions.length) {
      return [];
    }
    const extensions = await Promise.all(
      scannedProfileExtensions.map(async (extensionInfo) => {
        if (filter(extensionInfo)) {
          const extensionScannerInput = new ExtensionScannerInput(extensionInfo.location, input.mtime, input.applicationExtensionslocation, input.applicationExtensionslocationMtime, input.profile, input.profileScanOptions, input.type, input.validate, input.productVersion, input.productDate, input.productCommit, input.devMode, input.language, input.translations);
          return this.scanExtension(extensionScannerInput, extensionInfo);
        }
        return null;
      })
    );
    return coalesce(extensions);
  }
  async scanOneOrMultipleExtensions(input) {
    try {
      if (await this.fileService.exists(joinPath(input.location, "package.json"))) {
        const extension = await this.scanExtension(input);
        return extension ? [extension] : [];
      } else {
        return await this.scanExtensions(input);
      }
    } catch (error) {
      this.logService.error(`Error scanning extensions at ${input.location.path}:`, getErrorMessage(error));
      return [];
    }
  }
  async scanExtension(input, scannedProfileExtension) {
    const validations = [];
    let isValid = true;
    let manifest;
    try {
      manifest = await this.scanExtensionManifest(input.location);
    } catch (e) {
      if (scannedProfileExtension) {
        validations.push([Severity.Error, getErrorMessage(e)]);
        isValid = false;
        const [publisher, name] = scannedProfileExtension.identifier.id.split(".");
        manifest = {
          name,
          publisher,
          version: scannedProfileExtension.version,
          engines: { vscode: "" }
        };
      } else {
        if (input.type !== ExtensionType.System) {
          this.logService.error(e);
        }
        return null;
      }
    }
    if (!manifest.publisher) {
      manifest.publisher = UNDEFINED_PUBLISHER;
    }
    let metadata;
    if (scannedProfileExtension) {
      metadata = {
        ...scannedProfileExtension.metadata,
        size: manifest.__metadata?.size
      };
    } else if (manifest.__metadata) {
      metadata = {
        installedTimestamp: manifest.__metadata.installedTimestamp,
        size: manifest.__metadata.size,
        targetPlatform: manifest.__metadata.targetPlatform
      };
    }
    delete manifest.__metadata;
    const id = getGalleryExtensionId(manifest.publisher, manifest.name);
    const identifier = metadata?.id ? { id, uuid: metadata.id } : { id };
    const type = metadata?.isSystem ? ExtensionType.System : input.type;
    const isBuiltin = type === ExtensionType.System || !!metadata?.isBuiltin;
    try {
      manifest = await this.translateManifest(input.location, manifest, ExtensionScannerInput.createNlsConfiguration(input));
    } catch (error) {
      this.logService.warn("Failed to translate manifest", getErrorMessage(error));
    }
    let extension = {
      type,
      identifier,
      manifest,
      location: input.location,
      isBuiltin,
      targetPlatform: metadata?.targetPlatform ?? TargetPlatform.UNDEFINED,
      publisherDisplayName: metadata?.publisherDisplayName,
      metadata,
      isValid,
      validations,
      preRelease: !!metadata?.preRelease,
      forceAutoUpdate: this.productBuiltInExtensionsEnabledWithAutoUpdates.has(id.toLowerCase()) && this.productQuality === "stable"
    };
    if (input.validate) {
      extension = this.validate(extension, input);
    }
    if (manifest.enabledApiProposals) {
      manifest.originalEnabledApiProposals = manifest.enabledApiProposals;
      manifest.enabledApiProposals = parseEnabledApiProposalNames([...manifest.enabledApiProposals]);
    }
    return extension;
  }
  validate(extension, input) {
    let isValid = extension.isValid;
    const validations = validateExtensionManifest(input.productVersion, input.productDate, input.location, extension.manifest, extension.isBuiltin);
    for (const [severity, message] of validations) {
      if (severity === Severity.Error) {
        isValid = false;
        this.logService.error(this.formatMessage(input.location, message));
      }
    }
    extension.isValid = isValid;
    extension.validations = [...extension.validations, ...validations];
    return extension;
  }
  async scanExtensionManifest(extensionLocation) {
    const manifestLocation = joinPath(extensionLocation, "package.json");
    let content;
    try {
      content = (await this.fileService.readFile(manifestLocation)).value.toString();
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(this.formatMessage(extensionLocation, localize("fileReadFail", "Cannot read file {0}: {1}.", manifestLocation.path, error.message)));
      }
      throw error;
    }
    let manifest;
    try {
      manifest = JSON.parse(content);
    } catch (err) {
      const errors = [];
      parse(content, errors);
      for (const e of errors) {
        this.logService.error(this.formatMessage(extensionLocation, localize("jsonParseFail", "Failed to parse {0}: [{1}, {2}] {3}.", manifestLocation.path, e.offset, e.length, getParseErrorMessage(e.error))));
      }
      throw err;
    }
    if (getNodeType(manifest) !== "object") {
      const errorMessage = this.formatMessage(extensionLocation, localize("jsonParseInvalidType", "Invalid manifest file {0}: Not a JSON object.", manifestLocation.path));
      this.logService.error(errorMessage);
      throw new Error(errorMessage);
    }
    return manifest;
  }
  async translateManifest(extensionLocation, extensionManifest, nlsConfiguration) {
    const localizedMessages = await this.getLocalizedMessages(extensionLocation, extensionManifest, nlsConfiguration);
    if (localizedMessages) {
      try {
        const errors = [];
        const defaults = await this.resolveOriginalMessageBundle(localizedMessages.default, errors);
        if (errors.length > 0) {
          errors.forEach((error) => {
            this.logService.error(this.formatMessage(extensionLocation, localize("jsonsParseReportErrors", "Failed to parse {0}: {1}.", localizedMessages.default?.path, getParseErrorMessage(error.error))));
          });
          return extensionManifest;
        } else if (getNodeType(localizedMessages) !== "object") {
          this.logService.error(this.formatMessage(extensionLocation, localize("jsonInvalidFormat", "Invalid format {0}: JSON object expected.", localizedMessages.default?.path)));
          return extensionManifest;
        }
        const localized = localizedMessages.values || /* @__PURE__ */ Object.create(null);
        return localizeManifest(this.logService, extensionManifest, localized, defaults);
      } catch (error) {
      }
    }
    return extensionManifest;
  }
  async getLocalizedMessages(extensionLocation, extensionManifest, nlsConfiguration) {
    const defaultPackageNLS = joinPath(extensionLocation, "package.nls.json");
    const reportErrors = (localized, errors) => {
      errors.forEach((error) => {
        this.logService.error(this.formatMessage(extensionLocation, localize("jsonsParseReportErrors", "Failed to parse {0}: {1}.", localized?.path, getParseErrorMessage(error.error))));
      });
    };
    const reportInvalidFormat = (localized) => {
      this.logService.error(this.formatMessage(extensionLocation, localize("jsonInvalidFormat", "Invalid format {0}: JSON object expected.", localized?.path)));
    };
    const translationId = `${extensionManifest.publisher}.${extensionManifest.name}`;
    const translationPath = nlsConfiguration.translations[translationId];
    if (translationPath) {
      try {
        const translationResource = URI.file(translationPath);
        const content = (await this.fileService.readFile(translationResource)).value.toString();
        const errors = [];
        const translationBundle = parse(content, errors);
        if (errors.length > 0) {
          reportErrors(translationResource, errors);
          return { values: void 0, default: defaultPackageNLS };
        } else if (getNodeType(translationBundle) !== "object") {
          reportInvalidFormat(translationResource);
          return { values: void 0, default: defaultPackageNLS };
        } else {
          const values = translationBundle.contents ? translationBundle.contents.package : void 0;
          return { values, default: defaultPackageNLS };
        }
      } catch (error) {
        return { values: void 0, default: defaultPackageNLS };
      }
    } else {
      const exists = await this.fileService.exists(defaultPackageNLS);
      if (!exists) {
        return void 0;
      }
      let messageBundle;
      try {
        messageBundle = await this.findMessageBundles(extensionLocation, nlsConfiguration);
      } catch (error) {
        return void 0;
      }
      if (!messageBundle.localized) {
        return { values: void 0, default: messageBundle.original };
      }
      try {
        const messageBundleContent = (await this.fileService.readFile(messageBundle.localized)).value.toString();
        const errors = [];
        const messages = parse(messageBundleContent, errors);
        if (errors.length > 0) {
          reportErrors(messageBundle.localized, errors);
          return { values: void 0, default: messageBundle.original };
        } else if (getNodeType(messages) !== "object") {
          reportInvalidFormat(messageBundle.localized);
          return { values: void 0, default: messageBundle.original };
        }
        return { values: messages, default: messageBundle.original };
      } catch (error) {
        return { values: void 0, default: messageBundle.original };
      }
    }
  }
  /**
   * Parses original message bundle, returns null if the original message bundle is null.
   */
  async resolveOriginalMessageBundle(originalMessageBundle, errors) {
    if (originalMessageBundle) {
      try {
        const originalBundleContent = (await this.fileService.readFile(originalMessageBundle)).value.toString();
        return parse(originalBundleContent, errors);
      } catch (error) {
      }
    }
    return;
  }
  /**
   * Finds localized message bundle and the original (unlocalized) one.
   * If the localized file is not present, returns null for the original and marks original as localized.
   */
  findMessageBundles(extensionLocation, nlsConfiguration) {
    return new Promise((c, e) => {
      const loop = (locale) => {
        const toCheck = joinPath(extensionLocation, `package.nls.${locale}.json`);
        this.fileService.exists(toCheck).then((exists) => {
          if (exists) {
            c({ localized: toCheck, original: joinPath(extensionLocation, "package.nls.json") });
          }
          const index = locale.lastIndexOf("-");
          if (index === -1) {
            c({ localized: joinPath(extensionLocation, "package.nls.json"), original: null });
          } else {
            locale = locale.substring(0, index);
            loop(locale);
          }
        });
      };
      if (nlsConfiguration.devMode || nlsConfiguration.pseudo || !nlsConfiguration.language) {
        return c({ localized: joinPath(extensionLocation, "package.nls.json"), original: null });
      }
      loop(nlsConfiguration.language);
    });
  }
  formatMessage(extensionLocation, message) {
    return `[${extensionLocation.path}]: ${message}`;
  }
};
ExtensionsScanner = __decorateClass([
  __decorateParam(0, IExtensionsProfileScannerService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, ILogService)
], ExtensionsScanner);
let CachedExtensionsScanner = class extends ExtensionsScanner {
  constructor(currentProfile, userDataProfilesService, extensionsProfileScannerService, uriIdentityService, fileService, productService, environmentService, logService) {
    super(extensionsProfileScannerService, uriIdentityService, fileService, productService, environmentService, logService);
    this.currentProfile = currentProfile;
    this.userDataProfilesService = userDataProfilesService;
    this.cacheValidatorThrottler = this._register(new ThrottledDelayer(3e3));
    this._onDidChangeCache = this._register(new Emitter());
    this.onDidChangeCache = this._onDidChangeCache.event;
  }
  async scanExtensions(input) {
    const cacheFile = this.getCacheFile(input);
    const cacheContents = await this.readExtensionCache(cacheFile);
    this.input = input;
    if (cacheContents && cacheContents.input && ExtensionScannerInput.equals(cacheContents.input, this.input)) {
      this.logService.debug("Using cached extensions scan result", input.type === ExtensionType.System ? "system" : "user", input.location.toString());
      this.cacheValidatorThrottler.trigger(() => this.validateCache());
      return cacheContents.result.map((extension) => {
        extension.location = URI.revive(extension.location);
        return extension;
      });
    }
    const result = await super.scanExtensions(input);
    await this.writeExtensionCache(cacheFile, { input, result });
    return result;
  }
  async readExtensionCache(cacheFile) {
    try {
      const cacheRawContents = await this.fileService.readFile(cacheFile);
      const extensionCacheData = JSON.parse(cacheRawContents.value.toString());
      return { result: extensionCacheData.result, input: revive(extensionCacheData.input) };
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.debug("Error while reading the extension cache file:", cacheFile.path, getErrorMessage(error));
      }
    }
    return null;
  }
  async writeExtensionCache(cacheFile, cacheContents) {
    try {
      await this.fileService.writeFile(cacheFile, VSBuffer.fromString(JSON.stringify(cacheContents)));
    } catch (error) {
      this.logService.debug("Error while writing the extension cache file:", cacheFile.path, getErrorMessage(error));
    }
  }
  async validateCache() {
    if (!this.input) {
      return;
    }
    const cacheFile = this.getCacheFile(this.input);
    const cacheContents = await this.readExtensionCache(cacheFile);
    if (!cacheContents) {
      return;
    }
    const actual = cacheContents.result;
    const expected = JSON.parse(JSON.stringify(await super.scanExtensions(this.input)));
    if (objects.equals(expected, actual)) {
      return;
    }
    try {
      this.logService.info("Invalidating Cache", actual, expected);
      await this.fileService.del(cacheFile);
      this._onDidChangeCache.fire();
    } catch (error) {
      this.logService.error(error);
    }
  }
  getCacheFile(input) {
    const profile = this.getProfile(input);
    return this.uriIdentityService.extUri.joinPath(profile.cacheHome, input.type === ExtensionType.System ? BUILTIN_MANIFEST_CACHE_FILE : USER_MANIFEST_CACHE_FILE);
  }
  getProfile(input) {
    if (input.type === ExtensionType.System) {
      return this.userDataProfilesService.defaultProfile;
    }
    if (!input.profile) {
      return this.userDataProfilesService.defaultProfile;
    }
    if (this.uriIdentityService.extUri.isEqual(input.location, this.currentProfile.extensionsResource)) {
      return this.currentProfile;
    }
    return this.userDataProfilesService.profiles.find((p) => this.uriIdentityService.extUri.isEqual(input.location, p.extensionsResource)) ?? this.currentProfile;
  }
};
CachedExtensionsScanner = __decorateClass([
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IExtensionsProfileScannerService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IEnvironmentService),
  __decorateParam(7, ILogService)
], CachedExtensionsScanner);
function toExtensionDescription(extension, isUnderDevelopment) {
  const id = getExtensionId(extension.manifest.publisher, extension.manifest.name);
  return {
    id,
    identifier: new ExtensionIdentifier(id),
    isBuiltin: extension.type === ExtensionType.System,
    isUserBuiltin: extension.type === ExtensionType.User && extension.isBuiltin,
    isUnderDevelopment,
    extensionLocation: extension.location,
    uuid: extension.identifier.uuid,
    targetPlatform: extension.targetPlatform,
    publisherDisplayName: extension.publisherDisplayName,
    preRelease: extension.preRelease,
    ...extension.manifest
  };
}
class NativeExtensionsScannerService extends AbstractExtensionsScannerService {
  constructor(systemExtensionsLocation, userExtensionsLocation, userHome, currentProfile, userDataProfilesService, extensionsProfileScannerService, fileService, logService, environmentService, productService, uriIdentityService, instantiationService) {
    super(
      systemExtensionsLocation,
      userExtensionsLocation,
      joinPath(userHome, ".vscode-oss-dev", "extensions", "control.json"),
      currentProfile,
      userDataProfilesService,
      extensionsProfileScannerService,
      fileService,
      logService,
      environmentService,
      productService,
      uriIdentityService,
      instantiationService
    );
    this.translationsPromise = (async () => {
      if (platform.translationsConfigFile) {
        try {
          const content = await this.fileService.readFile(URI.file(platform.translationsConfigFile));
          return JSON.parse(content.value.toString());
        } catch (err) {
        }
      }
      return /* @__PURE__ */ Object.create(null);
    })();
  }
  getTranslations(language) {
    return this.translationsPromise;
  }
}
export {
  AbstractExtensionsScannerService,
  ExtensionScannerInput,
  IExtensionsScannerService,
  NativeExtensionsScannerService,
  Translations,
  toExtensionDescription
};
