import { $, size } from "../../../base/browser/dom.js";
import { ProgressBar } from "../../../base/browser/ui/progressbar/progressbar.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { defaultProgressBarStyles } from "../../../platform/theme/browser/defaultStyles.js";
import { ScopedProgressIndicator } from "../../../workbench/services/progress/browser/progressIndicator.js";
class AbstractChatView extends Disposable {
  constructor() {
    super(...arguments);
    this.element = $(".chat-view");
    this.minimumWidth = 200;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 200;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
  }
  /**
   * Show the given chat in this view. The default implementation is a
   * no-op; subclasses that host a chat widget (e.g. `ChatView`) override
   * this to load the chat model and feed it into the widget.
   */
  setChat(_chat, _historyKey) {
  }
  /**
   * Select a workspace folder in this view's workspace picker. The default
   * implementation is a no-op; subclasses that host a workspace picker
   * (e.g. `NewChatView`) override this to forward the selection.
   */
  selectWorkspace(_folderUri, _providerId) {
  }
  /**
   * Prefill the input with the given text. The default implementation is
   * a no-op; subclasses that host an input widget (e.g. `NewChatView`)
   * override this.
   */
  prefillInput(_text) {
  }
  /**
   * Submit the given text as a chat query. The default implementation is
   * a no-op; subclasses that host an input widget (e.g. `NewChatView`)
   * override this.
   */
  sendQuery(_text) {
  }
  /** Submit the current composer input, returning whether it was sent. */
  submitInput() {
    return Promise.resolve(false);
  }
  /**
   * Attach the given resources as context to this view's chat input. The
   * default implementation is a no-op; subclasses that host a chat widget
   * (e.g. `ChatView`) override this to add the attachments to the widget.
   */
  attach(_uris) {
  }
  /**
   * Notifies the view whether it is the currently active session in the
   * sessions grid. Subclasses may use this to adjust their visual styling
   * (e.g. the chat list's background color). The default implementation
   * is a no-op.
   */
  setActive(_active) {
  }
  /**
   * Notifies the view whether it is currently shown. Unlike {@link setActive},
   * inactive sessions displayed side by side are still visible.
   */
  setVisible(_visible) {
  }
  /**
   * Shows an indeterminate progress bar at the top of this leaf while the
   * given promise is pending, mirroring how each editor group surfaces
   * progress on its own {@link ProgressBar} (see `EditorGroupView` /
   * `ScopedProgressIndicator`). The bar is scoped to this view, so concurrent
   * loads in other grid leaves are unaffected. Overlapping loads on this leaf
   * are joined by the indicator so the bar only hides once all have settled.
   * The optional `delay` avoids flashing the bar for fast (e.g. cached) loads.
   */
  showProgressWhile(promise, delay) {
    if (!this._progressIndicator) {
      const progressBar = this._register(new ProgressBar(this.element, defaultProgressBarStyles));
      progressBar.hide();
      const scope = { isActive: true, onDidChangeActive: Event.None };
      this._progressIndicator = this._register(new ScopedProgressIndicator(progressBar, scope));
    }
    this._progressIndicator.showWhile(promise, delay);
  }
  /**
   * Called by the workbench grid to size this leaf. Sizes {@link element}
   * to the allocated dimensions and then delegates to {@link doLayout} so
   * subclasses can forward sizing to their hosted widget.
   */
  layout(width, height, top, left) {
    size(this.element, width, height);
    this.doLayout(width, height, top, left);
  }
}
export {
  AbstractChatView
};
