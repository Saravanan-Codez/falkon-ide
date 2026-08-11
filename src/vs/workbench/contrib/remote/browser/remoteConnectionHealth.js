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
import { IRemoteAgentService, remoteConnectionLatencyMeasurer } from "../../../services/remote/common/remoteAgentService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { localize } from "../../../../nls.js";
import { isWeb, OperatingSystem } from "../../../../base/common/platform.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { getRemoteName, getRemoteServerRootPath } from "../../../../platform/remote/common/remoteHosts.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { Codicon } from "../../../../base/common/codicons.js";
import Severity from "../../../../base/common/severity.js";
const REMOTE_UNSUPPORTED_CONNECTION_CHOICE_KEY = "remote.unsupportedConnectionChoice";
const BANNER_REMOTE_UNSUPPORTED_CONNECTION_DISMISSED_KEY = "workbench.banner.remote.unsupportedConnection.dismissed";
const BANNER_REMOTE_ARM32_DEPRECATION_DISMISSED_KEY = "workbench.banner.remote.arm32Deprecation.dismissed";
let InitialRemoteConnectionHealthContribution = class {
  constructor(_remoteAgentService, _environmentService, _telemetryService, bannerService, dialogService, openerService, hostService, storageService, productService) {
    this._remoteAgentService = _remoteAgentService;
    this._environmentService = _environmentService;
    this._telemetryService = _telemetryService;
    this.bannerService = bannerService;
    this.dialogService = dialogService;
    this.openerService = openerService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.productService = productService;
    if (this._environmentService.remoteAuthority) {
      this._checkInitialRemoteConnectionHealth();
    }
  }
  async _confirmConnection() {
    let ConnectionChoice;
    ((ConnectionChoice2) => {
      ConnectionChoice2[ConnectionChoice2["Allow"] = 1] = "Allow";
      ConnectionChoice2[ConnectionChoice2["LearnMore"] = 2] = "LearnMore";
      ConnectionChoice2[ConnectionChoice2["Cancel"] = 0] = "Cancel";
    })(ConnectionChoice || (ConnectionChoice = {}));
    const { result, checkboxChecked } = await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("unsupportedGlibcWarning", "You are about to connect to an OS version that is unsupported by {0}.", this.productService.nameLong),
      buttons: [
        {
          label: localize({ key: "allow", comment: ["&& denotes a mnemonic"] }, "&&Allow"),
          run: () => 1 /* Allow */
        },
        {
          label: localize({ key: "learnMore", comment: ["&& denotes a mnemonic"] }, "&&Learn More"),
          run: async () => {
            await this.openerService.open("https://aka.ms/vscode-remote/faq/old-linux");
            return 2 /* LearnMore */;
          }
        }
      ],
      cancelButton: {
        run: () => 0 /* Cancel */
      },
      checkbox: {
        label: localize("remember", "Do not show again")
      }
    });
    if (result === 2 /* LearnMore */) {
      return await this._confirmConnection();
    }
    const allowed = result === 1 /* Allow */;
    if (allowed && checkboxChecked) {
      this.storageService.store(`${REMOTE_UNSUPPORTED_CONNECTION_CHOICE_KEY}.${this._environmentService.remoteAuthority}`, allowed, StorageScope.PROFILE, StorageTarget.MACHINE);
    }
    return allowed;
  }
  async _checkInitialRemoteConnectionHealth() {
    try {
      const environment = await this._remoteAgentService.getRawEnvironment();
      const isArm32Server = environment?.os === OperatingSystem.Linux && environment.arch === "arm";
      if (environment && environment.isUnsupportedGlibc) {
        let allowed = this.storageService.getBoolean(`${REMOTE_UNSUPPORTED_CONNECTION_CHOICE_KEY}.${this._environmentService.remoteAuthority}`, StorageScope.PROFILE);
        if (allowed === void 0) {
          allowed = await this._confirmConnection();
        }
        if (allowed) {
          this._showVersionedBanner(
            "unsupportedGlibcWarning.banner",
            BANNER_REMOTE_UNSUPPORTED_CONNECTION_DISMISSED_KEY,
            localize("unsupportedGlibcWarning.banner", "You are connected to an OS version that is unsupported by {0}.", this.productService.nameLong),
            [
              {
                label: localize("unsupportedGlibcBannerLearnMore", "Learn More"),
                href: "https://aka.ms/vscode-remote/faq/old-linux"
              }
            ]
          );
        } else {
          this.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null });
          return;
        }
      }
      if (isArm32Server) {
        this._showVersionedBanner(
          "arm32ServerDeprecation.banner",
          BANNER_REMOTE_ARM32_DEPRECATION_DISMISSED_KEY,
          localize("arm32ServerDeprecation.banner", "Support for 32-bit ARM remote servers is deprecated and will be removed in a future release of {0}.", this.productService.nameLong),
          [
            {
              label: localize("arm32ServerDeprecationBannerLearnMore", "Learn More"),
              href: "https://aka.ms/vscode-remote-linux-arm-32-eol"
            }
          ]
        );
      }
      this._telemetryService.publicLog2("remoteConnectionSuccess", {
        web: isWeb,
        connectionTimeMs: await this._remoteAgentService.getConnection()?.getInitialConnectionTimeMs(),
        remoteName: getRemoteName(this._environmentService.remoteAuthority),
        tunnelName: getRemoteServerRootPath(this._environmentService.remoteAuthority)
      });
      await this._measureExtHostLatency();
    } catch (err) {
      this._telemetryService.publicLog2("remoteConnectionFailure", {
        web: isWeb,
        connectionTimeMs: await this._remoteAgentService.getConnection()?.getInitialConnectionTimeMs(),
        remoteName: getRemoteName(this._environmentService.remoteAuthority),
        message: err ? err.message : ""
      });
    }
  }
  _showVersionedBanner(id, storageKey, message, actions) {
    const bannerDismissedVersion = this.storageService.get(storageKey, StorageScope.PROFILE) ?? "";
    const shouldShowBanner = bannerDismissedVersion.slice(0, bannerDismissedVersion.lastIndexOf(".")) !== this.productService.version.slice(0, this.productService.version.lastIndexOf("."));
    if (!shouldShowBanner) {
      return;
    }
    this.bannerService.show({
      id,
      message,
      actions,
      icon: Codicon.warning,
      closeLabel: localize("remoteBannerDoNotShowAgainThisVersion", "Do not show again in v{0}", this.productService.version),
      onClose: () => {
        this.storageService.store(storageKey, this.productService.version, StorageScope.PROFILE, StorageTarget.MACHINE);
      }
    });
  }
  async _measureExtHostLatency() {
    const measurement = await remoteConnectionLatencyMeasurer.measure(this._remoteAgentService);
    if (measurement === void 0) {
      return;
    }
    this._telemetryService.publicLog2("remoteConnectionLatency", {
      web: isWeb,
      remoteName: getRemoteName(this._environmentService.remoteAuthority),
      latencyMs: measurement.current
    });
  }
};
InitialRemoteConnectionHealthContribution = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IBannerService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IProductService)
], InitialRemoteConnectionHealthContribution);
export {
  InitialRemoteConnectionHealthContribution
};
