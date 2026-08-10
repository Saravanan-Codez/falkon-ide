var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { addDisposableListener, EventType, setVisibility, trackFocus } from "../../../../../../base/browser/dom.js";
import { alert } from "../../../../../../base/browser/ui/aria/aria.js";
import { StandardKeyboardEvent } from "../../../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
let ChatInputOnboarding = class extends Disposable {
  constructor(options, storageService) {
    super();
    this.options = options;
    this.storageService = storageService;
    this.hosts = /* @__PURE__ */ new Set();
    this.currentOnboarding = this._register(new MutableDisposable());
  }
  get isVisible() {
    return !!this.currentOnboarding.value;
  }
  registerHost(container, focusRoot, focus, tipContainer, onDidChangeVisible) {
    const host = {
      container,
      focusRoot,
      focus,
      tipContainer,
      onDidChangeVisible,
      lastFocused: 0
    };
    this.hosts.add(host);
    const focusTracker = trackFocus(focusRoot);
    const focusListener = focusTracker.onDidFocus(() => host.lastFocused = Date.now());
    return toDisposable(() => {
      focusListener.dispose();
      focusTracker.dispose();
      this.hosts.delete(host);
      if (this.activeHost === host) {
        this.hide(false);
      }
    });
  }
  showIfNeeded(createOnboarding) {
    if (this.currentOnboarding.value) {
      return true;
    }
    if (this.storageService.getBoolean(this.options.storageKey, StorageScope.APPLICATION, false)) {
      return false;
    }
    return this.show(createOnboarding);
  }
  show(createOnboarding) {
    const host = this.getActiveHost();
    if (!host) {
      return false;
    }
    this.hide(false);
    this.activeHost = host;
    const onboardingStore = new DisposableStore();
    host.container.classList.add(this.options.hostClass);
    onboardingStore.add(toDisposable(() => host.container.classList.remove(this.options.hostClass)));
    let banner;
    try {
      banner = createOnboarding({
        container: host.container,
        dismiss: (restoreFocus = true) => this.hide(restoreFocus)
      });
      onboardingStore.add(banner);
    } catch (error) {
      this.activeHost = void 0;
      onboardingStore.dispose();
      throw error;
    }
    this.currentOnboarding.value = onboardingStore;
    this.setTipsVisible(host, false);
    host.onDidChangeVisible?.(true);
    this.storageService.store(this.options.storageKey, true, StorageScope.APPLICATION, StorageTarget.USER);
    banner.announce();
    return true;
  }
  getActiveHost() {
    const visibleHosts = [...this.hosts].filter((host) => host.container.isConnected && host.focusRoot.getClientRects().length > 0);
    if (visibleHosts.length === 0) {
      return void 0;
    }
    return visibleHosts.reduce((mostRecent, host) => host.lastFocused > mostRecent.lastFocused ? host : mostRecent);
  }
  hide(restoreFocus) {
    const host = this.activeHost;
    const wasVisible = this.isVisible;
    this.activeHost = void 0;
    this.currentOnboarding.clear();
    if (wasVisible) {
      this.setTipsVisible(host, true);
      host?.onDidChangeVisible?.(false);
    }
    if (restoreFocus) {
      host?.focus?.();
    }
  }
  setTipsVisible(host, visible) {
    if (host?.tipContainer) {
      setVisibility(visible, host.tipContainer);
    }
  }
};
ChatInputOnboarding = __decorateClass([
  __decorateParam(1, IStorageService)
], ChatInputOnboarding);
class ChatInputOnboardingCard extends Disposable {
  constructor(options) {
    super();
    this.ariaLabel = options.ariaLabel;
    this.domNode = options.container.ownerDocument.createElement("div");
    this.domNode.classList.add(options.className);
    this.domNode.setAttribute("role", "region");
    this.domNode.setAttribute("aria-label", options.ariaLabel);
    if (options.ariaDescription) {
      this.domNode.setAttribute("aria-description", options.ariaDescription);
    }
    options.container.appendChild(this.domNode);
    this._register(toDisposable(() => this.domNode.remove()));
    this.domNode.tabIndex = 0;
    this._register(addDisposableListener(this.domNode, EventType.KEY_DOWN, (event) => {
      const keyboardEvent = new StandardKeyboardEvent(event);
      if (keyboardEvent.equals(KeyCode.Escape)) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        options.onEscape();
      }
    }));
  }
  announce() {
    alert(localize("chatInputOnboarding.focusHint", "{0}. Use Shift+Tab to reach the introduction.", this.ariaLabel));
  }
  addAction(options) {
    const action = this.domNode.ownerDocument.createElement("div");
    action.classList.add(options.className);
    action.setAttribute("role", "button");
    action.tabIndex = 0;
    action.setAttribute("aria-label", options.ariaLabel);
    const icon = this.domNode.ownerDocument.createElement("span");
    icon.classList.add(...ThemeIcon.asClassNameArray(options.icon));
    icon.setAttribute("aria-hidden", "true");
    action.appendChild(icon);
    this.domNode.appendChild(action);
    const activate = () => options.onActivate();
    this._register(addDisposableListener(action, EventType.CLICK, activate));
    this._register(addDisposableListener(action, EventType.KEY_DOWN, (event) => {
      const keyboardEvent = new StandardKeyboardEvent(event);
      if (keyboardEvent.equals(KeyCode.Enter) || keyboardEvent.equals(KeyCode.Space)) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        activate();
      }
    }));
    return action;
  }
}
export {
  ChatInputOnboarding,
  ChatInputOnboardingCard
};
