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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { process } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { URI } from "../../../../base/common/uri.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { PolicyCategory, PolicyCategoryData } from "../../../../base/common/policy.js";
import { join } from "../../../../base/common/path.js";
import { hasKey } from "../../../../base/common/types.js";
let PolicyExportContribution = class extends Disposable {
  constructor(nativeEnvironmentService, extensionService, fileService, configurationService, nativeHostService, progressService, logService) {
    super();
    this.nativeEnvironmentService = nativeEnvironmentService;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.nativeHostService = nativeHostService;
    this.progressService = progressService;
    this.logService = logService;
    if (this.nativeEnvironmentService.isBuilt) {
      return;
    }
    const policyDataPath = this.nativeEnvironmentService.exportPolicyData;
    if (policyDataPath !== void 0) {
      const defaultPath = join(this.nativeEnvironmentService.appRoot, PolicyExportContribution.DEFAULT_POLICY_EXPORT_PATH);
      void this.exportPolicyDataAndQuit(policyDataPath ? policyDataPath : defaultPath);
    }
  }
  static {
    this.ID = "workbench.contrib.policyExport";
  }
  static {
    this.DEFAULT_POLICY_EXPORT_PATH = "build/lib/policies/policyData.jsonc";
  }
  log(msg, ...args) {
    this.logService.info(`[${PolicyExportContribution.ID}]`, msg, ...args);
  }
  async exportPolicyDataAndQuit(policyDataPath) {
    try {
      await this.progressService.withProgress({
        location: ProgressLocation.Notification,
        title: `Exporting policy data to ${policyDataPath}`
      }, async (_progress) => {
        this.log("Export started. Waiting for configurations to load.");
        await this.extensionService.whenInstalledExtensionsRegistered();
        await this.configurationService.whenRemoteConfigurationLoaded();
        this.log("Extensions and configuration loaded.");
        const configurationRegistry = Registry.as(Extensions.Configuration);
        const configurationProperties = {
          ...configurationRegistry.getExcludedConfigurationProperties(),
          ...configurationRegistry.getConfigurationProperties()
        };
        const policyData = {
          categories: Object.values(PolicyCategory).map((category) => ({
            key: category,
            name: PolicyCategoryData[category].name
          })),
          policies: []
        };
        for (const [key, schema] of Object.entries(configurationProperties)) {
          if (schema.policy?.localization) {
            policyData.policies.push({
              key,
              name: schema.policy.name,
              category: schema.policy.category,
              minimumVersion: schema.policy.minimumVersion,
              localization: {
                description: schema.policy.localization.description,
                enumDescriptions: schema.policy.localization.enumDescriptions
              },
              type: schema.type,
              default: schema.default,
              enum: schema.enum,
              included: schema.included !== false
            });
          }
        }
        this.log(`Discovered ${policyData.policies.length} policies to export.`);
        const distroProduct = await this.getDistroProductJson();
        const extensionPolicies = distroProduct["extensionConfigurationPolicy"];
        const productReferencesByPolicyName = /* @__PURE__ */ new Map();
        if (extensionPolicies) {
          const existingKeys = new Set(policyData.policies.map((p) => p.key));
          let added = 0;
          let referenced = 0;
          for (const [key, entry] of Object.entries(extensionPolicies)) {
            if (existingKeys.has(key)) {
              continue;
            }
            if (hasKey(entry, { policyReference: true })) {
              const ownerName = entry.policyReference?.name;
              if (!ownerName) {
                throw new Error(`Extension policy reference '${key}' is missing required 'policyReference.name' field.`);
              }
              const list = productReferencesByPolicyName.get(ownerName) ?? [];
              list.push(key);
              productReferencesByPolicyName.set(ownerName, list);
              referenced++;
              continue;
            }
            if (!entry.name || !entry.category || !entry.description) {
              throw new Error(`Extension policy '${key}' is missing required 'name', 'category', or 'description' field.`);
            }
            policyData.policies.push({
              key,
              name: entry.name,
              category: entry.category,
              minimumVersion: entry.minimumVersion,
              localization: {
                description: { key, value: entry.description }
              },
              type: "boolean",
              default: true,
              included: true
            });
            added++;
          }
          this.log(`Merged ${added} extension configuration policies (${referenced} references).`);
        }
        const policyReferenceConfigurations = configurationRegistry.getPolicyReferenceConfigurations();
        const linkedProductReferenceNames = /* @__PURE__ */ new Set();
        let linkedReferences = 0;
        for (const policy of policyData.policies) {
          const references = new Set(policyReferenceConfigurations.get(policy.name) ?? []);
          const productReferences = productReferencesByPolicyName.get(policy.name);
          if (productReferences) {
            for (const productRefKey of productReferences) {
              references.add(productRefKey);
            }
            linkedProductReferenceNames.add(policy.name);
          }
          if (references.size > 0) {
            for (const referenceKey of references) {
              const referenceType = configurationProperties[referenceKey]?.type;
              if (referenceType !== void 0 && referenceType !== policy.type) {
                throw new Error(`Policy '${policy.name}': setting '${referenceKey}' (type '${referenceType}') declares a 'policyReference' to a policy of type '${policy.type}'. A 'policyReference' must match the owning setting's type.`);
              }
            }
            policy.referencedSettings = [...references].sort();
            linkedReferences += references.size;
          }
        }
        for (const policyName of productReferencesByPolicyName.keys()) {
          if (!linkedProductReferenceNames.has(policyName)) {
            throw new Error(`Extension policy reference to '${policyName}' has no owning policy. Ensure an in-code setting declares 'policy: { name: '${policyName}', ... }'.`);
          }
        }
        this.log(`Linked ${linkedReferences} referenced settings across ${policyData.policies.length} policies.`);
        const disclaimerComment = `/** THIS FILE IS AUTOMATICALLY GENERATED USING \`npm run export-policy-data\`. DO NOT MODIFY IT MANUALLY. **/`;
        const policyDataFileContent = `${disclaimerComment}
${JSON.stringify(policyData, null, 4)}
`;
        await this.fileService.writeFile(URI.file(policyDataPath), VSBuffer.fromString(policyDataFileContent));
        this.log(`Successfully exported ${policyData.policies.length} policies to ${policyDataPath}.`);
      });
      await this.nativeHostService.exit(0);
    } catch (error) {
      this.log("Failed to export policy", error);
      await this.nativeHostService.exit(1);
    }
  }
  /**
   * Reads the distro product.json for the 'stable' quality.
   * Checks DISTRO_PRODUCT_JSON env var (for testing),
   * then falls back to fetching from the GitHub API using GITHUB_TOKEN.
   */
  async getDistroProductJson() {
    const root = this.nativeEnvironmentService.appRoot;
    const envPath = process.env["DISTRO_PRODUCT_JSON"];
    if (envPath) {
      this.log(`Reading distro product.json from DISTRO_PRODUCT_JSON=${envPath}`);
      const content2 = (await this.fileService.readFile(URI.file(envPath))).value.toString();
      return JSON.parse(content2);
    }
    const packageJsonPath = join(root, "package.json");
    const packageJsonContent = (await this.fileService.readFile(URI.file(packageJsonPath))).value.toString();
    const packageJson = JSON.parse(packageJsonContent);
    const distroCommit = packageJson.distro;
    if (!distroCommit) {
      throw new Error(
        "No distro commit found in package.json. Use `npm run export-policy-data` which sets up the required environment."
      );
    }
    const token = process.env["GITHUB_TOKEN"];
    if (!token) {
      throw new Error(
        "GITHUB_TOKEN is required to fetch distro product.json. Use `npm run export-policy-data` which sets up the required environment."
      );
    }
    this.log(`Fetching distro product.json for commit ${distroCommit} from GitHub...`);
    const url = `https://api.github.com/repos/microsoft/vscode-distro/contents/mixin/stable/product.json?ref=${encodeURIComponent(distroCommit)}`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "VSCode Build"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch distro product.json: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (data.encoding !== "base64") {
      throw new Error(`Unexpected encoding from GitHub API: ${data.encoding}`);
    }
    const content = VSBuffer.wrap(Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0))).toString();
    return JSON.parse(content);
  }
};
PolicyExportContribution = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IWorkbenchConfigurationService),
  __decorateParam(4, INativeHostService),
  __decorateParam(5, IProgressService),
  __decorateParam(6, ILogService)
], PolicyExportContribution);
registerWorkbenchContribution2(
  PolicyExportContribution.ID,
  PolicyExportContribution,
  WorkbenchPhase.Eventually
);
export {
  PolicyExportContribution
};
