import { upcast } from "../../../base/common/types.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
var StateType = /* @__PURE__ */ ((StateType2) => {
  StateType2["Uninitialized"] = "uninitialized";
  StateType2["Idle"] = "idle";
  StateType2["Disabled"] = "disabled";
  StateType2["CheckingForUpdates"] = "checking for updates";
  StateType2["AvailableForDownload"] = "available for download";
  StateType2["Downloading"] = "downloading";
  StateType2["Downloaded"] = "downloaded";
  StateType2["Updating"] = "updating";
  StateType2["Ready"] = "ready";
  StateType2["Overwriting"] = "overwriting";
  StateType2["Cancelling"] = "cancelling";
  StateType2["Restarting"] = "restarting";
  return StateType2;
})(StateType || {});
var UpdateType = /* @__PURE__ */ ((UpdateType2) => {
  UpdateType2[UpdateType2["Setup"] = 0] = "Setup";
  UpdateType2[UpdateType2["Archive"] = 1] = "Archive";
  UpdateType2[UpdateType2["Snap"] = 2] = "Snap";
  return UpdateType2;
})(UpdateType || {});
var DisablementReason = /* @__PURE__ */ ((DisablementReason2) => {
  DisablementReason2[DisablementReason2["NotBuilt"] = 0] = "NotBuilt";
  DisablementReason2[DisablementReason2["DisabledByEnvironment"] = 1] = "DisabledByEnvironment";
  DisablementReason2[DisablementReason2["ManuallyDisabled"] = 2] = "ManuallyDisabled";
  DisablementReason2[DisablementReason2["Policy"] = 3] = "Policy";
  DisablementReason2[DisablementReason2["MissingConfiguration"] = 4] = "MissingConfiguration";
  DisablementReason2[DisablementReason2["InvalidConfiguration"] = 5] = "InvalidConfiguration";
  DisablementReason2[DisablementReason2["RunningAsAdmin"] = 6] = "RunningAsAdmin";
  return DisablementReason2;
})(DisablementReason || {});
const State = {
  Uninitialized: upcast({ type: "uninitialized" /* Uninitialized */ }),
  Disabled: (reason) => ({ type: "disabled" /* Disabled */, reason }),
  Idle: (updateType, error, notAvailable) => ({ type: "idle" /* Idle */, updateType, error, notAvailable }),
  CheckingForUpdates: (explicit) => ({ type: "checking for updates" /* CheckingForUpdates */, explicit }),
  AvailableForDownload: (update, canInstall) => ({ type: "available for download" /* AvailableForDownload */, update, canInstall }),
  Downloading: (update, explicit, overwrite, downloadedBytes, totalBytes, startTime) => ({ type: "downloading" /* Downloading */, update, explicit, overwrite, downloadedBytes, totalBytes, startTime }),
  Downloaded: (update, explicit, overwrite) => ({ type: "downloaded" /* Downloaded */, update, explicit, overwrite }),
  Updating: (update, explicit, currentProgress, maxProgress) => ({ type: "updating" /* Updating */, update, explicit, currentProgress, maxProgress }),
  Ready: (update, explicit, overwrite) => ({ type: "ready" /* Ready */, update, explicit, overwrite }),
  Overwriting: (update, explicit) => ({ type: "overwriting" /* Overwriting */, update, explicit }),
  Cancelling: upcast({ type: "cancelling" /* Cancelling */ }),
  Restarting: (update) => ({ type: "restarting" /* Restarting */, update })
};
const IUpdateService = createDecorator("updateService");
export {
  DisablementReason,
  IUpdateService,
  State,
  StateType,
  UpdateType
};
