var OutputMonitorState = /* @__PURE__ */ ((OutputMonitorState2) => {
  OutputMonitorState2["Initial"] = "Initial";
  OutputMonitorState2["Idle"] = "Idle";
  OutputMonitorState2["PollingForIdle"] = "PollingForIdle";
  OutputMonitorState2["Prompting"] = "Prompting";
  OutputMonitorState2["Timeout"] = "Timeout";
  OutputMonitorState2["Active"] = "Active";
  OutputMonitorState2["Cancelled"] = "Cancelled";
  return OutputMonitorState2;
})(OutputMonitorState || {});
var PollingConsts = /* @__PURE__ */ ((PollingConsts2) => {
  PollingConsts2[PollingConsts2["MinIdleEvents"] = 2] = "MinIdleEvents";
  PollingConsts2[PollingConsts2["MinPollingDuration"] = 500] = "MinPollingDuration";
  PollingConsts2[PollingConsts2["FirstPollingMaxDuration"] = 2e4] = "FirstPollingMaxDuration";
  PollingConsts2[PollingConsts2["ExtendedPollingMaxDuration"] = 12e4] = "ExtendedPollingMaxDuration";
  PollingConsts2[PollingConsts2["MaxPollingIntervalDuration"] = 1e4] = "MaxPollingIntervalDuration";
  PollingConsts2[PollingConsts2["MaxRecursionCount"] = 5] = "MaxRecursionCount";
  return PollingConsts2;
})(PollingConsts || {});
export {
  OutputMonitorState,
  PollingConsts
};
