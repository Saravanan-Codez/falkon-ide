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
import { Event } from "../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize2 } from "../../../../../nls.js";
import { AccessibleViewProviderId } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { accessibleViewCurrentProviderId, accessibleViewIsShown } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { isDetachedTerminalInstance } from "../../../terminal/browser/terminal.js";
import { registerActiveInstanceAction } from "../../../terminal/browser/terminalActions.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { isTerminalProcessManager } from "../../../terminal/common/terminal.js";
import { TerminalContextKeys } from "../../../terminal/common/terminalContextKey.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { TerminalLinksCommandId } from "../common/terminal.links.js";
import { ITerminalLinkProviderService } from "./links.js";
import { TerminalLinkManager } from "./terminalLinkManager.js";
import { TerminalLinkProviderService } from "./terminalLinkProviderService.js";
import { TerminalLinkQuickpick } from "./terminalLinkQuickpick.js";
import { TerminalLinkResolver } from "./terminalLinkResolver.js";
registerSingleton(ITerminalLinkProviderService, TerminalLinkProviderService, InstantiationType.Delayed);
let TerminalLinkContribution = class extends DisposableStore {
  constructor(_ctx, _instantiationService, _terminalLinkProviderService) {
    super();
    this._ctx = _ctx;
    this._instantiationService = _instantiationService;
    this._terminalLinkProviderService = _terminalLinkProviderService;
    this._linkResolver = this._instantiationService.createInstance(TerminalLinkResolver);
  }
  static {
    this.ID = "terminal.link";
  }
  static get(instance) {
    return instance.getContribution(TerminalLinkContribution.ID);
  }
  xtermReady(xterm) {
    const linkManager = this._linkManager = this.add(this._instantiationService.createInstance(TerminalLinkManager, xterm.raw, this._ctx.processManager, this._ctx.instance.capabilities, this._linkResolver));
    if (isTerminalProcessManager(this._ctx.processManager)) {
      const disposable = linkManager.add(Event.once(this._ctx.processManager.onProcessReady)(() => {
        linkManager.setWidgetManager(this._ctx.widgetManager);
        this.delete(disposable);
      }));
    } else {
      linkManager.setWidgetManager(this._ctx.widgetManager);
    }
    if (!isDetachedTerminalInstance(this._ctx.instance)) {
      for (const linkProvider of this._terminalLinkProviderService.linkProviders) {
        linkManager.externalProvideLinksCb = linkProvider.provideLinks.bind(linkProvider, this._ctx.instance);
      }
      linkManager.add(this._terminalLinkProviderService.onDidAddLinkProvider((e) => {
        linkManager.externalProvideLinksCb = e.provideLinks.bind(e, this._ctx.instance);
      }));
    }
    linkManager.add(this._terminalLinkProviderService.onDidRemoveLinkProvider(() => linkManager.externalProvideLinksCb = void 0));
  }
  async showLinkQuickpick(extended) {
    if (!this._terminalLinkQuickpick) {
      this._terminalLinkQuickpick = this.add(this._instantiationService.createInstance(TerminalLinkQuickpick));
      this.add(this._terminalLinkQuickpick.onDidRequestMoreLinks(() => {
        this.showLinkQuickpick(true);
      }));
    }
    const links = await this._getLinks();
    return await this._terminalLinkQuickpick.show(this._ctx.instance, links);
  }
  async _getLinks() {
    if (!this._linkManager) {
      throw new Error("terminal links are not ready, cannot generate link quick pick");
    }
    return this._linkManager.getLinks();
  }
  async openRecentLink(type) {
    if (!this._linkManager) {
      throw new Error("terminal links are not ready, cannot open a link");
    }
    this._linkManager.openRecentLink(type);
  }
};
TerminalLinkContribution = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITerminalLinkProviderService)
], TerminalLinkContribution);
registerTerminalContribution(TerminalLinkContribution.ID, TerminalLinkContribution, true);
const category = terminalStrings.actionCategory;
registerActiveInstanceAction({
  id: TerminalLinksCommandId.OpenDetectedLink,
  title: localize2("workbench.action.terminal.openDetectedLink", "Open Detected Link..."),
  f1: true,
  category,
  precondition: TerminalContextKeys.terminalHasBeenCreated,
  keybinding: [
    {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO,
      weight: KeybindingWeight.WorkbenchContrib + 1,
      when: TerminalContextKeys.focus
    },
    {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG,
      weight: KeybindingWeight.WorkbenchContrib + 1,
      when: ContextKeyExpr.and(accessibleViewIsShown, ContextKeyExpr.equals(accessibleViewCurrentProviderId.key, AccessibleViewProviderId.Terminal))
    }
  ],
  run: (activeInstance) => TerminalLinkContribution.get(activeInstance)?.showLinkQuickpick()
});
registerActiveInstanceAction({
  id: TerminalLinksCommandId.OpenWebLink,
  title: localize2("workbench.action.terminal.openLastUrlLink", "Open Last URL Link"),
  metadata: {
    description: localize2("workbench.action.terminal.openLastUrlLink.description", "Opens the last detected URL/URI link in the terminal")
  },
  f1: true,
  category,
  precondition: TerminalContextKeys.terminalHasBeenCreated,
  run: (activeInstance) => TerminalLinkContribution.get(activeInstance)?.openRecentLink("url")
});
registerActiveInstanceAction({
  id: TerminalLinksCommandId.OpenFileLink,
  title: localize2("workbench.action.terminal.openLastLocalFileLink", "Open Last Local File Link"),
  f1: true,
  category,
  precondition: TerminalContextKeys.terminalHasBeenCreated,
  run: (activeInstance) => TerminalLinkContribution.get(activeInstance)?.openRecentLink("localFile")
});
