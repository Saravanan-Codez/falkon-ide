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
import { safeStorage as safeStorageElectron, app } from "electron";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { KnownStorageProvider, PasswordStoreCLIOption } from "../common/encryptionService.js";
import { ILogService } from "../../log/common/log.js";
const safeStorage = safeStorageElectron;
let EncryptionMainService = class {
  constructor(logService) {
    this.logService = logService;
    if (app.commandLine.getSwitchValue("password-store") === PasswordStoreCLIOption.basic) {
      this.logService.trace("[EncryptionMainService] setting usePlainTextEncryption to true...");
      safeStorage.setUsePlainTextEncryption?.(true);
      this.logService.trace("[EncryptionMainService] set usePlainTextEncryption to true");
    }
  }
  async encrypt(value) {
    this.logService.trace("[EncryptionMainService] Encrypting value...");
    try {
      const result = JSON.stringify(safeStorage.encryptString(value));
      this.logService.trace("[EncryptionMainService] Encrypted value.");
      return result;
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  }
  async decrypt(value) {
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
      if (!parsedValue.data) {
        throw new Error(`[EncryptionMainService] Invalid encrypted value: ${value}`);
      }
      const bufferToDecrypt = Buffer.from(parsedValue.data);
      this.logService.trace("[EncryptionMainService] Decrypting value...");
      const result = safeStorage.decryptString(bufferToDecrypt);
      this.logService.trace("[EncryptionMainService] Decrypted value.");
      return result;
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  }
  isEncryptionAvailable() {
    this.logService.trace("[EncryptionMainService] Checking if encryption is available...");
    const result = safeStorage.isEncryptionAvailable();
    this.logService.trace("[EncryptionMainService] Encryption is available: ", result);
    return Promise.resolve(result);
  }
  getKeyStorageProvider() {
    if (isWindows) {
      return Promise.resolve(KnownStorageProvider.dplib);
    }
    if (isMacintosh) {
      return Promise.resolve(KnownStorageProvider.keychainAccess);
    }
    if (safeStorage.getSelectedStorageBackend) {
      try {
        this.logService.trace("[EncryptionMainService] Getting selected storage backend...");
        const result = safeStorage.getSelectedStorageBackend();
        this.logService.trace("[EncryptionMainService] Selected storage backend: ", result);
        return Promise.resolve(result);
      } catch (e) {
        this.logService.error(e);
      }
    }
    return Promise.resolve(KnownStorageProvider.unknown);
  }
  async setUsePlainTextEncryption() {
    if (isWindows) {
      throw new Error("Setting plain text encryption is not supported on Windows.");
    }
    if (isMacintosh) {
      throw new Error("Setting plain text encryption is not supported on macOS.");
    }
    if (!safeStorage.setUsePlainTextEncryption) {
      throw new Error("Setting plain text encryption is not supported.");
    }
    this.logService.trace("[EncryptionMainService] Setting usePlainTextEncryption to true...");
    safeStorage.setUsePlainTextEncryption(true);
    this.logService.trace("[EncryptionMainService] Set usePlainTextEncryption to true");
  }
};
EncryptionMainService = __decorateClass([
  __decorateParam(0, ILogService)
], EncryptionMainService);
export {
  EncryptionMainService
};
