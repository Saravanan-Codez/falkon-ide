import { env } from "../../../base/common/process.js";
function getDependencyVersion(packageConfiguration, packageName) {
  return packageConfiguration.dependencies?.[packageName]?.replace(/^[~^]/, "");
}
let product;
const vscodeGlobal = globalThis.vscode;
if (typeof vscodeGlobal !== "undefined" && typeof vscodeGlobal.context !== "undefined") {
  const configuration = vscodeGlobal.context.configuration();
  if (configuration) {
    product = configuration.product;
  } else {
    throw new Error("Sandbox: unable to resolve product configuration from preload script.");
  }
} else if (globalThis._VSCODE_PRODUCT_JSON && globalThis._VSCODE_PACKAGE_JSON) {
  product = globalThis._VSCODE_PRODUCT_JSON;
  const packageConfiguration = globalThis._VSCODE_PACKAGE_JSON;
  if (env["VSCODE_DEV"]) {
    Object.assign(product, {
      nameShort: `${product.nameShort} Dev`,
      nameLong: `${product.nameLong} Dev`,
      dataFolderName: `${product.dataFolderName}-dev`,
      serverDataFolderName: product.serverDataFolderName ? `${product.serverDataFolderName}-dev` : void 0
    });
  }
  if (!product.version) {
    Object.assign(product, {
      version: packageConfiguration.version
    });
  }
  if (!product.copilotVersions) {
    const runtime = getDependencyVersion(packageConfiguration, "@github/copilot");
    const sdk = getDependencyVersion(packageConfiguration, "@github/copilot-sdk");
    if (runtime && sdk) {
      Object.assign(product, { copilotVersions: { runtime, sdk } });
    }
  }
} else {
  product = {
    /*BUILD->INSERT_PRODUCT_CONFIGURATION*/
  };
  if (Object.keys(product).length === 0) {
    Object.assign(product, {
      version: "1.104.0-dev",
      nameShort: "Code - OSS Dev",
      nameLong: "Code - OSS Dev",
      applicationName: "code-oss",
      dataFolderName: ".vscode-oss",
      urlProtocol: "code-oss",
      reportIssueUrl: "https://github.com/microsoft/vscode/issues/new",
      licenseName: "MIT",
      licenseUrl: "https://github.com/microsoft/vscode/blob/main/LICENSE.txt",
      serverLicenseUrl: "https://github.com/microsoft/vscode/blob/main/LICENSE.txt",
      defaultChatAgent: {
        extensionId: "GitHub.copilot",
        chatExtensionId: "GitHub.copilot-chat",
        provider: {
          default: {
            id: "github",
            name: "GitHub"
          },
          enterprise: {
            id: "github-enterprise",
            name: "GitHub Enterprise"
          }
        },
        providerScopes: []
      }
    });
  }
}
var product_default = product;
export {
  product_default as default
};
