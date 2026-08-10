var NotebookViewEventType = /* @__PURE__ */ ((NotebookViewEventType2) => {
  NotebookViewEventType2[NotebookViewEventType2["LayoutChanged"] = 1] = "LayoutChanged";
  NotebookViewEventType2[NotebookViewEventType2["MetadataChanged"] = 2] = "MetadataChanged";
  NotebookViewEventType2[NotebookViewEventType2["CellStateChanged"] = 3] = "CellStateChanged";
  return NotebookViewEventType2;
})(NotebookViewEventType || {});
class NotebookLayoutChangedEvent {
  constructor(source, value) {
    this.source = source;
    this.value = value;
    this.type = 1 /* LayoutChanged */;
  }
}
class NotebookMetadataChangedEvent {
  constructor(source) {
    this.source = source;
    this.type = 2 /* MetadataChanged */;
  }
}
class NotebookCellStateChangedEvent {
  constructor(source, cell) {
    this.source = source;
    this.cell = cell;
    this.type = 3 /* CellStateChanged */;
  }
}
export {
  NotebookCellStateChangedEvent,
  NotebookLayoutChangedEvent,
  NotebookMetadataChangedEvent,
  NotebookViewEventType
};
