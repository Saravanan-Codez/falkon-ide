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
import { DisposableMap, DisposableStore, Disposable } from "../../../../base/common/lifecycle.js";
import { AccessibleViewType, ExtensionContentProvider } from "../../../../platform/accessibility/browser/accessibleView.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { Extensions } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
let ExtensionAccessibilityHelpDialogContribution = class extends Disposable {
  constructor(keybindingService) {
    super();
    this._viewHelpDialogMap = this._register(new DisposableMap());
    this._register(Registry.as(Extensions.ViewsRegistry).onViewsRegistered((e) => {
      for (const view of e) {
        for (const viewDescriptor of view.views) {
          if (viewDescriptor.accessibilityHelpContent) {
            this._viewHelpDialogMap.set(viewDescriptor.id, registerAccessibilityHelpAction(keybindingService, viewDescriptor));
          }
        }
      }
    }));
    this._register(Registry.as(Extensions.ViewsRegistry).onViewsDeregistered((e) => {
      for (const viewDescriptor of e.views) {
        if (viewDescriptor.accessibilityHelpContent) {
          this._viewHelpDialogMap.get(viewDescriptor.id)?.dispose();
        }
      }
    }));
  }
  static {
    this.ID = "extensionAccessibilityHelpDialogContribution";
  }
};
ExtensionAccessibilityHelpDialogContribution = __decorateClass([
  __decorateParam(0, IKeybindingService)
], ExtensionAccessibilityHelpDialogContribution);
function registerAccessibilityHelpAction(keybindingService, viewDescriptor) {
  const disposableStore = new DisposableStore();
  const content = viewDescriptor.accessibilityHelpContent?.value;
  if (!content) {
    throw new Error("No content provided for the accessibility help dialog");
  }
  disposableStore.add(AccessibleViewRegistry.register({
    priority: 95,
    name: viewDescriptor.id,
    type: AccessibleViewType.Help,
    when: FocusedViewContext.isEqualTo(viewDescriptor.id),
    getProvider: (accessor) => {
      const viewsService = accessor.get(IViewsService);
      return new ExtensionContentProvider(
        viewDescriptor.id,
        { type: AccessibleViewType.Help },
        () => content,
        () => viewsService.openView(viewDescriptor.id, true)
      );
    }
  }));
  disposableStore.add(keybindingService.onDidUpdateKeybindings(() => {
    disposableStore.clear();
    disposableStore.add(registerAccessibilityHelpAction(keybindingService, viewDescriptor));
  }));
  return disposableStore;
}
export {
  ExtensionAccessibilityHelpDialogContribution
};
