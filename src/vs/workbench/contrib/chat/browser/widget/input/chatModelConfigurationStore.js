import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { equals } from "../../../../../../base/common/objects.js";
import { StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { createModelConfigurationActions } from "../../../common/languageModels.js";
import { computeStoredConfiguration, extractSchemaDefaults, filterConfigurationToSchema, resolveModelConfiguration } from "./chatModelConfigurationLogic.js";
class ChatModelConfigurationStore extends Disposable {
  constructor(getStorageKey, languageModelsService, storageService) {
    super();
    this.getStorageKey = getStorageKey;
    this.languageModelsService = languageModelsService;
    this.storageService = storageService;
    this._overrides = /* @__PURE__ */ new Map();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(this.languageModelsService.onDidChangeLanguageModels(() => {
      if (this._overrides.size === 0) {
        return;
      }
      const bucket = this._readBucket();
      for (const [modelId, override] of [...this._overrides]) {
        const schemaDefaults = this._schemaDefaults(modelId);
        const nextOverride = Object.keys(override).length === 0 ? resolveModelConfiguration(bucket[modelId], schemaDefaults, this.languageModelsService.getModelConfiguration(modelId)) : { ...schemaDefaults, ...override };
        if (!equals(override, nextOverride)) {
          this._overrides.set(modelId, nextOverride);
          this._onDidChange.fire(modelId);
        }
      }
    }));
  }
  /**
   * Returns this editor's snapshot of the given model's configuration. The
   * resolution order is:
   *   1. In-memory snapshot (this editor's live value).
   *   2. Scoped storage bucket. A present entry wins even when empty, since an
   *      empty entry records an explicit reset-to-default.
   *   3. The profile-global value (migration fallback, only when no scoped
   *      entry exists).
   * The merged result is cached so subsequent reads are O(1).
   */
  getModelConfiguration(modelId) {
    let override = this._overrides.get(modelId);
    if (!override) {
      const bucketEntry = this._readBucket()[modelId];
      const schemaDefaults = this._schemaDefaults(modelId);
      const globalConfig = this.languageModelsService.getModelConfiguration(modelId);
      override = resolveModelConfiguration(bucketEntry, schemaDefaults, globalConfig);
      this._overrides.set(modelId, override);
    }
    return Object.keys(override).length > 0 ? override : void 0;
  }
  async setModelConfiguration(modelId, values) {
    const changed = this._applyLocalModelConfiguration(modelId, values);
    if (!changed) {
      return;
    }
    await this.languageModelsService.setModelConfiguration(modelId, values);
  }
  /**
   * Applies the change to this editor's scoped state only (in-memory snapshot
   * and persisted bucket). Returns `true` when something actually changed, so
   * callers can skip propagating no-op updates to the profile-global value.
   */
  _applyLocalModelConfiguration(modelId, values) {
    const schemaDefaults = this._schemaDefaults(modelId);
    const stored = computeStoredConfiguration(this.getModelConfiguration(modelId) ?? {}, values, schemaDefaults);
    const nextOverride = { ...schemaDefaults, ...stored };
    const bucket = this._readBucket();
    if (equals(this._overrides.get(modelId), nextOverride) && equals(bucket[modelId], stored)) {
      return false;
    }
    this._overrides.set(modelId, nextOverride);
    bucket[modelId] = stored;
    this._writeBucket(bucket);
    this._onDidChange.fire(modelId);
    return true;
  }
  getModelConfigurationActions(modelId) {
    return createModelConfigurationActions(
      this.languageModelsService.lookupLanguageModel(modelId)?.configurationSchema,
      this.getModelConfiguration(modelId) ?? {},
      (key, value) => this.setModelConfiguration(modelId, { [key]: value })
    );
  }
  /**
   * Restores a previously captured configuration for a model (e.g. when
   * reopening a chat session). Seeds this editor's in-memory snapshot and
   * persists it as the scoped default so the restored value participates in
   * the same resolution hierarchy as a user-made change — mirroring how the
   * restored model selection is persisted to its scoped storage key.
   *
   * When the model is registered, the captured values are filtered against its
   * *current* configuration schema so that a config saved against an older
   * schema does not re-pin removed properties or invalid values: unknown keys
   * and values that violate the schema's `enum` constraint are dropped and fall
   * back to the live default.
   *
   * When the model is NOT yet registered (asynchronous provider registration),
   * its schema is unavailable. Filtering would then discard the *entire*
   * captured config, causing the restore to merge an empty value over whatever
   * the shared per-scope snapshot currently holds — re-pinning another
   * conversation's value (e.g. its context size). To preserve the reopened
   * session's own configuration in that race, the captured values are restored
   * as-is; a later sync re-validates them once the schema loads. See #320393.
   */
  restoreModelConfiguration(modelId, values) {
    const metadata = this.languageModelsService.lookupLanguageModel(modelId);
    const filtered = metadata ? filterConfigurationToSchema(values, metadata.configurationSchema) : { ...values };
    this._applyLocalModelConfiguration(modelId, filtered);
  }
  /**
   * Drops all in-memory snapshots so the next read re-seeds from the (now
   * different) scoped storage bucket. Call when the owning editor's scope
   * (e.g. session type) changes.
   */
  clear() {
    this._overrides.clear();
  }
  _schemaDefaults(modelId) {
    return extractSchemaDefaults(this.languageModelsService.lookupLanguageModel(modelId)?.configurationSchema);
  }
  _readBucket() {
    const result = /* @__PURE__ */ Object.create(null);
    const raw = this.storageService.get(this.getStorageKey(), StorageScope.APPLICATION);
    if (!raw) {
      return result;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [modelId, entry] of Object.entries(parsed)) {
          if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            result[modelId] = entry;
          }
        }
      }
    } catch {
    }
    return result;
  }
  _writeBucket(bucket) {
    const key = this.getStorageKey();
    if (Object.keys(bucket).length === 0) {
      this.storageService.remove(key, StorageScope.APPLICATION);
    } else {
      this.storageService.store(key, JSON.stringify(bucket), StorageScope.APPLICATION, StorageTarget.USER);
    }
  }
}
export {
  ChatModelConfigurationStore
};
