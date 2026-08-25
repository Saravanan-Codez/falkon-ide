import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { observableSignal, runOnChange } from "../../../../../base/common/observable.js";
import { AnnotatedStringEdit } from "../../../../../editor/common/core/edits/stringEdit.js";
import { EditKeySourceData, EditSourceBase } from "../helpers/documentWithAnnotatedEdits.js";
const EXTERNAL_OBSERVATION_KEY_PREFIX = "external-observation:";
class DocumentEditSourceTracker extends Disposable {
  constructor(_doc, data, _externalEditCorrelation, _externalEditCorrelationPolicy = "suppress") {
    super();
    this._doc = _doc;
    this.data = data;
    this._externalEditCorrelation = _externalEditCorrelation;
    this._externalEditCorrelationPolicy = _externalEditCorrelationPolicy;
    this._edits = AnnotatedStringEdit.empty;
    this._pendingExternalEdits = AnnotatedStringEdit.empty;
    this._update = observableSignal(this);
    this._documentStore = this._register(new DisposableStore());
    this._representativePerKey = /* @__PURE__ */ new Map();
    this._sumAddedCharactersPerKey = /* @__PURE__ */ new Map();
    this._externalObservationIds = /* @__PURE__ */ new Set();
    this._ignoredInitialExternalObservationIds = /* @__PURE__ */ new Set();
    this._suppressedExternalObservationIds = /* @__PURE__ */ new Set();
    this._invalidatedExternalObservationIds = /* @__PURE__ */ new Set();
    this._reattributedExternalObservations = /* @__PURE__ */ new Map();
    this._documentStore.add(runOnChange(this._doc.value, (_val, _prevVal, edits) => {
      let eComposed = AnnotatedStringEdit.compose(edits.map((e) => e.edit));
      if (eComposed.replacements.every((e) => e.data.source.category === "external")) {
        if (this._edits.isEmpty() && !this._externalEditCorrelation) {
        } else {
          if (this._externalEditCorrelation) {
            const observationId = this._externalEditCorrelation.register(_prevVal.value, _val.value);
            this._externalObservationIds.add(observationId);
            if (this._edits.isEmpty()) {
              this._ignoredInitialExternalObservationIds.add(observationId);
            }
            const resolution = this._externalEditCorrelation.getResolution?.(observationId);
            if (resolution) {
              this._resolveExternalObservation(resolution);
            } else if (this._externalEditCorrelationPolicy === "suppress" && this._externalEditCorrelation.isSuppressed(observationId)) {
              this._suppressedExternalObservationIds.add(observationId);
            }
            const key = `${EXTERNAL_OBSERVATION_KEY_PREFIX}${observationId}`;
            eComposed = eComposed.mapData((replacement) => new EditKeySourceData(key, replacement.data.source, replacement.data.representative));
          }
          this._pendingExternalEdits = this._pendingExternalEdits.compose(eComposed);
        }
      } else {
        if (!this._pendingExternalEdits.isEmpty()) {
          this._applyEdit(this._pendingExternalEdits);
          this._pendingExternalEdits = AnnotatedStringEdit.empty;
        }
        this._applyEdit(eComposed);
      }
      this._update.trigger(void 0);
    }));
    if (this._externalEditCorrelation) {
      if (this._externalEditCorrelation.onDidResolve) {
        this._register(this._externalEditCorrelation.onDidResolve((resolution) => this._resolveExternalObservation(resolution)));
      } else {
        this._register(this._externalEditCorrelation.onDidSuppress((observationId) => {
          if (this._externalObservationIds.has(observationId) && this._externalEditCorrelationPolicy === "suppress") {
            this._suppressedExternalObservationIds.add(observationId);
            this._update.trigger(void 0);
          }
        }));
      }
      this._register(this._externalEditCorrelation.onDidInvalidate((observationId) => {
        if (this._externalObservationIds.has(observationId)) {
          this._suppressedExternalObservationIds.delete(observationId);
          this._reattributedExternalObservations.delete(observationId);
          this._invalidatedExternalObservationIds.add(observationId);
          this._update.trigger(void 0);
        }
      }));
    }
  }
  releaseExternalEditCorrelations() {
    for (const observationId of this._externalObservationIds) {
      this._externalEditCorrelation?.release(observationId);
    }
    this._externalObservationIds.clear();
  }
  stopTracking() {
    this._documentStore.clear();
  }
  async waitForExternalEditCorrelations(timeoutMs) {
    await this._externalEditCorrelation?.waitForResolution?.(Array.from(this._externalObservationIds), timeoutMs);
  }
  _applyEdit(e) {
    for (const r of e.replacements) {
      let existing = this._sumAddedCharactersPerKey.get(r.data.key);
      if (existing === void 0) {
        existing = 0;
        this._representativePerKey.set(r.data.key, r.data.representative);
      }
      const newCount = existing + r.getNewLength();
      this._sumAddedCharactersPerKey.set(r.data.key, newCount);
    }
    this._edits = this._edits.compose(e);
  }
  async waitForQueue() {
    await this._doc.waitForQueue();
  }
  getTotalInsertedCharactersCount(key, includeSuppressed = false) {
    if (!this._shouldIncludeKey(key, includeSuppressed)) {
      return 0;
    }
    const val = this._sumAddedCharactersPerKey.get(key);
    return val ?? 0;
  }
  getAllKeys(includeSuppressed = false) {
    return Array.from(this._sumAddedCharactersPerKey.keys()).filter((key) => this._shouldIncludeKey(key, includeSuppressed));
  }
  getRepresentative(key) {
    const observationId = getExternalObservationId(key);
    if (observationId) {
      return this._reattributedExternalObservations.get(observationId) ?? this._representativePerKey.get(key);
    }
    return this._representativePerKey.get(key);
  }
  applyPendingExternalEdits() {
    if (this._pendingExternalEdits.isEmpty()) {
      return;
    }
    this._applyEdit(this._pendingExternalEdits);
    this._pendingExternalEdits = AnnotatedStringEdit.empty;
    this._update.trigger(void 0);
  }
  getTrackedRanges(reader, includeSuppressed = false) {
    this._update.read(reader);
    const ranges = this._edits.getNewRanges();
    return ranges.map((r, idx) => {
      const e = this._edits.replacements[idx];
      const representative = this.getRepresentative(e.data.key) ?? e.data.representative;
      const source = representative === e.data.representative ? e.data.source : EditSourceBase.create(representative);
      const te = new TrackedEdit(e.replaceRange, r, e.data.key, source, representative);
      return te;
    }).filter((edit) => this._shouldIncludeKey(edit.sourceKey, includeSuppressed));
  }
  isEmpty() {
    return this.getAllKeys().length === 0;
  }
  _shouldIncludeKey(key, includeSuppressed) {
    const observationId = getExternalObservationId(key);
    if (!observationId) {
      return true;
    }
    if (this._reattributedExternalObservations.has(observationId)) {
      return true;
    }
    if (this._invalidatedExternalObservationIds.has(observationId)) {
      return true;
    }
    const isSuppressed = this._suppressedExternalObservationIds.has(observationId);
    if (this._ignoredInitialExternalObservationIds.has(observationId)) {
      if (this._externalEditCorrelationPolicy === "reattribute") {
        return true;
      }
      return includeSuppressed && isSuppressed;
    }
    return includeSuppressed || !isSuppressed;
  }
  _resolveExternalObservation(resolution) {
    if (!this._externalObservationIds.has(resolution.id)) {
      return;
    }
    this._invalidatedExternalObservationIds.delete(resolution.id);
    if (this._externalEditCorrelationPolicy === "suppress") {
      this._suppressedExternalObservationIds.add(resolution.id);
    } else if (resolution.source) {
      this._reattributedExternalObservations.set(resolution.id, resolution.source);
    }
    this._update.trigger(void 0);
  }
  _getDebugVisualization() {
    const ranges = this.getTrackedRanges();
    const txt = this._doc.value.get().value;
    return {
      ...{ $fileExtension: "text.w" },
      "value": txt,
      "decorations": ranges.map((r) => {
        return {
          range: [r.range.start, r.range.endExclusive],
          color: r.source.getColor()
        };
      })
    };
  }
}
function getExternalObservationId(key) {
  return key.startsWith(EXTERNAL_OBSERVATION_KEY_PREFIX) ? key.substring(EXTERNAL_OBSERVATION_KEY_PREFIX.length) : void 0;
}
class TrackedEdit {
  constructor(originalRange, range, sourceKey, source, sourceRepresentative) {
    this.originalRange = originalRange;
    this.range = range;
    this.sourceKey = sourceKey;
    this.source = source;
    this.sourceRepresentative = sourceRepresentative;
  }
}
export {
  DocumentEditSourceTracker,
  TrackedEdit
};
