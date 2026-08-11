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
import { SequencerByKey } from "../../../base/common/async.js";
import { IEncryptionService } from "../../encryption/common/encryptionService.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { IStorageService, InMemoryStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { ILogService } from "../../log/common/log.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { Lazy } from "../../../base/common/lazy.js";
import { isWindows } from "../../../base/common/platform.js";
const SECRET_STORAGE_PREFIX = "secret://";
function secretStorageKey(key) {
  return `${SECRET_STORAGE_PREFIX}${key}`;
}
async function readEncryptedSecret(key, storageGet, decrypt, logService) {
  const fullKey = secretStorageKey(key);
  logService?.trace("[secrets] getting secret for key:", fullKey);
  const encrypted = storageGet(fullKey);
  if (!encrypted) {
    logService?.trace("[secrets] no secret found for key:", fullKey);
    return void 0;
  }
  logService?.trace("[secrets] decrypting secret for key:", fullKey);
  const result = await decrypt(encrypted);
  logService?.trace("[secrets] decrypted secret for key:", fullKey);
  return result;
}
async function writeEncryptedSecret(key, value, storageSet, encrypt, logService) {
  logService?.trace("[secrets] encrypting secret for key:", key);
  const encrypted = await encrypt(value);
  const fullKey = secretStorageKey(key);
  logService?.trace("[secrets] storing encrypted secret for key:", fullKey);
  storageSet(fullKey, encrypted);
  logService?.trace("[secrets] stored encrypted secret for key:", fullKey);
}
const CROSS_APP_SHARED_SECRET_KEYS = [
  '{"extensionId":"vscode.github-authentication","key":"github.auth"}'
];
const ISecretStorageService = createDecorator("secretStorageService");
let BaseSecretStorageService = class extends Disposable {
  constructor(_useInMemoryStorage, _storageService, _encryptionService, _logService) {
    super();
    this._useInMemoryStorage = _useInMemoryStorage;
    this._storageService = _storageService;
    this._encryptionService = _encryptionService;
    this._logService = _logService;
    this.onDidChangeSecretEmitter = this._register(new Emitter());
    this.onDidChangeSecret = this.onDidChangeSecretEmitter.event;
    this._sequencer = new SequencerByKey();
    this._type = "unknown";
    this._onDidChangeValueDisposable = this._register(new DisposableStore());
    this._lazyStorageService = new Lazy(() => this.initialize());
  }
  useSharedStorage(key) {
    return isWindows && CROSS_APP_SHARED_SECRET_KEYS.includes(key);
  }
  /**
   * @Note initialize must be called first so that this can be resolved properly
   * otherwise it will return 'unknown'.
   */
  get type() {
    return this._type;
  }
  get resolvedStorageService() {
    return this._lazyStorageService.value;
  }
  get(key) {
    return this._sequencer.queue(key, async () => {
      const storageService = await this.resolvedStorageService;
      try {
        return await readEncryptedSecret(
          key,
          (fullKey) => this.getValueFromStorage(key, fullKey, storageService),
          // If the storage service is in-memory, we don't need to decrypt
          this._type === "in-memory" ? (v) => Promise.resolve(v) : (v) => this._encryptionService.decrypt(v),
          this._logService
        );
      } catch (e) {
        this._logService.error(e);
        const fullKey = secretStorageKey(key);
        this._logService.trace("[secrets] deleting invalid secret for key:", fullKey);
        this.removeValueFromStorage(key, fullKey, storageService);
        this._logService.trace("[secrets] deleted invalid secret for key:", fullKey);
        return void 0;
      }
    });
  }
  set(key, value) {
    return this._sequencer.queue(key, async () => {
      const storageService = await this.resolvedStorageService;
      try {
        await writeEncryptedSecret(
          key,
          value,
          (fullKey, encrypted) => this.setValueInStorage(key, fullKey, encrypted, storageService),
          // If the storage service is in-memory, we don't need to encrypt
          this._type === "in-memory" ? (v) => Promise.resolve(v) : (v) => this._encryptionService.encrypt(v),
          this._logService
        );
      } catch (e) {
        this._logService.error(e);
        throw e;
      }
    });
  }
  delete(key) {
    return this._sequencer.queue(key, async () => {
      const storageService = await this.resolvedStorageService;
      const fullKey = secretStorageKey(key);
      this._logService.trace("[secrets] deleting secret for key:", fullKey);
      this.removeValueFromStorage(key, fullKey, storageService);
      this._logService.trace("[secrets] deleted secret for key:", fullKey);
    });
  }
  keys() {
    return this._sequencer.queue("__keys__", async () => {
      const storageService = await this.resolvedStorageService;
      this._logService.trace("[secrets] fetching keys of all secrets");
      const allKeys = storageService.keys(StorageScope.APPLICATION, StorageTarget.MACHINE);
      this._logService.trace("[secrets] fetched keys of all secrets");
      return allKeys.filter((key) => key.startsWith(SECRET_STORAGE_PREFIX)).map((key) => key.slice(SECRET_STORAGE_PREFIX.length));
    });
  }
  getValueFromStorage(key, fullKey, storageService) {
    if (this.useSharedStorage(key)) {
      this._logService.trace(`[SecretStorageService] Fetching value for cross-app shared secret: ${fullKey}`);
      return storageService.get(fullKey, StorageScope.APPLICATION_SHARED);
    }
    return storageService.get(fullKey, StorageScope.APPLICATION);
  }
  removeValueFromStorage(key, fullKey, storageService) {
    const scope = this.useSharedStorage(key) ? StorageScope.APPLICATION_SHARED : StorageScope.APPLICATION;
    storageService.remove(fullKey, scope);
  }
  setValueInStorage(key, fullKey, value, storageService) {
    if (this.useSharedStorage(key)) {
      this._logService.trace(`[SecretStorageService] Setting value for cross-app shared secret: ${fullKey}`);
      storageService.store(fullKey, value, StorageScope.APPLICATION_SHARED, StorageTarget.MACHINE);
      return;
    }
    storageService.store(fullKey, value, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  async initialize() {
    let storageService;
    if (!this._useInMemoryStorage && await this._encryptionService.isEncryptionAvailable()) {
      this._logService.trace(`[SecretStorageService] Encryption is available, using persisted storage`);
      this._type = "persisted";
      storageService = this._storageService;
    } else {
      if (this._type === "in-memory") {
        return this._storageService;
      }
      this._logService.trace("[SecretStorageService] Encryption is not available, falling back to in-memory storage");
      this._type = "in-memory";
      storageService = this._register(new InMemoryStorageService());
    }
    this._onDidChangeValueDisposable.clear();
    this._onDidChangeValueDisposable.add(Event.any(
      storageService.onDidChangeValue(StorageScope.APPLICATION, void 0, this._onDidChangeValueDisposable),
      storageService.onDidChangeValue(StorageScope.APPLICATION_SHARED, void 0, this._onDidChangeValueDisposable)
    )((e) => {
      this.onDidChangeValue(e.key);
    }));
    return storageService;
  }
  reinitialize() {
    this._lazyStorageService = new Lazy(() => this.initialize());
  }
  onDidChangeValue(key) {
    if (!key.startsWith(SECRET_STORAGE_PREFIX)) {
      return;
    }
    const secretKey = key.slice(SECRET_STORAGE_PREFIX.length);
    this._logService.trace(`[SecretStorageService] Notifying change in value for secret: ${secretKey}`);
    this.onDidChangeSecretEmitter.fire(secretKey);
  }
};
BaseSecretStorageService = __decorateClass([
  __decorateParam(1, IStorageService),
  __decorateParam(2, IEncryptionService),
  __decorateParam(3, ILogService)
], BaseSecretStorageService);
export {
  BaseSecretStorageService,
  CROSS_APP_SHARED_SECRET_KEYS,
  ISecretStorageService,
  SECRET_STORAGE_PREFIX,
  readEncryptedSecret,
  secretStorageKey,
  writeEncryptedSecret
};
