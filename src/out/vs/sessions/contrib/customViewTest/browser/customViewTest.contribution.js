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
import "./media/customViewTest.css";
import { $ } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { constObservable } from "../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IsDevelopmentContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../workbench/common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Menus } from "../../../browser/menus.js";
import { AbstractCustomView } from "../../../services/customView/browser/customView.js";
import { ICustomViewService } from "../../../services/customView/browser/customViewService.js";
const TEST_CUSTOM_VIEW_ID = "sessions.customView.test";
class TestCustomView extends AbstractCustomView {
  constructor() {
    super(...arguments);
    this.title = constObservable(localize("testCustomView.title", "Test Custom View"));
    this.description = constObservable(
      localize("testCustomView.description", "A placeholder view used to verify the custom view grid layout, header and scrolling.")
    );
  }
  static {
    this.ITEM_COUNT = 40;
  }
  render(container) {
    for (let i = 0; i < TestCustomView.ITEM_COUNT; i++) {
      container.appendChild($(".custom-view-test-item", void 0, localize("testCustomView.item", "Item {0}", i + 1)));
    }
  }
  layout(_width, _height) {
  }
}
let TestCustomViewContribution = class extends Disposable {
  static {
    this.ID = "sessions.contrib.customViewTest";
  }
  constructor(customViewService) {
    super();
    this._register(customViewService.registerCustomView({
      id: TEST_CUSTOM_VIEW_ID,
      ctor: new SyncDescriptor(TestCustomView),
      actions: { style: "toolbar", menuId: Menus.CustomViewTest }
    }));
  }
};
TestCustomViewContribution = __decorateClass([
  __decorateParam(0, ICustomViewService)
], TestCustomViewContribution);
registerWorkbenchContribution2(TestCustomViewContribution.ID, TestCustomViewContribution, WorkbenchPhase.BlockRestore);
class ShowTestCustomViewAction extends Action2 {
  constructor() {
    super({
      id: "sessions.customView.showTestView",
      title: localize2("showTestCustomView", "Show Test Custom View"),
      category: Categories.Developer,
      f1: true,
      precondition: IsDevelopmentContext
    });
  }
  run(accessor) {
    accessor.get(ICustomViewService).showCustomView(TEST_CUSTOM_VIEW_ID);
  }
}
class HideTestCustomViewAction extends Action2 {
  constructor() {
    super({
      id: "sessions.customView.hideTestView",
      title: localize2("hideTestCustomView", "Hide Test Custom View"),
      category: Categories.Developer,
      f1: true,
      precondition: IsDevelopmentContext
    });
  }
  run(accessor) {
    accessor.get(ICustomViewService).hideCustomView();
  }
}
class TestCustomViewPingAction extends Action2 {
  constructor() {
    super({
      id: "sessions.customView.testView.ping",
      title: localize2("testCustomViewPing", "Ping Test Custom View"),
      icon: Codicon.debugAlt,
      menu: [{ id: Menus.CustomViewTest, group: "navigation", order: 1 }]
    });
  }
  run(accessor) {
    accessor.get(INotificationService).info(localize("testCustomViewPinged", "Test custom view action ran."));
  }
}
registerAction2(ShowTestCustomViewAction);
registerAction2(HideTestCustomViewAction);
registerAction2(TestCustomViewPingAction);
