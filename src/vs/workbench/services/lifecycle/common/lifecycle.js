import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const ILifecycleService = createDecorator("lifecycleService");
var WillShutdownJoinerOrder = /* @__PURE__ */ ((WillShutdownJoinerOrder2) => {
  WillShutdownJoinerOrder2[WillShutdownJoinerOrder2["Default"] = 1] = "Default";
  WillShutdownJoinerOrder2[WillShutdownJoinerOrder2["Last"] = 2] = "Last";
  return WillShutdownJoinerOrder2;
})(WillShutdownJoinerOrder || {});
var ShutdownReason = /* @__PURE__ */ ((ShutdownReason2) => {
  ShutdownReason2[ShutdownReason2["CLOSE"] = 1] = "CLOSE";
  ShutdownReason2[ShutdownReason2["QUIT"] = 2] = "QUIT";
  ShutdownReason2[ShutdownReason2["RELOAD"] = 3] = "RELOAD";
  ShutdownReason2[ShutdownReason2["LOAD"] = 4] = "LOAD";
  return ShutdownReason2;
})(ShutdownReason || {});
var StartupKind = /* @__PURE__ */ ((StartupKind2) => {
  StartupKind2[StartupKind2["NewWindow"] = 1] = "NewWindow";
  StartupKind2[StartupKind2["ReloadedWindow"] = 3] = "ReloadedWindow";
  StartupKind2[StartupKind2["ReopenedWindow"] = 4] = "ReopenedWindow";
  return StartupKind2;
})(StartupKind || {});
function StartupKindToString(startupKind) {
  switch (startupKind) {
    case 1 /* NewWindow */:
      return "NewWindow";
    case 3 /* ReloadedWindow */:
      return "ReloadedWindow";
    case 4 /* ReopenedWindow */:
      return "ReopenedWindow";
  }
}
var LifecyclePhase = /* @__PURE__ */ ((LifecyclePhase2) => {
  LifecyclePhase2[LifecyclePhase2["Starting"] = 1] = "Starting";
  LifecyclePhase2[LifecyclePhase2["Ready"] = 2] = "Ready";
  LifecyclePhase2[LifecyclePhase2["Restored"] = 3] = "Restored";
  LifecyclePhase2[LifecyclePhase2["Eventually"] = 4] = "Eventually";
  return LifecyclePhase2;
})(LifecyclePhase || {});
function LifecyclePhaseToString(phase) {
  switch (phase) {
    case 1 /* Starting */:
      return "Starting";
    case 2 /* Ready */:
      return "Ready";
    case 3 /* Restored */:
      return "Restored";
    case 4 /* Eventually */:
      return "Eventually";
  }
}
export {
  ILifecycleService,
  LifecyclePhase,
  LifecyclePhaseToString,
  ShutdownReason,
  StartupKind,
  StartupKindToString,
  WillShutdownJoinerOrder
};
