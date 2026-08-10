import { ActionRunner } from "../../base/common/actions.js";
import { Component } from "../common/component.js";
import { Emitter } from "../../base/common/event.js";
import { trackFocus } from "../../base/browser/dom.js";
import { Disposable } from "../../base/common/lifecycle.js";
import { assertReturnsDefined } from "../../base/common/types.js";
class Composite extends Component {
  constructor(id, telemetryService, themeService, storageService) {
    super(id, themeService, storageService);
    this.telemetryService = telemetryService;
    this._onTitleAreaUpdate = this._register(new Emitter());
    this.onTitleAreaUpdate = this._onTitleAreaUpdate.event;
    this._hasFocus = false;
    this.visible = false;
  }
  get onDidFocus() {
    if (!this._onDidFocus) {
      this._onDidFocus = this.registerFocusTrackEvents().onDidFocus;
    }
    return this._onDidFocus.event;
  }
  get onDidBlur() {
    if (!this._onDidBlur) {
      this._onDidBlur = this.registerFocusTrackEvents().onDidBlur;
    }
    return this._onDidBlur.event;
  }
  hasFocus() {
    return this._hasFocus;
  }
  registerFocusTrackEvents() {
    const container = assertReturnsDefined(this.getContainer());
    const focusTracker = this._register(trackFocus(container));
    const onDidFocus = this._onDidFocus = this._register(new Emitter());
    this._register(focusTracker.onDidFocus(() => {
      this._hasFocus = true;
      onDidFocus.fire();
    }));
    const onDidBlur = this._onDidBlur = this._register(new Emitter());
    this._register(focusTracker.onDidBlur(() => {
      this._hasFocus = false;
      onDidBlur.fire();
    }));
    return { onDidFocus, onDidBlur };
  }
  getTitle() {
    return void 0;
  }
  /**
   * Note: Clients should not call this method, the workbench calls this
   * method. Calling it otherwise may result in unexpected behavior.
   *
   * Called to create this composite on the provided parent. This method is only
   * called once during the lifetime of the workbench.
   * Note that DOM-dependent calculations should be performed from the setVisible()
   * call. Only then the composite will be part of the DOM.
   */
  create(parent) {
    this.parent = parent;
  }
  /**
   * Returns the container this composite is being build in.
   */
  getContainer() {
    return this.parent;
  }
  /**
   * Note: Clients should not call this method, the workbench calls this
   * method. Calling it otherwise may result in unexpected behavior.
   *
   * Called to indicate that the composite has become visible or hidden. This method
   * is called more than once during workbench lifecycle depending on the user interaction.
   * The composite will be on-DOM if visible is set to true and off-DOM otherwise.
   *
   * Typically this operation should be fast though because setVisible might be called many times during a session.
   * If there is a long running operation it is fine to have it running in the background asyncly and return before.
   */
  setVisible(visible) {
    if (this.visible !== !!visible) {
      this.visible = visible;
    }
  }
  /**
   * Called when this composite should receive keyboard focus.
   */
  focus() {
  }
  /**
   *
   * @returns the action runner for this composite
   */
  getMenuIds() {
    return [];
  }
  /**
   * Returns an array of actions to show in the action bar of the composite.
   */
  getActions() {
    return [];
  }
  /**
   * Returns an array of actions to show in the action bar of the composite
   * in a less prominent way then action from getActions.
   */
  getSecondaryActions() {
    return [];
  }
  /**
   * Returns an array of actions to show in the context menu of the composite
   */
  getContextMenuActions() {
    return [];
  }
  /**
   * For any of the actions returned by this composite, provide an IActionViewItem in
   * cases where the implementor of the composite wants to override the presentation
   * of an action. Returns undefined to indicate that the action is not rendered through
   * an action item.
   */
  getActionViewItem(action, options) {
    return void 0;
  }
  /**
   * Provide a context to be passed to the toolbar.
   */
  getActionsContext() {
    return null;
  }
  /**
   * Returns the instance of IActionRunner to use with this composite for the
   * composite tool bar.
   */
  getActionRunner() {
    if (!this.actionRunner) {
      this.actionRunner = this._register(new ActionRunner());
    }
    return this.actionRunner;
  }
  /**
   * Method for composite implementors to indicate to the composite container that the title or the actions
   * of the composite have changed. Calling this method will cause the container to ask for title (getTitle())
   * and actions (getActions(), getSecondaryActions()) if the composite is visible or the next time the composite
   * gets visible.
   */
  updateTitleArea() {
    this._onTitleAreaUpdate.fire();
  }
  /**
   * Returns true if this composite is currently visible and false otherwise.
   */
  isVisible() {
    return this.visible;
  }
  /**
   * Returns the underlying composite control or `undefined` if it is not accessible.
   */
  getControl() {
    return void 0;
  }
}
class CompositeDescriptor {
  constructor(ctor, id, name, cssClass, order, requestedIndex) {
    this.ctor = ctor;
    this.id = id;
    this.name = name;
    this.cssClass = cssClass;
    this.order = order;
    this.requestedIndex = requestedIndex;
  }
  instantiate(instantiationService) {
    return instantiationService.createInstance(this.ctor);
  }
}
class CompositeRegistry extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidRegister = this._register(new Emitter());
    this.onDidRegister = this._onDidRegister.event;
    this._onDidDeregister = this._register(new Emitter());
    this.onDidDeregister = this._onDidDeregister.event;
    this.composites = [];
  }
  registerComposite(descriptor) {
    if (this.compositeById(descriptor.id)) {
      return;
    }
    this.composites.push(descriptor);
    this._onDidRegister.fire(descriptor);
  }
  deregisterComposite(id) {
    const descriptor = this.compositeById(id);
    if (!descriptor) {
      return;
    }
    this.composites.splice(this.composites.indexOf(descriptor), 1);
    this._onDidDeregister.fire(descriptor);
  }
  getComposite(id) {
    return this.compositeById(id);
  }
  getComposites() {
    return this.composites.slice(0);
  }
  compositeById(id) {
    return this.composites.find((composite) => composite.id === id);
  }
}
export {
  Composite,
  CompositeDescriptor,
  CompositeRegistry
};
