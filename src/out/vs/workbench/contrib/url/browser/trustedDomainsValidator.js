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
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import Severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { ITrustedDomainService } from "./trustedDomainService.js";
import { isURLDomainTrusted } from "../../../../platform/url/common/trustedDomains.js";
import { configureOpenerTrustedDomainsHandler, readStaticTrustedDomains } from "./trustedDomains.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
let OpenerValidatorContributions = class {
  constructor(_openerService, _storageService, _dialogService, _productService, _quickInputService, _editorService, _clipboardService, _telemetryService, _instantiationService, _configurationService, _workspaceTrustService, _trustedDomainService) {
    this._openerService = _openerService;
    this._storageService = _storageService;
    this._dialogService = _dialogService;
    this._productService = _productService;
    this._quickInputService = _quickInputService;
    this._editorService = _editorService;
    this._clipboardService = _clipboardService;
    this._telemetryService = _telemetryService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._workspaceTrustService = _workspaceTrustService;
    this._trustedDomainService = _trustedDomainService;
    this._openerService.registerValidator({ shouldOpen: (uri, options) => this.validateLink(uri, options) });
  }
  async validateLink(resource, openOptions) {
    if (!matchesScheme(resource, Schemas.http) && !matchesScheme(resource, Schemas.https)) {
      return true;
    }
    if (openOptions?.fromWorkspace && this._workspaceTrustService.isWorkspaceTrusted() && !this._configurationService.getValue("workbench.trustedDomains.promptInTrustedWorkspace")) {
      return true;
    }
    const originalResource = resource;
    let resourceUri;
    if (typeof resource === "string") {
      resourceUri = URI.parse(resource);
    } else {
      resourceUri = resource;
    }
    if (this._trustedDomainService.isValid(resourceUri)) {
      return true;
    } else {
      const { scheme, authority, path, query, fragment } = resourceUri;
      let formattedLink = `${scheme}://${authority}${path}`;
      const linkTail = `${query ? "?" + query : ""}${fragment ? "#" + fragment : ""}`;
      const remainingLength = Math.max(0, 60 - formattedLink.length);
      const linkTailLengthToKeep = Math.min(Math.max(5, remainingLength), linkTail.length);
      if (linkTailLengthToKeep === linkTail.length) {
        formattedLink += linkTail;
      } else {
        formattedLink += linkTail.charAt(0) + "..." + linkTail.substring(linkTail.length - linkTailLengthToKeep + 1);
      }
      const { result } = await this._dialogService.prompt({
        type: Severity.Info,
        message: localize(
          "openExternalLinkAt",
          "Do you want {0} to open the external website?",
          this._productService.nameShort
        ),
        detail: typeof originalResource === "string" ? originalResource : formattedLink,
        buttons: [
          {
            label: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open"),
            run: () => true
          },
          {
            label: localize({ key: "copy", comment: ["&& denotes a mnemonic"] }, "&&Copy"),
            run: () => {
              this._clipboardService.writeText(typeof originalResource === "string" ? originalResource : resourceUri.toString(true));
              return false;
            }
          },
          {
            label: localize({ key: "configureTrustedDomains", comment: ["&& denotes a mnemonic"] }, "Configure &&Trusted Domains"),
            run: async () => {
              const { trustedDomains } = this._instantiationService.invokeFunction(readStaticTrustedDomains);
              const domainToOpen = `${scheme}://${authority}`;
              const pickedDomains = await configureOpenerTrustedDomainsHandler(
                trustedDomains,
                domainToOpen,
                resourceUri,
                this._quickInputService,
                this._storageService,
                this._editorService,
                this._telemetryService
              );
              if (pickedDomains.indexOf("*") !== -1) {
                return true;
              }
              if (isURLDomainTrusted(resourceUri, pickedDomains)) {
                return true;
              }
              return false;
            }
          }
        ],
        cancelButton: {
          run: () => false
        }
      });
      return result;
    }
  }
};
OpenerValidatorContributions = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IClipboardService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IWorkspaceTrustManagementService),
  __decorateParam(11, ITrustedDomainService)
], OpenerValidatorContributions);
export {
  OpenerValidatorContributions
};
