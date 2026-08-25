import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { PromptLaunchersAICustomizationWelcomePage } from "./aiCustomizationWelcomePagePromptLaunchers.js";
const $ = DOM.$;
class AICustomizationWelcomePage extends Disposable {
  constructor(parent, welcomePageFeatures, callbacks, commandService, workspaceService, hoverService, harnessLabel) {
    super();
    this.container = DOM.append(parent, $(".welcome-page-host"));
    this.container.style.height = "100%";
    this.container.style.overflow = "hidden";
    this.implementation = this._register(new PromptLaunchersAICustomizationWelcomePage(this.container, welcomePageFeatures, callbacks, commandService, workspaceService, hoverService, harnessLabel));
  }
  rebuildCards(visibleSectionIds) {
    this.implementation.rebuildCards(visibleSectionIds);
  }
  setHarnessLabel(label) {
    this.implementation.setHarnessLabel(label);
  }
  setPromptMigrationInfo(info) {
    this.implementation.setPromptMigrationInfo(info);
  }
  focus() {
    this.implementation.focus();
  }
  reset() {
    this.implementation.reset?.();
  }
}
export {
  AICustomizationWelcomePage
};
