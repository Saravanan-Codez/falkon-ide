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
import { derived, observableValue } from "../../../../base/common/observable.js";
import { relativePath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { AICustomizationManagementSection } from "../../../../workbench/contrib/chat/common/aiCustomizationWorkspaceService.js";
import { IPromptsService } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { CustomizationCreatorService } from "../../../../workbench/contrib/chat/browser/aiCustomization/customizationCreatorService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { localize } from "../../../../nls.js";
import { AGENT_HOST_SCHEME } from "../../../../platform/agentHost/common/agentHostUri.js";
let SessionsAICustomizationWorkspaceService = class {
  constructor(sessionsService, instantiationService, promptsService, commandService, logService, fileService, notificationService) {
    this.sessionsService = sessionsService;
    this.instantiationService = instantiationService;
    this.promptsService = promptsService;
    this.commandService = commandService;
    this.logService = logService;
    this.fileService = fileService;
    this.notificationService = notificationService;
    this.managementSections = [
      AICustomizationManagementSection.Agents,
      AICustomizationManagementSection.Skills,
      AICustomizationManagementSection.Instructions,
      AICustomizationManagementSection.Hooks,
      AICustomizationManagementSection.Automations,
      AICustomizationManagementSection.McpServers,
      AICustomizationManagementSection.Plugins,
      AICustomizationManagementSection.Tools,
      AICustomizationManagementSection.HarnessSettings
    ];
    this.isSessionsWindow = true;
    this.welcomePageFeatures = {
      showGettingStartedBanner: true
    };
    this._overrideRoot = observableValue(this, void 0);
    this.activeProjectRoot = derived((reader) => {
      const override = this._overrideRoot.read(reader);
      if (override) {
        return override;
      }
      const session = this.sessionsService.activeSession.read(reader);
      const folder = session?.workspace.read(reader)?.folders[0];
      const root = folder?.workingDirectory;
      if (root?.scheme === AGENT_HOST_SCHEME) {
        return void 0;
      }
      return root;
    });
    this.hasOverrideProjectRoot = derived((reader) => {
      return this._overrideRoot.read(reader) !== void 0;
    });
  }
  getActiveProjectRoot() {
    const override = this._overrideRoot.get();
    if (override) {
      return override;
    }
    const session = this.sessionsService.activeSession.get();
    const folder = session?.workspace.get()?.folders[0];
    const root = folder?.workingDirectory;
    if (root?.scheme === AGENT_HOST_SCHEME) {
      return void 0;
    }
    return root;
  }
  setOverrideProjectRoot(root) {
    this._overrideRoot.set(root, void 0);
  }
  clearOverrideProjectRoot() {
    this._overrideRoot.set(void 0, void 0);
  }
  /**
   * Commits customization files. Always commits to the main repository
   * so the change persists across worktrees. When a worktree is active
   * the file is also committed there so the session sees it immediately.
   */
  async commitFiles(_projectRoot, fileUris) {
    const session = this.sessionsService.activeSession.get();
    const folder = session?.workspace.get()?.folders[0];
    if (!folder?.root) {
      return;
    }
    for (const fileUri of fileUris) {
      await this.commitFileToRepos(fileUri, folder.root, folder.workingDirectory);
    }
  }
  /**
   * Commits the deletion of files that have already been removed from disk.
   * Always stages + commits the removal in the main repository, and also
   * in the worktree if one is active.
   */
  async deleteFiles(_projectRoot, fileUris) {
    const session = this.sessionsService.activeSession.get();
    const folder = session?.workspace.get()?.folders[0];
    if (!folder?.root) {
      return;
    }
    for (const fileUri of fileUris) {
      await this.commitDeletionToRepos(fileUri, folder.root, folder.workingDirectory);
    }
  }
  /**
   * Computes the repository-relative path for a file. The file may be
   * located under the worktree or the repository root.
   */
  getRelativePath(fileUri, repositoryUri, worktreeUri) {
    if (worktreeUri) {
      const rel = relativePath(worktreeUri, fileUri);
      if (rel) {
        return rel;
      }
    }
    return relativePath(repositoryUri, fileUri);
  }
  /**
   * Commits a single file to the main repository and optionally the worktree.
   * Copies the file content between trees when needed.
   */
  async commitFileToRepos(fileUri, repositoryUri, worktreeUri) {
    const relPath = this.getRelativePath(fileUri, repositoryUri, worktreeUri);
    if (!relPath) {
      return;
    }
    const repoFileUri = URI.joinPath(repositoryUri, relPath);
    try {
      if (repoFileUri.toString() !== fileUri.toString()) {
        const content = await this.fileService.readFile(fileUri);
        await this.fileService.writeFile(repoFileUri, content.value);
      }
      await this.commandService.executeCommand(
        "github.copilot.cli.sessions.commitToRepository",
        { repositoryUri, fileUri: repoFileUri }
      );
    } catch (error) {
      this.logService.error("[SessionsAICustomizationWorkspaceService] Failed to commit to repository:", error);
      if (worktreeUri) {
        this.notificationService.notify({
          severity: Severity.Warning,
          message: localize("commitToRepoFailed", "Your customization was saved to this session's worktree, but we couldn't apply it to the default branch. You may need to apply it manually.")
        });
      }
    }
    if (worktreeUri) {
      const worktreeFileUri = URI.joinPath(worktreeUri, relPath);
      try {
        if (worktreeFileUri.toString() !== fileUri.toString()) {
          const content = await this.fileService.readFile(fileUri);
          await this.fileService.writeFile(worktreeFileUri, content.value);
        }
        await this.commandService.executeCommand(
          "github.copilot.cli.sessions.commitToWorktree",
          { worktreeUri, fileUri: worktreeFileUri }
        );
      } catch (error) {
        this.logService.error("[SessionsAICustomizationWorkspaceService] Failed to commit to worktree:", error);
      }
    }
  }
  /**
   * Commits the deletion of a file to the main repository and optionally
   * the worktree. The file is already deleted from disk before this is called;
   * `git add` on a deleted path stages the removal.
   */
  async commitDeletionToRepos(fileUri, repositoryUri, worktreeUri) {
    const relPath = this.getRelativePath(fileUri, repositoryUri, worktreeUri);
    if (!relPath) {
      return;
    }
    const repoFileUri = URI.joinPath(repositoryUri, relPath);
    try {
      if (await this.fileService.exists(repoFileUri)) {
        await this.fileService.del(repoFileUri, { useTrash: true, recursive: true });
      }
      await this.commandService.executeCommand(
        "github.copilot.cli.sessions.commitToRepository",
        { repositoryUri, fileUri: repoFileUri }
      );
    } catch (error) {
      this.logService.error("[SessionsAICustomizationWorkspaceService] Failed to commit deletion to repository:", error);
      if (worktreeUri) {
        this.notificationService.notify({
          severity: Severity.Warning,
          message: localize("deleteFromRepoFailed", "Your customization was removed from this session's worktree, but we couldn't apply the change to the default branch. You may need to remove it manually.")
        });
      }
    }
    if (worktreeUri) {
      const worktreeFileUri = URI.joinPath(worktreeUri, relPath);
      try {
        await this.commandService.executeCommand(
          "github.copilot.cli.sessions.commitToWorktree",
          { worktreeUri, fileUri: worktreeFileUri }
        );
      } catch (error) {
        this.logService.error("[SessionsAICustomizationWorkspaceService] Failed to commit deletion to worktree:", error);
      }
    }
  }
  async generateCustomization(type) {
    const creator = this.instantiationService.createInstance(CustomizationCreatorService);
    await creator.createWithAI(type);
  }
  async getFilteredPromptSlashCommands(token) {
    return await this.promptsService.getPromptSlashCommands(token);
  }
  static {
    this._skillUIIntegrations = /* @__PURE__ */ new Map([
      ["act-on-feedback", localize("skillUI.actOnFeedback", "Used by the Submit Feedback button in the Changes toolbar")],
      ["fix-ci", localize("skillUI.fixCi", "Used by the Fix Checks button in the Changes toolbar")],
      ["code-review", localize("skillUI.codeReview", "Used by the Run Code Review button in the Changes view")],
      ["generate-run-commands", localize("skillUI.generateRunCommands", "Used by the Run button in the title bar")],
      ["create-pr", localize("skillUI.createPr", "Used by the Create PR button in the Changes toolbar")],
      ["create-draft-pr", localize("skillUI.createDraftPr", "Used by the Create Draft PR button in the Changes toolbar")],
      ["update-pr", localize("skillUI.updatePr", "Used by the Update Pull Request button in the Changes toolbar")],
      ["merge-changes", localize("skillUI.mergeChanges", "Used by the Merge button in the Changes toolbar")],
      ["commit", localize("skillUI.commit", "Used by the Commit button in the Changes toolbar")]
    ]);
  }
  getSkillUIIntegrations() {
    return SessionsAICustomizationWorkspaceService._skillUIIntegrations;
  }
};
SessionsAICustomizationWorkspaceService = __decorateClass([
  __decorateParam(0, ISessionsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IPromptsService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IFileService),
  __decorateParam(6, INotificationService)
], SessionsAICustomizationWorkspaceService);
export {
  SessionsAICustomizationWorkspaceService
};
