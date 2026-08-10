import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { autorun } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { createDocWithJustReason } from "./helpers/documentWithAnnotatedEdits.js";
import { DocumentEditSourceTracker } from "./telemetry/editTracker.js";
class AiContributionFeature extends Disposable {
  constructor(annotatedDocuments) {
    super();
    this._trackers = new ResourceMap();
    this._documentsByUri = new ResourceMap();
    this._register(autorun((reader) => {
      const docs = annotatedDocuments.documents.read(reader);
      const activeUris = new ResourceMap();
      for (const doc of docs) {
        const uri = doc.document.uri;
        activeUris.set(uri, true);
        this._documentsByUri.set(uri, doc);
        if (!this._trackers.has(uri)) {
          this._trackers.set(uri, this._createTrackerEntry(doc));
        }
      }
      for (const [uri, entry] of this._trackers) {
        if (!activeUris.has(uri)) {
          entry.trackerStore.dispose();
          this._trackers.delete(uri);
          this._documentsByUri.delete(uri);
        }
      }
    }));
    this._register(CommandsRegistry.registerCommand("_aiEdits.hasAiContributions", (_accessor, resources, level) => {
      return this._hasAiContributions(resources, level);
    }));
    this._register(CommandsRegistry.registerCommand("_aiEdits.clearAiContributions", (_accessor, resources) => {
      this._clearAiContributions(resources);
    }));
    this._register(CommandsRegistry.registerCommand("_aiEdits.clearAllAiContributions", () => {
      this._clearAiContributions();
    }));
  }
  dispose() {
    for (const [, entry] of this._trackers) {
      entry.trackerStore.dispose();
    }
    super.dispose();
  }
  _createTrackerEntry(doc) {
    const trackerStore = new DisposableStore();
    const docWithJustReason = createDocWithJustReason(doc.documentWithAnnotations, trackerStore);
    const tracker = trackerStore.add(new DocumentEditSourceTracker(docWithJustReason, void 0));
    return { trackerStore, tracker };
  }
  _hasAiContributions(resources, level) {
    for (const resource of resources) {
      const entry = this._trackers.get(URI.revive(resource));
      if (entry) {
        for (const edit of entry.tracker.getTrackedRanges()) {
          if (edit.source.category === "ai" && (level === "all" || edit.source.feature === "chat")) {
            return true;
          }
        }
      }
    }
    return false;
  }
  _clearAiContributions(resources) {
    const uris = resources ? resources.map((r) => URI.revive(r)) : [...this._trackers.keys()];
    for (const uri of uris) {
      const entry = this._trackers.get(uri);
      if (entry) {
        entry.trackerStore.dispose();
        const doc = this._documentsByUri.get(uri);
        if (doc) {
          this._trackers.set(uri, this._createTrackerEntry(doc));
        } else {
          this._trackers.delete(uri);
          this._documentsByUri.delete(uri);
        }
      }
    }
  }
}
export {
  AiContributionFeature
};
