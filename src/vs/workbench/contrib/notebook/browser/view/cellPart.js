import * as DOM from "../../../../../base/browser/dom.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
class CellContentPart extends Disposable {
  constructor() {
    super();
    this.cellDisposables = this._register(new DisposableStore());
  }
  /**
   * Prepare model for cell part rendering
   * No DOM operations recommended within this operation
   */
  prepareRenderCell(element) {
  }
  /**
   * Update the DOM for the cell `element`
   */
  renderCell(element) {
    this.currentCell = element;
    safeInvokeNoArg(() => this.didRenderCell(element));
  }
  didRenderCell(element) {
  }
  /**
   * Dispose any disposables generated from `didRenderCell`
   */
  unrenderCell(element) {
    this.currentCell = void 0;
    this.cellDisposables.clear();
  }
  /**
   * Perform DOM read operations to prepare for the list/cell layout update.
   */
  prepareLayout() {
  }
  /**
   * Update internal DOM (top positions) per cell layout info change
   * Note that a cell part doesn't need to call `DOM.scheduleNextFrame`,
   * the list view will ensure that layout call is invoked in the right frame
   */
  updateInternalLayoutNow(element) {
  }
  /**
   * Update per cell state change
   */
  updateState(element, e) {
  }
  /**
   * Update per execution state change.
   */
  updateForExecutionState(element, e) {
  }
}
class CellOverlayPart extends Disposable {
  constructor() {
    super();
    this.cellDisposables = this._register(new DisposableStore());
  }
  /**
   * Prepare model for cell part rendering
   * No DOM operations recommended within this operation
   */
  prepareRenderCell(element) {
  }
  /**
   * Update the DOM for the cell `element`
   */
  renderCell(element) {
    this.currentCell = element;
    this.didRenderCell(element);
  }
  didRenderCell(element) {
  }
  /**
   * Dispose any disposables generated from `didRenderCell`
   */
  unrenderCell(element) {
    this.currentCell = void 0;
    this.cellDisposables.clear();
  }
  /**
   * Update internal DOM (top positions) per cell layout info change
   * Note that a cell part doesn't need to call `DOM.scheduleNextFrame`,
   * the list view will ensure that layout call is invoked in the right frame
   */
  updateInternalLayoutNow(element) {
  }
  /**
   * Update per cell state change
   */
  updateState(element, e) {
  }
  /**
   * Update per execution state change.
   */
  updateForExecutionState(element, e) {
  }
}
function safeInvokeNoArg(func) {
  try {
    return func();
  } catch (e) {
    onUnexpectedError(e);
    return null;
  }
}
class CellPartsCollection extends Disposable {
  constructor(targetWindow, contentParts, overlayParts) {
    super();
    this.targetWindow = targetWindow;
    this.contentParts = contentParts;
    this.overlayParts = overlayParts;
    this._scheduledOverlayRendering = this._register(new MutableDisposable());
    this._scheduledOverlayUpdateState = this._register(new MutableDisposable());
    this._scheduledOverlayUpdateExecutionState = this._register(new MutableDisposable());
  }
  concatContentPart(other, targetWindow) {
    return new CellPartsCollection(targetWindow, this.contentParts.concat(other), this.overlayParts);
  }
  concatOverlayPart(other, targetWindow) {
    return new CellPartsCollection(targetWindow, this.contentParts, this.overlayParts.concat(other));
  }
  scheduleRenderCell(element) {
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.prepareRenderCell(element));
    }
    for (const part of this.overlayParts) {
      safeInvokeNoArg(() => part.prepareRenderCell(element));
    }
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.renderCell(element));
    }
    this._scheduledOverlayRendering.value = DOM.modify(this.targetWindow, () => {
      for (const part of this.overlayParts) {
        safeInvokeNoArg(() => part.renderCell(element));
      }
    });
  }
  unrenderCell(element) {
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.unrenderCell(element));
    }
    this._scheduledOverlayRendering.value = void 0;
    this._scheduledOverlayUpdateState.value = void 0;
    this._scheduledOverlayUpdateExecutionState.value = void 0;
    for (const part of this.overlayParts) {
      safeInvokeNoArg(() => part.unrenderCell(element));
    }
  }
  updateInternalLayoutNow(viewCell) {
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.updateInternalLayoutNow(viewCell));
    }
    for (const part of this.overlayParts) {
      safeInvokeNoArg(() => part.updateInternalLayoutNow(viewCell));
    }
  }
  prepareLayout() {
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.prepareLayout());
    }
  }
  updateState(viewCell, e) {
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.updateState(viewCell, e));
    }
    this._scheduledOverlayUpdateState.value = DOM.modify(this.targetWindow, () => {
      for (const part of this.overlayParts) {
        safeInvokeNoArg(() => part.updateState(viewCell, e));
      }
    });
  }
  updateForExecutionState(viewCell, e) {
    for (const part of this.contentParts) {
      safeInvokeNoArg(() => part.updateForExecutionState(viewCell, e));
    }
    this._scheduledOverlayUpdateExecutionState.value = DOM.modify(this.targetWindow, () => {
      for (const part of this.overlayParts) {
        safeInvokeNoArg(() => part.updateForExecutionState(viewCell, e));
      }
    });
  }
}
export {
  CellContentPart,
  CellOverlayPart,
  CellPartsCollection
};
