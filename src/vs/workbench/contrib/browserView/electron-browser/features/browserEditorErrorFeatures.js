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
import { localize } from "../../../../../nls.js";
import { $, addDisposableListener, EventType } from "../../../../../base/browser/dom.js";
import { ButtonBar } from "../../../../../base/browser/ui/button/button.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { isLinux, isMacintosh } from "../../../../../base/common/platform.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import {
  BrowserEditor,
  BrowserEditorContribution,
  BrowserWidgetLocation
} from "../browserEditor.js";
let BrowserEditorErrorFeatures = class extends BrowserEditorContribution {
  constructor(editor, instantiationService) {
    super(editor);
    this._element = $(".browser-error-container");
    this._certActionButton = this._register(new MutableDisposable());
    this._siteInfoSlot = $(".browser-site-info-slot-wrapper");
    this._urlRenderer = this._register(new CertUrlRenderer());
    this._element.style.display = "none";
    this._content = { location: BrowserWidgetLocation.ContentArea, element: this._element, order: 300 };
    this._siteInfoWidget = this._register(instantiationService.createInstance(SiteInfoWidget, this._siteInfoSlot, editor));
    this._preUrlWidget = { location: BrowserWidgetLocation.PreUrl, element: this._siteInfoSlot, order: 10 };
  }
  get widgets() {
    return [this._content, this._preUrlWidget];
  }
  get urlRenderers() {
    return [this._urlRenderer];
  }
  onModelAttached(model, store) {
    store.add(model.onDidChangeLoadingState(() => this._updateError()));
    store.add(model.onDidNavigate(() => this._updateCertState()));
    this._updateError();
  }
  onModelDetached() {
    this._clearContent();
    this._element.style.display = "none";
    this._siteInfoWidget.setCertificateError(void 0);
    this._urlRenderer.setCertificateError(void 0);
  }
  _updateError() {
    const model = this.editor.model;
    if (!model) {
      return;
    }
    const error = model.error;
    this._updateCertState();
    if (!error) {
      this._element.style.display = "none";
      return;
    }
    this._clearContent();
    this._element.appendChild(this._renderError(error));
    this._element.style.display = "";
  }
  _updateCertState() {
    const model = this.editor.model;
    const cert = model?.certificateError ?? model?.error?.certificateError;
    this._siteInfoWidget.setCertificateError(cert);
    this._urlRenderer.setCertificateError(cert);
  }
  _clearContent() {
    this._certActionButton.clear();
    while (this._element.firstChild) {
      this._element.removeChild(this._element.firstChild);
    }
  }
  _renderError(error) {
    const isCertError = !!error.certificateError;
    const errorContent = $(".browser-error-content");
    const errorIcon = $(".browser-error-icon");
    errorIcon.classList.toggle("cert-error", isCertError);
    errorIcon.appendChild(renderIcon(isCertError ? Codicon.workspaceUntrusted : Codicon.globe));
    const errorTitle = $(".browser-error-title");
    errorTitle.textContent = isCertError ? localize("browser.certErrorLabel", "Certificate Error") : localize("browser.loadErrorLabel", "Failed to Load Page");
    const errorMessage = $(".browser-error-detail");
    const errorText = $("span");
    errorText.textContent = isCertError ? localize("browser.certErrorDescription", "This site's security certificate could not be verified.") : `${error.errorDescription} (${error.errorCode})`;
    errorMessage.appendChild(errorText);
    if (error.certificateError) {
      const extraWarning = $("b.browser-error-detail");
      extraWarning.textContent = localize("browser.certErrorExtraWarning", " Your connection is not private.");
      errorMessage.appendChild(extraWarning);
    }
    if (this.editor.model?.isRemoteSession) {
      const remoteWarning = error.errorCode === -111 || error.errorCode === -324 ? localize("browser.remoteErrorExtraWarning", "This usually means the host could not be found.\nEnsure the URL is correct and the server is accessible from the remote machine.") : "";
      if (remoteWarning) {
        const remoteWarningEl = $(".browser-error-detail.hint");
        remoteWarningEl.textContent = remoteWarning;
        errorMessage.appendChild(remoteWarningEl);
      }
    }
    const errorUrl = $(".browser-error-detail");
    const urlLabel = $("strong");
    urlLabel.textContent = localize("browser.errorUrlLabel", "URL:");
    const urlValue = $("code");
    urlValue.textContent = error.url;
    errorUrl.appendChild(urlLabel);
    errorUrl.appendChild(document.createTextNode(" "));
    errorUrl.appendChild(urlValue);
    errorContent.appendChild(errorIcon);
    errorContent.appendChild(errorTitle);
    errorContent.appendChild(errorMessage);
    errorContent.appendChild(errorUrl);
    if (error.certificateError) {
      errorContent.appendChild(this._renderCertDetails(error.certificateError));
      errorContent.appendChild(this._renderCertActions(error.certificateError));
    }
    return errorContent;
  }
  _renderCertDetails(certError) {
    const certDetailsTable = $(".browser-cert-details-table");
    const heading = $(".browser-cert-details-heading");
    heading.textContent = localize("browser.certDetailsHeading", "Certificate Details");
    certDetailsTable.appendChild(heading);
    const addRow = (label, value) => {
      const row = $(".browser-cert-details-row");
      const labelEl = $(".browser-cert-details-label");
      labelEl.textContent = label;
      const valueEl = $(".browser-cert-details-value");
      valueEl.textContent = value;
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      certDetailsTable.appendChild(row);
    };
    addRow(localize("browser.certError", "Error"), certError.error);
    addRow(localize("browser.certIssuer", "Issuer"), certError.issuerName);
    addRow(localize("browser.certSubject", "Subject"), certError.subjectName);
    const formatDate = (epoch) => new Date(epoch * 1e3).toLocaleDateString();
    addRow(
      localize("browser.certValid", "Valid"),
      `${formatDate(certError.validStart)} - ${formatDate(certError.validExpiry)}`
    );
    addRow(localize("browser.certFingerprint", "Fingerprint"), certError.fingerprint);
    return certDetailsTable;
  }
  _renderCertActions(certError) {
    const actionContainer = $(".browser-cert-action");
    actionContainer.classList.toggle("reverse", isMacintosh || isLinux);
    const canGoBack = this.editor.model?.canGoBack ?? false;
    const buttonBar = new ButtonBar(actionContainer);
    this._certActionButton.value = buttonBar;
    const primaryButton = buttonBar.addButton({ ...defaultButtonStyles });
    primaryButton.label = canGoBack ? localize("browser.certGoBack", "Go Back") : localize("browser.certCloseTab", "Close Tab");
    primaryButton.onDidClick(() => {
      if (canGoBack) {
        this.editor.model?.goBack();
      } else {
        this.editor.closeTab();
      }
    });
    const secondaryButton = buttonBar.addButton({ ...defaultButtonStyles, secondary: true });
    secondaryButton.label = localize("browser.certProceed", "Proceed anyway (unsafe)");
    secondaryButton.onDidClick(() => {
      this.editor.model?.trustCertificate(certError.host, certError.fingerprint);
    });
    return actionContainer;
  }
};
BrowserEditorErrorFeatures = __decorateClass([
  __decorateParam(1, IInstantiationService)
], BrowserEditorErrorFeatures);
class CertUrlRenderer {
  constructor() {
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._hasCertError = false;
  }
  static {
    this.HTTPS_PREFIX = "https:";
  }
  setCertificateError(certError) {
    const next = !!certError;
    if (this._hasCertError === next) {
      return;
    }
    this._hasCertError = next;
    this._onDidChange.fire();
  }
  render(url, container) {
    if (!this._hasCertError || !url.startsWith(CertUrlRenderer.HTTPS_PREFIX)) {
      return false;
    }
    const protocol = document.createElement("span");
    protocol.className = "browser-url-display-protocol-bad";
    protocol.textContent = CertUrlRenderer.HTTPS_PREFIX;
    container.appendChild(protocol);
    const rest = document.createElement("span");
    rest.textContent = url.slice(CertUrlRenderer.HTTPS_PREFIX.length);
    container.appendChild(rest);
    return true;
  }
  dispose() {
    this._onDidChange.dispose();
  }
}
let SiteInfoWidget = class extends Disposable {
  constructor(parent, _editor, _hoverService) {
    super();
    this._editor = _editor;
    this._hoverService = _hoverService;
    this._container = $(".browser-site-info-container");
    this._container.style.display = "none";
    this._indicator = $(".browser-site-info-indicator");
    this._indicator.tabIndex = 0;
    this._indicator.role = "button";
    this._indicator.ariaLabel = localize("browser.notSecure", "Not Secure");
    this._indicator.appendChild(renderIcon(Codicon.workspaceUntrusted));
    this._container.appendChild(this._indicator);
    parent.appendChild(this._container);
    this._register(addDisposableListener(this._indicator, EventType.CLICK, () => this._showHover()));
    this._register(addDisposableListener(this._indicator, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._showHover();
      }
    }));
  }
  /** Update visibility and state from a certificate error (or lack thereof). */
  setCertificateError(certError) {
    this._certError = certError;
    this._container.style.display = certError ? "" : "none";
  }
  _showHover() {
    const certError = this._certError;
    if (!certError) {
      return;
    }
    const content = document.createElement("div");
    content.classList.add("browser-site-info-hover-content");
    const heading = document.createElement("div");
    heading.classList.add("browser-site-info-hover-heading");
    heading.textContent = localize("browser.certHoverHeading", "Certificate Not Trusted");
    content.appendChild(heading);
    const detail1 = document.createElement("div");
    detail1.classList.add("browser-site-info-hover-detail");
    detail1.textContent = localize("browser.certHoverDetail1", "Your connection to this site is not secure.");
    content.appendChild(detail1);
    if (certError.hasTrustedException) {
      const detail2 = document.createElement("div");
      detail2.classList.add("browser-site-info-hover-detail");
      detail2.textContent = localize(
        "browser.certHoverDetail2",
        "You previously chose to proceed to '{0}' despite a certificate error ({1}).",
        certError.host,
        certError.error
      );
      content.appendChild(detail2);
      const revokeLink = document.createElement("a");
      revokeLink.classList.add("browser-site-info-hover-revoke");
      revokeLink.textContent = localize("browser.certRevoke", "Revoke and Close");
      revokeLink.role = "button";
      revokeLink.tabIndex = 0;
      revokeLink.addEventListener("click", () => {
        hover?.dispose();
        this._editor.model?.untrustCertificate(certError.host, certError.fingerprint);
      });
      revokeLink.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          hover?.dispose();
          this._editor.model?.untrustCertificate(certError.host, certError.fingerprint);
        }
      });
      content.appendChild(revokeLink);
    }
    const hover = this._hoverService.showInstantHover({
      content,
      target: this._indicator,
      container: this._container,
      position: { hoverPosition: HoverPosition.BELOW },
      persistence: { sticky: true }
    }, true);
  }
};
SiteInfoWidget = __decorateClass([
  __decorateParam(2, IHoverService)
], SiteInfoWidget);
BrowserEditor.registerContribution(BrowserEditorErrorFeatures);
