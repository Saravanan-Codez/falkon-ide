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
import { DeferredPromise } from "../../../../../../base/common/async.js";
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IProgressService, ProgressLocation } from "../../../../../../platform/progress/common/progress.js";
import { ChatAIDisabledSettingId } from "../../../common/constants.js";
let AgentHostDownloadProgress = class extends Disposable {
  constructor(_progressService, _configurationService) {
    super();
    this._progressService = _progressService;
    this._configurationService = _configurationService;
    /**
     * Active progress indicators keyed by `progressToken`. The host emits a
     * single stream per download keyed by the download's own stable identity
     * (so distinct sessions of a provider share one indicator). Each entry owns
     * one long-running notification progress (opened on the first frame), driven
     * via {@link IActiveDownload.report} and dismissed via
     * {@link IActiveDownload.complete} once `progress >= total`.
     */
    this._activeDownloads = /* @__PURE__ */ new Map();
    this._register(toDisposable(() => {
      for (const download of this._activeDownloads.values()) {
        download.complete();
      }
      this._activeDownloads.clear();
    }));
  }
  handleProgress(progress) {
    if (this._configurationService.getValue(ChatAIDisabledSettingId)) {
      return;
    }
    const isComplete = progress.total !== void 0 && progress.progress >= progress.total;
    if (isComplete) {
      this._activeDownloads.get(progress.progressToken)?.complete();
      this._activeDownloads.delete(progress.progressToken);
      return;
    }
    let entry = this._activeDownloads.get(progress.progressToken);
    if (!entry) {
      const deferred = new DeferredPromise();
      let report;
      const title = progress.message ?? localize("agentHost.download.titleFallback", "Downloading");
      this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title
        },
        (p) => {
          report = (step) => p.report(step);
          return deferred.p;
        }
      );
      entry = {
        lastPercent: 0,
        report: (step) => report?.(step),
        complete: () => deferred.complete()
      };
      this._activeDownloads.set(progress.progressToken, entry);
    }
    if (progress.total && progress.total > 0) {
      const percent = Math.max(0, Math.min(100, Math.round(progress.progress / progress.total * 100)));
      const increment = percent - entry.lastPercent;
      entry.lastPercent = percent;
      entry.report({
        message: localize("agentHost.download.percent", "{0}%", percent),
        increment: increment > 0 ? increment : 0,
        total: 100
      });
    } else {
      const megabytes = (progress.progress / (1024 * 1024)).toFixed(1);
      entry.report({ message: localize("agentHost.download.megabytes", "{0} MB", megabytes) });
    }
  }
};
AgentHostDownloadProgress = __decorateClass([
  __decorateParam(0, IProgressService),
  __decorateParam(1, IConfigurationService)
], AgentHostDownloadProgress);
export {
  AgentHostDownloadProgress
};
