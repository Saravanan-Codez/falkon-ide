const REMOTE_TERMINAL_CHANNEL_NAME = "remoteterminal";
var RemoteTerminalChannelEvent = /* @__PURE__ */ ((RemoteTerminalChannelEvent2) => {
  RemoteTerminalChannelEvent2["OnPtyHostExitEvent"] = "$onPtyHostExitEvent";
  RemoteTerminalChannelEvent2["OnPtyHostStartEvent"] = "$onPtyHostStartEvent";
  RemoteTerminalChannelEvent2["OnPtyHostUnresponsiveEvent"] = "$onPtyHostUnresponsiveEvent";
  RemoteTerminalChannelEvent2["OnPtyHostResponsiveEvent"] = "$onPtyHostResponsiveEvent";
  RemoteTerminalChannelEvent2["OnPtyHostRequestResolveVariablesEvent"] = "$onPtyHostRequestResolveVariablesEvent";
  RemoteTerminalChannelEvent2["OnProcessDataEvent"] = "$onProcessDataEvent";
  RemoteTerminalChannelEvent2["OnProcessReadyEvent"] = "$onProcessReadyEvent";
  RemoteTerminalChannelEvent2["OnProcessExitEvent"] = "$onProcessExitEvent";
  RemoteTerminalChannelEvent2["OnProcessReplayEvent"] = "$onProcessReplayEvent";
  RemoteTerminalChannelEvent2["OnProcessOrphanQuestion"] = "$onProcessOrphanQuestion";
  RemoteTerminalChannelEvent2["OnExecuteCommand"] = "$onExecuteCommand";
  RemoteTerminalChannelEvent2["OnDidRequestDetach"] = "$onDidRequestDetach";
  RemoteTerminalChannelEvent2["OnDidChangeProperty"] = "$onDidChangeProperty";
  return RemoteTerminalChannelEvent2;
})(RemoteTerminalChannelEvent || {});
var RemoteTerminalChannelRequest = /* @__PURE__ */ ((RemoteTerminalChannelRequest2) => {
  RemoteTerminalChannelRequest2["RestartPtyHost"] = "$restartPtyHost";
  RemoteTerminalChannelRequest2["CreateProcess"] = "$createProcess";
  RemoteTerminalChannelRequest2["AttachToProcess"] = "$attachToProcess";
  RemoteTerminalChannelRequest2["DetachFromProcess"] = "$detachFromProcess";
  RemoteTerminalChannelRequest2["ListProcesses"] = "$listProcesses";
  RemoteTerminalChannelRequest2["GetLatency"] = "$getLatency";
  RemoteTerminalChannelRequest2["GetPerformanceMarks"] = "$getPerformanceMarks";
  RemoteTerminalChannelRequest2["OrphanQuestionReply"] = "$orphanQuestionReply";
  RemoteTerminalChannelRequest2["AcceptPtyHostResolvedVariables"] = "$acceptPtyHostResolvedVariables";
  RemoteTerminalChannelRequest2["Start"] = "$start";
  RemoteTerminalChannelRequest2["Input"] = "$input";
  RemoteTerminalChannelRequest2["SendSignal"] = "$sendSignal";
  RemoteTerminalChannelRequest2["AcknowledgeDataEvent"] = "$acknowledgeDataEvent";
  RemoteTerminalChannelRequest2["Shutdown"] = "$shutdown";
  RemoteTerminalChannelRequest2["Resize"] = "$resize";
  RemoteTerminalChannelRequest2["ClearBuffer"] = "$clearBuffer";
  RemoteTerminalChannelRequest2["GetInitialCwd"] = "$getInitialCwd";
  RemoteTerminalChannelRequest2["GetCwd"] = "$getCwd";
  RemoteTerminalChannelRequest2["ProcessBinary"] = "$processBinary";
  RemoteTerminalChannelRequest2["SendCommandResult"] = "$sendCommandResult";
  RemoteTerminalChannelRequest2["InstallAutoReply"] = "$installAutoReply";
  RemoteTerminalChannelRequest2["UninstallAllAutoReplies"] = "$uninstallAllAutoReplies";
  RemoteTerminalChannelRequest2["GetDefaultSystemShell"] = "$getDefaultSystemShell";
  RemoteTerminalChannelRequest2["GetProfiles"] = "$getProfiles";
  RemoteTerminalChannelRequest2["GetEnvironment"] = "$getEnvironment";
  RemoteTerminalChannelRequest2["GetWslPath"] = "$getWslPath";
  RemoteTerminalChannelRequest2["GetTerminalLayoutInfo"] = "$getTerminalLayoutInfo";
  RemoteTerminalChannelRequest2["SetTerminalLayoutInfo"] = "$setTerminalLayoutInfo";
  RemoteTerminalChannelRequest2["SerializeTerminalState"] = "$serializeTerminalState";
  RemoteTerminalChannelRequest2["ReviveTerminalProcesses"] = "$reviveTerminalProcesses";
  RemoteTerminalChannelRequest2["GetRevivedPtyNewId"] = "$getRevivedPtyNewId";
  RemoteTerminalChannelRequest2["SetUnicodeVersion"] = "$setUnicodeVersion";
  RemoteTerminalChannelRequest2["SetNextCommandId"] = "$setNextCommandId";
  RemoteTerminalChannelRequest2["ReduceConnectionGraceTime"] = "$reduceConnectionGraceTime";
  RemoteTerminalChannelRequest2["UpdateIcon"] = "$updateIcon";
  RemoteTerminalChannelRequest2["UpdateTitle"] = "$updateTitle";
  RemoteTerminalChannelRequest2["UpdateProperty"] = "$updateProperty";
  RemoteTerminalChannelRequest2["RefreshProperty"] = "$refreshProperty";
  RemoteTerminalChannelRequest2["RequestDetachInstance"] = "$requestDetachInstance";
  RemoteTerminalChannelRequest2["AcceptDetachInstanceReply"] = "$acceptDetachInstanceReply";
  RemoteTerminalChannelRequest2["AcceptDetachedInstance"] = "$acceptDetachedInstance";
  RemoteTerminalChannelRequest2["FreePortKillProcess"] = "$freePortKillProcess";
  return RemoteTerminalChannelRequest2;
})(RemoteTerminalChannelRequest || {});
export {
  REMOTE_TERMINAL_CHANNEL_NAME,
  RemoteTerminalChannelEvent,
  RemoteTerminalChannelRequest
};
