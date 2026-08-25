const AgentHostMachineIdEnvKey = "VSCODE_AGENT_HOST_MACHINE_ID";
const AgentHostSqmIdEnvKey = "VSCODE_AGENT_HOST_SQM_ID";
const AgentHostDevDeviceIdEnvKey = "VSCODE_AGENT_HOST_DEV_DEVICE_ID";
function buildAgentHostTelemetryIdEnv(ids) {
  const env = {};
  if (ids.machineId) {
    env[AgentHostMachineIdEnvKey] = ids.machineId;
  }
  if (ids.sqmId) {
    env[AgentHostSqmIdEnvKey] = ids.sqmId;
  }
  if (ids.devDeviceId) {
    env[AgentHostDevDeviceIdEnvKey] = ids.devDeviceId;
  }
  return env;
}
export {
  AgentHostDevDeviceIdEnvKey,
  AgentHostMachineIdEnvKey,
  AgentHostSqmIdEnvKey,
  buildAgentHostTelemetryIdEnv
};
