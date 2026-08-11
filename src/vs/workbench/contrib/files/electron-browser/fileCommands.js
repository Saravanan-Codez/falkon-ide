import { URI } from "../../../../base/common/uri.js";
import { sequence } from "../../../../base/common/async.js";
import { Schemas } from "../../../../base/common/network.js";
import { getRemoteName, getRemoteServerRootPath } from "../../../../platform/remote/common/remoteHosts.js";
function revealResourcesInOS(resources, nativeHostService, workspaceContextService) {
  if (resources.length) {
    sequence(resources.map((r) => async () => {
      const localUri = toLocalFileUri(r);
      if (localUri) {
        nativeHostService.showItemInFolder(localUri.fsPath);
      }
    }));
  } else if (workspaceContextService.getWorkspace().folders.length) {
    const localUri = toLocalFileUri(workspaceContextService.getWorkspace().folders[0].uri);
    if (localUri) {
      nativeHostService.showItemInFolder(localUri.fsPath);
    }
  }
}
function toLocalFileUri(resource) {
  switch (resource.scheme) {
    case Schemas.file:
    case Schemas.vscodeUserData:
      return resource.with({ scheme: Schemas.file });
    case Schemas.vscodeRemote: {
      const remoteName = getRemoteName(resource.authority);
      if (remoteName === "wsl") {
        const distro = getRemoteServerRootPath(resource.authority);
        if (distro) {
          return URI.from({ scheme: Schemas.file, authority: "wsl$", path: `/${distro}${resource.path}` });
        }
      }
      return void 0;
    }
    default:
      return void 0;
  }
}
export {
  revealResourcesInOS
};
