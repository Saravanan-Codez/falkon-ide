import { derivedHandleChanges, observableValue, runOnChange, autorun, derived } from "../../../../../base/common/observable.js";
import { StringEdit, StringReplacement } from "../../../../../editor/common/core/edits/stringEdit.js";
import { EditSources } from "../../../../../editor/common/textModelEditSource.js";
class ObservableWorkspace {
  constructor() {
    this._version = 0;
    /**
     * Is fired when any open document changes.
    */
    this.onDidOpenDocumentChange = derivedHandleChanges({
      owner: this,
      changeTracker: {
        createChangeSummary: () => ({ didChange: false }),
        handleChange: (ctx, changeSummary) => {
          if (!ctx.didChange(this.documents)) {
            changeSummary.didChange = true;
          }
          return true;
        }
      }
    }, (reader, changeSummary) => {
      const docs = this.documents.read(reader);
      for (const d of docs) {
        d.value.read(reader);
      }
      if (changeSummary.didChange) {
        this._version++;
      }
      return this._version;
    });
    this.lastActiveDocument = derived((reader) => {
      const obs = observableValue("lastActiveDocument", void 0);
      reader.store.add(autorun((reader2) => {
        const docs = this.documents.read(reader2);
        for (const d of docs) {
          reader2.store.add(runOnChange(d.value, () => {
            obs.set(d, void 0);
          }));
        }
      }));
      return obs;
    }).flatten();
  }
  getFirstOpenDocument() {
    return this.documents.get()[0];
  }
  getDocument(documentId) {
    return this.documents.get().find((d) => d.uri.toString() === documentId.toString());
  }
}
class StringEditWithReason extends StringEdit {
  constructor(replacements, reason) {
    super(replacements);
    this.reason = reason;
  }
  static replace(range, newText, source = EditSources.unknown({})) {
    return new StringEditWithReason([new StringReplacement(range, newText)], source);
  }
}
export {
  ObservableWorkspace,
  StringEditWithReason
};
