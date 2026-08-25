import { Schemas } from "../../../base/common/network.js";
function isVirtualResource(resource) {
  return resource.scheme !== Schemas.file && resource.scheme !== Schemas.vscodeRemote;
}
function getVirtualWorkspaceLocation(workspace) {
  if (workspace.folders.length) {
    return workspace.folders.every((f) => isVirtualResource(f.uri)) ? workspace.folders[0].uri : void 0;
  } else if (workspace.configuration && isVirtualResource(workspace.configuration)) {
    return workspace.configuration;
  }
  return void 0;
}
function getVirtualWorkspaceScheme(workspace) {
  return getVirtualWorkspaceLocation(workspace)?.scheme;
}
function getVirtualWorkspaceAuthority(workspace) {
  return getVirtualWorkspaceLocation(workspace)?.authority;
}
function isVirtualWorkspace(workspace) {
  return getVirtualWorkspaceLocation(workspace) !== void 0;
}
export {
  getVirtualWorkspaceAuthority,
  getVirtualWorkspaceLocation,
  getVirtualWorkspaceScheme,
  isVirtualResource,
  isVirtualWorkspace
};
