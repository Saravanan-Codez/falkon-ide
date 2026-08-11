import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { TerminalDataTransfers } from "./terminal.js";
function parseTerminalUri(resource) {
  const [, workspaceId, instanceId] = resource.path.split("/");
  if (!workspaceId || !Number.parseInt(instanceId)) {
    throw new Error(`Could not parse terminal uri for resource ${resource}`);
  }
  return { workspaceId, instanceId: Number.parseInt(instanceId) };
}
function getTerminalUri(workspaceId, instanceId, title, commandId) {
  const params = new URLSearchParams();
  if (commandId) {
    params.set("command", commandId);
  }
  return URI.from({
    scheme: Schemas.vscodeTerminal,
    path: `/${workspaceId}/${instanceId}`,
    fragment: title || void 0,
    query: commandId ? params.toString() : void 0
  });
}
function getTerminalResourcesFromDragEvent(event) {
  const resources = event.dataTransfer?.getData(TerminalDataTransfers.Terminals);
  if (resources) {
    const json = JSON.parse(resources);
    const result = [];
    for (const entry of json) {
      result.push(URI.parse(entry));
    }
    return result.length === 0 ? void 0 : result;
  }
  return void 0;
}
function getInstanceFromResource(instances, resource) {
  if (resource) {
    for (const instance of instances) {
      if (instance.resource.path === resource.path) {
        return instance;
      }
    }
  }
  return void 0;
}
export {
  getInstanceFromResource,
  getTerminalResourcesFromDragEvent,
  getTerminalUri,
  parseTerminalUri
};
