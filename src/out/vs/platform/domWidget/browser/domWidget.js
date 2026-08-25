import { isHotReloadEnabled } from "../../../base/common/hotReload.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, observableValue } from "../../../base/common/observable.js";
class DomWidget extends Disposable {
  /**
   * Appends the widget to the provided DOM element.
  */
  static createAppend(dom, store, ...params) {
    if (!isHotReloadEnabled()) {
      const widget = new this(...params);
      dom.appendChild(widget.element);
      store.add(widget);
      return;
    }
    const observable = this.createObservable(store, ...params);
    store.add(autorun((reader) => {
      const widget = observable.read(reader);
      dom.appendChild(widget.element);
      reader.store.add(toDisposable(() => widget.element.remove()));
      reader.store.add(widget);
    }));
  }
  /**
   * Creates the widget in a new div element with "display: contents".
  */
  static createInContents(store, ...params) {
    const div = document.createElement("div");
    div.style.display = "contents";
    this.createAppend(div, store, ...params);
    return div;
  }
  /**
   * Creates an observable instance of the widget.
   * The observable will change when hot module replacement occurs.
  */
  static createObservable(store, ...params) {
    if (!isHotReloadEnabled()) {
      return constObservable(new this(...params));
    }
    const id = this[_hotReloadId];
    const observable = id ? hotReloadedWidgets.get(id) : void 0;
    if (!observable) {
      return constObservable(new this(...params));
    }
    return derived((reader) => {
      const Ctor = observable.read(reader);
      return new Ctor(...params);
    });
  }
  /**
   * Appends the widget to the provided DOM element.
  */
  static instantiateAppend(instantiationService, dom, store, ...params) {
    if (!isHotReloadEnabled()) {
      const widget = instantiationService.createInstance(this, ...params);
      dom.appendChild(widget.element);
      store.add(widget);
      return;
    }
    const observable = this.instantiateObservable(instantiationService, store, ...params);
    let lastWidget = void 0;
    store.add(autorun((reader) => {
      const widget = observable.read(reader);
      if (lastWidget) {
        lastWidget.element.replaceWith(widget.element);
      } else {
        dom.appendChild(widget.element);
      }
      lastWidget = widget;
      reader.delayedStore.add(widget);
    }));
  }
  /**
   * Creates the widget in a new div element with "display: contents".
   * If possible, prefer `instantiateAppend`, as it avoids an extra div in the DOM.
  */
  static instantiateInContents(instantiationService, store, ...params) {
    const div = document.createElement("div");
    div.style.display = "contents";
    this.instantiateAppend(instantiationService, div, store, ...params);
    return div;
  }
  /**
   * Creates an observable instance of the widget.
   * The observable will change when hot module replacement occurs.
  */
  static instantiateObservable(instantiationService, store, ...params) {
    if (!isHotReloadEnabled()) {
      return constObservable(instantiationService.createInstance(this, ...params));
    }
    const id = this[_hotReloadId];
    const observable = id ? hotReloadedWidgets.get(id) : void 0;
    if (!observable) {
      return constObservable(instantiationService.createInstance(this, ...params));
    }
    return derived((reader) => {
      const Ctor = observable.read(reader);
      return instantiationService.createInstance(Ctor, ...params);
    });
  }
  /**
   * @deprecated Do not call manually! Only for use by the hot reload system (a vite plugin will inject calls to this method in dev mode).
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static registerWidgetHotReplacement(id) {
    if (!isHotReloadEnabled()) {
      return;
    }
    let observable = hotReloadedWidgets.get(id);
    if (!observable) {
      observable = observableValue(id, this);
      hotReloadedWidgets.set(id, observable);
    } else {
      observable.set(this, void 0);
    }
    this[_hotReloadId] = id;
  }
}
const _hotReloadId = /* @__PURE__ */ Symbol("DomWidgetHotReloadId");
const hotReloadedWidgets = /* @__PURE__ */ new Map();
export {
  DomWidget
};
