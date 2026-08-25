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
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { LoadReason } from "../../window/electron-main/window.js";
import { IUserDataProfilesMainService } from "./userDataProfile.js";
import { toWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { IWindowsMainService } from "../../windows/electron-main/windows.js";
let UserDataProfilesHandler = class extends Disposable {
  constructor(lifecycleMainService, userDataProfilesService, windowsMainService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    this.windowsMainService = windowsMainService;
    this._register(lifecycleMainService.onWillLoadWindow((e) => {
      if (e.reason === LoadReason.LOAD) {
        this.unsetProfileForWorkspace(e.window);
      }
    }));
    this._register(lifecycleMainService.onBeforeCloseWindow((window) => this.unsetProfileForWorkspace(window)));
    this._register(new RunOnceScheduler(
      () => this.cleanUpEmptyWindowAssociations(),
      30 * 1e3
      /* after 30s */
    )).schedule();
  }
  async unsetProfileForWorkspace(window) {
    const workspace = this.getWorkspace(window);
    const profile = this.userDataProfilesService.getProfileForWorkspace(workspace);
    if (profile?.isTransient) {
      this.userDataProfilesService.unsetWorkspace(workspace, profile.isTransient);
      if (profile.isTransient) {
        await this.userDataProfilesService.cleanUpTransientProfiles();
      }
    }
  }
  getWorkspace(window) {
    return window.openedWorkspace ?? toWorkspaceIdentifier(window.backupPath, window.isExtensionDevelopmentHost);
  }
  cleanUpEmptyWindowAssociations() {
    const associatedEmptyWindows = this.userDataProfilesService.getAssociatedEmptyWindows();
    if (associatedEmptyWindows.length === 0) {
      return;
    }
    const openedWorkspaces = this.windowsMainService.getWindows().map((window) => this.getWorkspace(window));
    for (const associatedEmptyWindow of associatedEmptyWindows) {
      if (openedWorkspaces.some((openedWorkspace) => openedWorkspace.id === associatedEmptyWindow.id)) {
        continue;
      }
      this.userDataProfilesService.unsetWorkspace(associatedEmptyWindow, false);
    }
  }
};
UserDataProfilesHandler = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IUserDataProfilesMainService),
  __decorateParam(2, IWindowsMainService)
], UserDataProfilesHandler);
export {
  UserDataProfilesHandler
};
