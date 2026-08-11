import { createDecorator } from "../../instantiation/common/instantiation.js";
const IEncryptionService = createDecorator("encryptionService");
const IEncryptionMainService = createDecorator("encryptionMainService");
var PasswordStoreCLIOption = /* @__PURE__ */ ((PasswordStoreCLIOption2) => {
  PasswordStoreCLIOption2["kwallet"] = "kwallet";
  PasswordStoreCLIOption2["kwallet5"] = "kwallet5";
  PasswordStoreCLIOption2["gnomeLibsecret"] = "gnome-libsecret";
  PasswordStoreCLIOption2["basic"] = "basic";
  return PasswordStoreCLIOption2;
})(PasswordStoreCLIOption || {});
var KnownStorageProvider = /* @__PURE__ */ ((KnownStorageProvider2) => {
  KnownStorageProvider2["unknown"] = "unknown";
  KnownStorageProvider2["basicText"] = "basic_text";
  KnownStorageProvider2["gnomeAny"] = "gnome_any";
  KnownStorageProvider2["gnomeLibsecret"] = "gnome_libsecret";
  KnownStorageProvider2["gnomeKeyring"] = "gnome_keyring";
  KnownStorageProvider2["kwallet"] = "kwallet";
  KnownStorageProvider2["kwallet5"] = "kwallet5";
  KnownStorageProvider2["kwallet6"] = "kwallet6";
  KnownStorageProvider2["dplib"] = "dpapi";
  KnownStorageProvider2["keychainAccess"] = "keychain_access";
  return KnownStorageProvider2;
})(KnownStorageProvider || {});
function isKwallet(backend) {
  return backend === "kwallet" /* kwallet */ || backend === "kwallet5" /* kwallet5 */ || backend === "kwallet6" /* kwallet6 */;
}
function isGnome(backend) {
  return backend === "gnome_any" /* gnomeAny */ || backend === "gnome_libsecret" /* gnomeLibsecret */ || backend === "gnome_keyring" /* gnomeKeyring */;
}
export {
  IEncryptionMainService,
  IEncryptionService,
  KnownStorageProvider,
  PasswordStoreCLIOption,
  isGnome,
  isKwallet
};
