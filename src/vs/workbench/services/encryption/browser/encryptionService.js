import { IEncryptionService, KnownStorageProvider } from "../../../../platform/encryption/common/encryptionService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
class EncryptionService {
  encrypt(value) {
    return Promise.resolve(value);
  }
  decrypt(value) {
    return Promise.resolve(value);
  }
  isEncryptionAvailable() {
    return Promise.resolve(false);
  }
  getKeyStorageProvider() {
    return Promise.resolve(KnownStorageProvider.basicText);
  }
  setUsePlainTextEncryption() {
    return Promise.resolve(void 0);
  }
}
registerSingleton(IEncryptionService, EncryptionService, InstantiationType.Delayed);
export {
  EncryptionService
};
