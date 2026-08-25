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
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { localize } from "../../../../nls.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { allApiProposals } from "../../../../platform/extensions/common/extensionsApiProposals.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { Extensions } from "../../extensionManagement/common/extensionFeatures.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
let ExtensionsProposedApi = class {
  constructor(_logService, _environmentService, productService) {
    this._logService = _logService;
    this._environmentService = _environmentService;
    this._envEnabledExtensions = new Set((_environmentService.extensionEnabledProposedApi ?? []).map((id) => ExtensionIdentifier.toKey(id)));
    this._envEnablesProposedApiForAll = !_environmentService.isBuilt || // always allow proposed API when running out of sources
    _environmentService.isExtensionDevelopment && productService.quality !== "stable" || // do not allow proposed API against stable builds when developing an extension
    this._envEnabledExtensions.size === 0 && Array.isArray(_environmentService.extensionEnabledProposedApi);
    this._productEnabledExtensions = /* @__PURE__ */ new Map();
    if (productService.extensionEnabledApiProposals) {
      for (const [k, value] of Object.entries(productService.extensionEnabledApiProposals)) {
        const key = ExtensionIdentifier.toKey(k);
        const proposalNames = value.filter((name) => {
          if (!allApiProposals[name]) {
            _logService.warn(`Via 'product.json#extensionEnabledApiProposals' extension '${key}' wants API proposal '${name}' but that proposal DOES NOT EXIST. Likely, the proposal has been finalized (check 'vscode.d.ts') or was abandoned.`);
            return false;
          }
          return true;
        });
        this._productEnabledExtensions.set(key, proposalNames);
      }
    }
  }
  updateEnabledApiProposals(extensions) {
    for (const extension of extensions) {
      this.doUpdateEnabledApiProposals(extension);
    }
  }
  doUpdateEnabledApiProposals(extension) {
    const key = ExtensionIdentifier.toKey(extension.identifier);
    if (isNonEmptyArray(extension.enabledApiProposals)) {
      extension.enabledApiProposals = extension.enabledApiProposals.filter((name) => {
        const result = Boolean(allApiProposals[name]);
        if (!result) {
          this._logService.error(`Extension '${key}' wants API proposal '${name}' but that proposal DOES NOT EXIST. Likely, the proposal has been finalized (check 'vscode.d.ts') or was abandoned.`);
        }
        return result;
      });
    }
    if (this._productEnabledExtensions.has(key)) {
      const productEnabledProposals = this._productEnabledExtensions.get(key);
      const productSet = new Set(productEnabledProposals);
      const extensionSet = new Set(extension.enabledApiProposals);
      const diff = new Set([...extensionSet].filter((a) => !productSet.has(a)));
      if (diff.size > 0) {
        this._logService.error(`Extension '${key}' appears in product.json but enables LESS API proposals than the extension wants.
package.json (LOSES): ${[...extensionSet].join("\n")}
product.json (WINS): ${[...productSet].join("\n")}
DELTA: ${[...diff].join("\n")}`);
        if (this._environmentService.isExtensionDevelopment) {
          this._logService.error(`Proceeding with EXTRA proposals (${[...diff].join(", ")}) because extension is in development mode. Still, this EXTENSION WILL BE BROKEN unless product.json is updated.`);
          productEnabledProposals.push(...diff);
        }
      }
      extension.enabledApiProposals = productEnabledProposals;
      return;
    }
    if (this._envEnablesProposedApiForAll || this._envEnabledExtensions.has(key)) {
      return;
    }
    if (!extension.isBuiltin && isNonEmptyArray(extension.enabledApiProposals)) {
      this._logService.error(`Extension '${extension.identifier.value} CANNOT USE these API proposals '${extension.enabledApiProposals?.join(", ") || "*"}'. You MUST start in extension development mode or use the --enable-proposed-api command line flag`);
      extension.enabledApiProposals = [];
    }
  }
};
ExtensionsProposedApi = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IProductService)
], ExtensionsProposedApi);
class ApiProposalsMarkdowneRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "markdown";
  }
  shouldRender(manifest) {
    return !!manifest.originalEnabledApiProposals?.length || !!manifest.enabledApiProposals?.length;
  }
  render(manifest) {
    const enabledApiProposals = manifest.originalEnabledApiProposals ?? manifest.enabledApiProposals ?? [];
    const data = new MarkdownString();
    if (enabledApiProposals.length) {
      for (const proposal of enabledApiProposals) {
        data.appendMarkdown(`- \`${proposal}\`
`);
      }
    }
    return {
      data,
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "enabledApiProposals",
  label: localize("enabledProposedAPIs", "API Proposals"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ApiProposalsMarkdowneRenderer)
});
export {
  ExtensionsProposedApi
};
