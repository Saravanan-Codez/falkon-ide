import * as DOM from "../../../../../base/browser/dom.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
const $ = DOM.$;
var GalleryItemInstallState = /* @__PURE__ */ ((GalleryItemInstallState2) => {
  GalleryItemInstallState2[GalleryItemInstallState2["Uninstalled"] = 0] = "Uninstalled";
  GalleryItemInstallState2[GalleryItemInstallState2["Installing"] = 1] = "Installing";
  GalleryItemInstallState2[GalleryItemInstallState2["Installed"] = 2] = "Installed";
  return GalleryItemInstallState2;
})(GalleryItemInstallState || {});
class GalleryItemRenderer {
  constructor(templateId, _provider) {
    this.templateId = templateId;
    this._provider = _provider;
  }
  renderTemplate(container) {
    container.classList.add("gallery-item");
    const details = DOM.append(container, $(".gallery-item-details"));
    const name = DOM.append(details, $("span.gallery-item-name"));
    const description = DOM.append(details, $("span.gallery-item-description"));
    const publisher = DOM.append(details, $("span.gallery-item-publisher"));
    const actionContainer = DOM.append(container, $(".gallery-item-action"));
    const installButton = new Button(actionContainer, { ...defaultButtonStyles, supportIcons: true });
    const templateDisposables = new DisposableStore();
    templateDisposables.add(installButton);
    return { name, publisher, description, installButton, elementDisposables: new DisposableStore(), templateDisposables };
  }
  renderElement(element, _index, templateData) {
    templateData.elementDisposables.clear();
    templateData.name.textContent = this._provider.getLabel(element);
    const publisher = this._provider.getPublisherDisplayName(element);
    templateData.publisher.textContent = publisher ? localize("galleryItemBy", "by {0}", publisher) : "";
    templateData.description.textContent = this._provider.getDescription(element) || "";
    this._updateInstallButton(templateData.installButton, element);
    templateData.elementDisposables.add(templateData.installButton.onDidClick(async () => {
      if (this._provider.getInstallState(element) !== 0 /* Uninstalled */) {
        return;
      }
      if (this._provider.canInstall && !this._provider.canInstall(element)) {
        return;
      }
      templateData.installButton.label = localize("galleryItemInstalling", "Installing...");
      templateData.installButton.enabled = false;
      try {
        await this._provider.install(element);
      } finally {
        this._updateInstallButton(templateData.installButton, element);
      }
    }));
    const changeListener = this._provider.onDidChangeInstallState?.(element, () => this._updateInstallButton(templateData.installButton, element));
    if (changeListener) {
      templateData.elementDisposables.add(changeListener);
    }
  }
  _updateInstallButton(button, element) {
    switch (this._provider.getInstallState(element)) {
      case 2 /* Installed */:
        button.label = localize("galleryItemInstalled", "Installed");
        button.enabled = false;
        break;
      case 1 /* Installing */:
        button.label = localize("galleryItemInstalling", "Installing...");
        button.enabled = false;
        break;
      default:
        button.label = localize("galleryItemInstall", "Install");
        button.enabled = true;
        break;
    }
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.templateDisposables.dispose();
  }
}
export {
  GalleryItemInstallState,
  GalleryItemRenderer
};
