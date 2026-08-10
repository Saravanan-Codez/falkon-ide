import { getDevDeviceId } from "../../../base/node/id.js";
import { machineIdKey, sqmIdKey, devDeviceIdKey } from "../common/telemetry.js";
import { resolveMachineId as resolveNodeMachineId, resolveSqmId as resolveNodeSqmId, resolveDevDeviceId as resolveNodeDevDeviceId } from "../node/telemetryUtils.js";
async function resolveMachineId(stateService, logService) {
  logService.trace("Resolving machine identifier...");
  const machineId = await resolveNodeMachineId(stateService, logService);
  stateService.setItem(machineIdKey, machineId);
  logService.trace(`Resolved machine identifier: ${machineId}`);
  return machineId;
}
async function resolveSqmId(stateService, logService) {
  logService.trace("Resolving SQM identifier...");
  const sqmId = await resolveNodeSqmId(stateService, logService);
  stateService.setItem(sqmIdKey, sqmId);
  logService.trace(`Resolved SQM identifier: ${sqmId}`);
  return sqmId;
}
async function resolveDevDeviceId(stateService, logService) {
  logService.trace("Resolving devDevice identifier...");
  const devDeviceId = await resolveNodeDevDeviceId(stateService, logService);
  stateService.setItem(devDeviceIdKey, devDeviceId);
  logService.trace(`Resolved devDevice identifier: ${devDeviceId}`);
  return devDeviceId;
}
async function validateDevDeviceId(stateService, logService) {
  const actualDeviceId = await getDevDeviceId(logService.error.bind(logService));
  const currentDeviceId = await resolveNodeDevDeviceId(stateService, logService);
  if (actualDeviceId !== currentDeviceId) {
    stateService.setItem(devDeviceIdKey, actualDeviceId);
  }
}
export {
  resolveDevDeviceId,
  resolveMachineId,
  resolveSqmId,
  validateDevDeviceId
};
