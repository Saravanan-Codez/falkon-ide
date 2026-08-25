import { localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { PROFILES_CATEGORY } from "../../../services/userDataProfile/common/userDataProfile.js";
class CreateTransientProfileAction extends Action2 {
  static {
    this.ID = "workbench.profiles.actions.createTemporaryProfile";
  }
  static {
    this.TITLE = localize2("create temporary profile", "New Window with Temporary Profile");
  }
  constructor() {
    super({
      id: CreateTransientProfileAction.ID,
      title: CreateTransientProfileAction.TITLE,
      category: PROFILES_CATEGORY,
      f1: true
    });
  }
  async run(accessor) {
    accessor.get(IHostService).openWindow({ forceTempProfile: true });
  }
}
registerAction2(CreateTransientProfileAction);
registerAction2(class CleanupProfilesAction extends Action2 {
  constructor() {
    super({
      id: "workbench.profiles.actions.cleanupProfiles",
      title: localize2("cleanup profile", "Cleanup Profiles"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    return accessor.get(IUserDataProfilesService).cleanUp();
  }
});
registerAction2(class ResetWorkspacesAction extends Action2 {
  constructor() {
    super({
      id: "workbench.profiles.actions.resetWorkspaces",
      title: localize2("reset workspaces", "Reset Workspace Profiles Associations"),
      category: Categories.Developer,
      f1: true
    });
  }
  async run(accessor) {
    const userDataProfilesService = accessor.get(IUserDataProfilesService);
    return userDataProfilesService.resetWorkspaces();
  }
});
