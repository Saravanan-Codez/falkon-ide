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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../base/common/platform.js";
import { localize, localize2 } from "../../../../nls.js";
import { IsSessionsWindowContext } from "../../../common/contextkeys.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { CURRENT_PROFILE_CONTEXT, HAS_PROFILES_CONTEXT, IUserDataProfileImportExportService, IUserDataProfileManagementService, IUserDataProfileService, PROFILES_CATEGORY, PROFILES_TITLE, PROFILE_EXTENSION, isProfileURL } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { URI } from "../../../../base/common/uri.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTagsService } from "../../tags/common/workspaceTags.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { EditorExtensions } from "../../../common/editor.js";
import { UserDataProfilesEditor, UserDataProfilesEditorInput, UserDataProfilesEditorInputSerializer } from "./userDataProfilesEditor.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { Extensions as DndExtensions } from "../../../../platform/dnd/browser/dnd.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ITextEditorService } from "../../../services/textfile/common/textEditorService.js";
const OpenProfileMenu = new MenuId("OpenProfile");
const ProfilesMenu = new MenuId("Profiles");
let UserDataProfilesWorkbenchContribution = class extends Disposable {
  constructor(userDataProfileService, userDataProfilesService, userDataProfileManagementService, telemetryService, workspaceContextService, workspaceTagsService, contextKeyService, editorService, instantiationService, lifecycleService, urlService, environmentService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.telemetryService = telemetryService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceTagsService = workspaceTagsService;
    this.editorService = editorService;
    this.instantiationService = instantiationService;
    this.lifecycleService = lifecycleService;
    this.urlService = urlService;
    this.profilesDisposable = this._register(new MutableDisposable());
    this.currentProfileContext = CURRENT_PROFILE_CONTEXT.bindTo(contextKeyService);
    this.currentProfileContext.set(this.userDataProfileService.currentProfile.id);
    this._register(this.userDataProfileService.onDidChangeCurrentProfile((e) => {
      this.currentProfileContext.set(this.userDataProfileService.currentProfile.id);
    }));
    this.hasProfilesContext = HAS_PROFILES_CONTEXT.bindTo(contextKeyService);
    this.hasProfilesContext.set(this.userDataProfilesService.profiles.filter((p) => !p.isInternal).length > 1);
    this._register(this.userDataProfilesService.onDidChangeProfiles((e) => this.hasProfilesContext.set(this.userDataProfilesService.profiles.filter((p) => !p.isInternal).length > 1)));
    this.registerEditor();
    this.registerActions();
    this._register(this.urlService.registerHandler(this));
    if (isWeb) {
      lifecycleService.when(LifecyclePhase.Eventually).then(() => userDataProfilesService.cleanUp());
    }
    this.reportWorkspaceProfileInfo();
    if (environmentService.options?.profileToPreview) {
      lifecycleService.when(LifecyclePhase.Restored).then(() => this.handleURL(URI.revive(environmentService.options.profileToPreview)));
    }
    this.registerDropHandler();
  }
  static {
    this.ID = "workbench.contrib.userDataProfiles";
  }
  async handleURL(uri) {
    if (isProfileURL(uri)) {
      const editor = await this.openProfilesEditor();
      if (editor) {
        editor.createNewProfile(uri);
        return true;
      }
    }
    return false;
  }
  async openProfilesEditor() {
    const editor = await this.editorService.openEditor(new UserDataProfilesEditorInput(this.instantiationService));
    return editor;
  }
  registerEditor() {
    Registry.as(EditorExtensions.EditorPane).registerEditorPane(
      EditorPaneDescriptor.create(
        UserDataProfilesEditor,
        UserDataProfilesEditor.ID,
        localize("userdataprofilesEditor", "Profiles Editor")
      ),
      [
        new SyncDescriptor(UserDataProfilesEditorInput)
      ]
    );
    Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(UserDataProfilesEditorInput.ID, UserDataProfilesEditorInputSerializer);
  }
  registerDropHandler() {
    const dndRegistry = Registry.as(DndExtensions.DragAndDropContribution);
    const that = this;
    this._register(dndRegistry.registerDropHandler(new class UserDataProfileDropHandler {
      async handleDrop(resource, accessor) {
        const uriIdentityService = accessor.get(IUriIdentityService);
        const userDataProfileImportExportService = accessor.get(IUserDataProfileImportExportService);
        const editorService = accessor.get(IEditorService);
        const textEditorService = accessor.get(ITextEditorService);
        const notificationService = accessor.get(INotificationService);
        if (uriIdentityService.extUri.extname(resource) === `.${PROFILE_EXTENSION}`) {
          const template = await userDataProfileImportExportService.resolveProfileTemplate(resource);
          if (!template) {
            notificationService.warn(localize("invalid profile", "The dropped profile is invalid."));
            editorService.openEditor(textEditorService.createTextEditor({ resource }));
            return true;
          }
          const editor = await that.openProfilesEditor();
          if (editor) {
            try {
              await editor.createNewProfile(resource);
            } catch (error) {
              return false;
            }
          }
          return true;
        }
        return false;
      }
    }()));
  }
  registerActions() {
    this.registerProfileSubMenu();
    this._register(this.registerManageProfilesAction());
    this._register(this.registerSwitchProfileAction());
    this.registerOpenProfileSubMenu();
    this.registerNewWindowWithProfileAction();
    this.registerProfilesActions();
    this._register(this.userDataProfilesService.onDidChangeProfiles(() => this.registerProfilesActions()));
    this._register(this.registerExportCurrentProfileAction());
    this.registerCreateFromCurrentProfileAction();
    this.registerNewProfileAction();
    this.registerDeleteProfileAction();
    this.registerHelpAction();
  }
  registerProfileSubMenu() {
    const getProfilesTitle = () => {
      return localize("profiles", "Profile ({0})", this.userDataProfileService.currentProfile.name);
    };
    MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      get title() {
        return getProfilesTitle();
      },
      submenu: ProfilesMenu,
      group: "2_configuration",
      order: 1,
      when: HAS_PROFILES_CONTEXT
    });
    MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
      get title() {
        return getProfilesTitle();
      },
      submenu: ProfilesMenu,
      group: "2_configuration",
      order: 1,
      when: ContextKeyExpr.and(HAS_PROFILES_CONTEXT, IsSessionsWindowContext.negate())
    });
  }
  registerOpenProfileSubMenu() {
    MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
      title: localize("New Profile Window", "New Window with Profile"),
      submenu: OpenProfileMenu,
      group: "1_new",
      order: 4
    });
  }
  registerProfilesActions() {
    this.profilesDisposable.value = new DisposableStore();
    for (const profile of this.userDataProfilesService.profiles) {
      if (!profile.isInternal) {
        this.profilesDisposable.value.add(this.registerProfileEntryAction(profile));
        this.profilesDisposable.value.add(this.registerNewWindowAction(profile));
      }
    }
  }
  registerProfileEntryAction(profile) {
    const that = this;
    return registerAction2(class ProfileEntryAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.profileEntry.${profile.id}`,
          title: profile.name,
          metadata: {
            description: localize2("change profile", "Switch to {0} profile", profile.name)
          },
          toggled: ContextKeyExpr.equals(CURRENT_PROFILE_CONTEXT.key, profile.id),
          menu: [
            {
              id: ProfilesMenu,
              group: "0_profiles"
            }
          ]
        });
      }
      async run(accessor) {
        if (that.userDataProfileService.currentProfile.id !== profile.id) {
          return that.userDataProfileManagementService.switchProfile(profile);
        }
      }
    });
  }
  registerNewWindowWithProfileAction() {
    return registerAction2(class NewWindowWithProfileAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.newWindowWithProfile`,
          title: localize2("newWindowWithProfile", "New Window with Profile..."),
          category: PROFILES_CATEGORY,
          precondition: HAS_PROFILES_CONTEXT,
          f1: true
        });
      }
      async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const userDataProfilesService = accessor.get(IUserDataProfilesService);
        const hostService = accessor.get(IHostService);
        const pick = await quickInputService.pick(
          userDataProfilesService.profiles.filter((profile) => !profile.isInternal).map((profile) => ({
            label: profile.name,
            profile
          })),
          {
            title: localize("new window with profile", "New Window with Profile"),
            placeHolder: localize("pick profile", "Select Profile"),
            canPickMany: false
          }
        );
        if (pick) {
          return hostService.openWindow({ remoteAuthority: null, forceProfile: pick.profile.name });
        }
      }
    });
  }
  registerNewWindowAction(profile) {
    const disposables = new DisposableStore();
    const id = `workbench.action.openProfile.${profile.name.replace("/s+/", "_")}`;
    const precondition = HAS_PROFILES_CONTEXT;
    disposables.add(registerAction2(class NewWindowAction extends Action2 {
      constructor() {
        super({
          id,
          title: localize2("openShort", "{0}", profile.name),
          metadata: {
            description: localize2("open profile", "Open New Window with {0} Profile", profile.name)
          },
          menu: {
            id: OpenProfileMenu,
            group: "0_profiles",
            when: precondition
          }
        });
      }
      run(accessor) {
        const hostService = accessor.get(IHostService);
        return hostService.openWindow({ remoteAuthority: null, forceProfile: profile.name });
      }
    }));
    disposables.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: {
        id,
        category: PROFILES_CATEGORY,
        title: localize2("open", "Open {0} Profile", profile.name),
        precondition
      }
    }));
    return disposables;
  }
  registerSwitchProfileAction() {
    const that = this;
    return registerAction2(class SwitchProfileAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.switchProfile`,
          title: localize2("switchProfile", "Switch Profile..."),
          category: PROFILES_CATEGORY,
          f1: true
        });
      }
      async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const items = [];
        for (const profile of that.userDataProfilesService.profiles) {
          if (profile.isInternal) {
            continue;
          }
          items.push({
            id: profile.id,
            label: profile.id === that.userDataProfileService.currentProfile.id ? `$(check) ${profile.name}` : profile.name,
            profile
          });
        }
        const result = await quickInputService.pick(items.sort((a, b) => a.profile.name.localeCompare(b.profile.name)), {
          placeHolder: localize("selectProfile", "Select Profile")
        });
        if (result) {
          await that.userDataProfileManagementService.switchProfile(result.profile);
        }
      }
    });
  }
  registerManageProfilesAction() {
    const disposables = new DisposableStore();
    disposables.add(registerAction2(class ManageProfilesAction extends Action2 {
      constructor() {
        super({
          id: `workbench.profiles.actions.manageProfiles`,
          title: {
            ...localize2("manage profiles", "Profiles"),
            mnemonicTitle: localize({ key: "miOpenProfiles", comment: ["&& denotes a mnemonic"] }, "&&Profiles")
          },
          menu: [
            {
              id: MenuId.GlobalActivity,
              group: "2_configuration",
              order: 1,
              when: HAS_PROFILES_CONTEXT.negate()
            },
            {
              id: MenuId.MenubarPreferencesMenu,
              group: "2_configuration",
              order: 1,
              when: ContextKeyExpr.and(HAS_PROFILES_CONTEXT.negate(), IsSessionsWindowContext.negate())
            },
            {
              id: ProfilesMenu,
              group: "1_manage",
              order: 1
            }
          ]
        });
      }
      run(accessor) {
        const editorService = accessor.get(IEditorService);
        const instantiationService = accessor.get(IInstantiationService);
        return editorService.openEditor(new UserDataProfilesEditorInput(instantiationService));
      }
    }));
    disposables.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
      command: {
        id: "workbench.profiles.actions.manageProfiles",
        category: Categories.Preferences,
        title: localize2("open profiles", "Open Profiles (UI)")
      }
    }));
    return disposables;
  }
  registerExportCurrentProfileAction() {
    const that = this;
    const disposables = new DisposableStore();
    const id = "workbench.profiles.actions.exportProfile";
    disposables.add(registerAction2(class ExportProfileAction extends Action2 {
      constructor() {
        super({
          id,
          title: localize2("export profile", "Export Profile..."),
          category: PROFILES_CATEGORY,
          f1: true
        });
      }
      async run() {
        const editor = await that.openProfilesEditor();
        editor?.selectProfile(that.userDataProfileService.currentProfile);
      }
    }));
    disposables.add(MenuRegistry.appendMenuItem(MenuId.MenubarShare, {
      command: {
        id,
        title: localize2("export profile in share", "Export Profile ({0})...", that.userDataProfileService.currentProfile.name)
      }
    }));
    return disposables;
  }
  registerCreateFromCurrentProfileAction() {
    const that = this;
    this._register(registerAction2(class CreateFromCurrentProfileAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.createFromCurrentProfile",
          title: localize2("save profile as", "Save Current Profile As..."),
          category: PROFILES_CATEGORY,
          f1: true
        });
      }
      async run() {
        const editor = await that.openProfilesEditor();
        editor?.createNewProfile(that.userDataProfileService.currentProfile);
      }
    }));
  }
  registerNewProfileAction() {
    const that = this;
    this._register(registerAction2(class CreateProfileAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.createProfile",
          title: localize2("create profile", "New Profile..."),
          category: PROFILES_CATEGORY,
          f1: true,
          menu: [
            {
              id: OpenProfileMenu,
              group: "1_manage_profiles",
              order: 1
            }
          ]
        });
      }
      async run(accessor) {
        const editor = await that.openProfilesEditor();
        return editor?.createNewProfile();
      }
    }));
  }
  registerDeleteProfileAction() {
    this._register(registerAction2(class DeleteProfileAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.deleteProfile",
          title: localize2("delete profile", "Delete Profile..."),
          category: PROFILES_CATEGORY,
          f1: true,
          precondition: HAS_PROFILES_CONTEXT
        });
      }
      async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const userDataProfileService = accessor.get(IUserDataProfileService);
        const userDataProfilesService = accessor.get(IUserDataProfilesService);
        const userDataProfileManagementService = accessor.get(IUserDataProfileManagementService);
        const notificationService = accessor.get(INotificationService);
        const profiles = userDataProfilesService.profiles.filter((p) => !p.isDefault && !p.isInternal);
        if (profiles.length) {
          const picks = await quickInputService.pick(
            profiles.map((profile) => ({
              label: profile.name,
              description: profile.id === userDataProfileService.currentProfile.id ? localize("current", "Current") : void 0,
              profile
            })),
            {
              title: localize("delete specific profile", "Delete Profile..."),
              placeHolder: localize("pick profile to delete", "Select Profiles to Delete"),
              canPickMany: true
            }
          );
          if (picks) {
            try {
              await Promise.all(picks.map((pick) => userDataProfileManagementService.removeProfile(pick.profile)));
            } catch (error) {
              notificationService.error(error);
            }
          }
        }
      }
    }));
  }
  registerHelpAction() {
    this._register(registerAction2(class HelpAction extends Action2 {
      constructor() {
        super({
          id: "workbench.profiles.actions.help",
          title: PROFILES_TITLE,
          category: Categories.Help,
          menu: [{
            id: MenuId.CommandPalette
          }]
        });
      }
      run(accessor) {
        return accessor.get(IOpenerService).open(URI.parse("https://aka.ms/vscode-profiles-help"));
      }
    }));
  }
  async reportWorkspaceProfileInfo() {
    await this.lifecycleService.when(LifecyclePhase.Eventually);
    const count = this.userDataProfilesService.profiles.filter((p) => !p.isInternal).length - 1;
    if (count > 0) {
      this.telemetryService.publicLog2("profiles:count", { count });
    }
    const workspaceId = await this.workspaceTagsService.getTelemetryWorkspaceId(this.workspaceContextService.getWorkspace(), this.workspaceContextService.getWorkbenchState());
    this.telemetryService.publicLog2("workspaceProfileInfo", {
      workspaceId,
      defaultProfile: this.userDataProfileService.currentProfile.isDefault
    });
  }
};
UserDataProfilesWorkbenchContribution = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IUserDataProfileManagementService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IWorkspaceTagsService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ILifecycleService),
  __decorateParam(10, IURLService),
  __decorateParam(11, IBrowserWorkbenchEnvironmentService)
], UserDataProfilesWorkbenchContribution);
export {
  OpenProfileMenu,
  UserDataProfilesWorkbenchContribution
};
