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
import { constObservable, derived, derivedOpts, ObservablePromise } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { localize } from "../../../../../nls.js";
import { AgentSessionProviders } from "../../../../../workbench/contrib/chat/browser/agentSessions/agentSessions.js";
import { IGitService } from "../../../../../workbench/contrib/git/common/gitService.js";
import { BRANCH_CHANGES_CHANGESET_ID, gitHubInfoEqual, sessionFileChangesEqual } from "../../../../services/sessions/common/session.js";
import { IGitHubService } from "../../../github/browser/githubService.js";
import { toPRContentUri } from "../../../github/common/utils.js";
let GitRepositoryChangesetResolver = class {
  constructor(workspace, _gitService) {
    this._gitService = _gitService;
    this._repositoryUriObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      const gitRepository = workspace.read(reader)?.folders[0].gitRepository;
      return gitRepository?.workTreeUri ?? gitRepository?.uri;
    });
  }
  async resolve(firstCheckpointRef, lastCheckpointRef) {
    const repositoryUri = this._repositoryUriObs.get();
    if (!repositoryUri) {
      return [];
    }
    const repository = await this._gitService.openRepository(repositoryUri);
    const ref = lastCheckpointRef ? `${firstCheckpointRef}..${lastCheckpointRef}` : firstCheckpointRef;
    const changes = await repository?.diffBetweenWithStats2(ref) ?? [];
    return toIChatSessionFileChange2(changes, firstCheckpointRef, lastCheckpointRef);
  }
};
GitRepositoryChangesetResolver = __decorateClass([
  __decorateParam(1, IGitService)
], GitRepositoryChangesetResolver);
let GitHubRepositoryChangesetResolver = class {
  constructor(workspace, _gitHubService) {
    this._gitHubService = _gitHubService;
    this._gitHubInfoObs = derivedOpts({ equalsFn: gitHubInfoEqual }, (reader) => {
      const gitRepository = workspace.read(reader)?.folders[0].gitRepository;
      return gitRepository?.gitHubInfo.read(reader);
    });
  }
  async resolve(firstCheckpointRef, lastCheckpointRef) {
    const gitHubInfo = this._gitHubInfoObs.get();
    if (!gitHubInfo || !gitHubInfo.pullRequest?.number) {
      return void 0;
    }
    const params = {
      owner: gitHubInfo.owner,
      repo: gitHubInfo.repo,
      prNumber: gitHubInfo.pullRequest.number
    };
    const changes = await this._gitHubService.getChangedFiles(params.owner, params.repo, firstCheckpointRef, lastCheckpointRef);
    return changes.map((change) => {
      const uri = toPRContentUri(change.filename, {
        ...params,
        commitSha: lastCheckpointRef,
        status: change.status,
        isBase: false
      });
      const originalUri = change.status !== "added" ? toPRContentUri(change.previous_filename || change.filename, {
        ...params,
        commitSha: firstCheckpointRef,
        previousFileName: change.previous_filename,
        status: change.status,
        isBase: true
      }) : void 0;
      const modifiedUri = change.status !== "removed" ? uri : void 0;
      return {
        uri,
        originalUri,
        modifiedUri,
        insertions: change.additions,
        deletions: change.deletions
      };
    });
  }
};
GitHubRepositoryChangesetResolver = __decorateClass([
  __decorateParam(1, IGitHubService)
], GitHubRepositoryChangesetResolver);
function createChangesets(sessionType, workspaceObs, chatsObs, instantiationService) {
  const changesetResolver = sessionType === AgentSessionProviders.Cloud ? instantiationService.createInstance(GitHubRepositoryChangesetResolver, workspaceObs) : instantiationService.createInstance(GitRepositoryChangesetResolver, workspaceObs);
  const changesets = [new BranchChangesChangeset(workspaceObs, chatsObs)];
  if (sessionType !== AgentSessionProviders.Cloud) {
    changesets.push(new UncommittedChangesChangeset(workspaceObs, chatsObs, changesetResolver));
  }
  changesets.push(new AllChangesChangeset(chatsObs, changesetResolver));
  changesets.push(new LastTurnChangesChangeset(chatsObs, changesetResolver));
  return constObservable(changesets);
}
class AbstractChangeset {
  constructor(_chats) {
    this._chats = _chats;
    this.operations = constObservable([]);
  }
  async invokeOperation(_operationId, _target) {
  }
}
class BranchChangesChangeset extends AbstractChangeset {
  constructor(workspaceObs, chatsObs) {
    super(chatsObs);
    this.id = BranchChangesChangeset.ID;
    this.label = localize("branchChanges", "Branch Changes");
    this.category = localize("changesCategory", "Changes");
    this.isLoadingChanges = constObservable(false);
    this.modifiedCheckpointRef = constObservable(void 0);
    const gitRepository = workspaceObs.get()?.folders[0].gitRepository;
    const branchName = gitRepository?.branchName;
    const baseBranchName = gitRepository?.baseBranchName;
    this.description = branchName && baseBranchName ? `${branchName} \u2192 ${baseBranchName}` : branchName;
    this.originalCheckpointRef = derived((reader) => {
      return chatsObs.read(reader)[0]?.checkpoints.read(reader)?.firstCheckpointRef;
    });
    const isArchivedObs = derived((reader) => chatsObs.read(reader)[0]?.isArchived.read(reader) === true);
    this.isDefault = derived((reader) => !isArchivedObs.read(reader));
    this.isEnabled = derived((reader) => !isArchivedObs.read(reader));
    this.changes = derived((reader) => {
      return chatsObs.read(reader)[0]?.changes.read(reader) ?? [];
    });
  }
  static {
    this.ID = BRANCH_CHANGES_CHANGESET_ID;
  }
}
class UncommittedChangesChangeset extends AbstractChangeset {
  constructor(workspaceObs, chatsObs, changesetResolver) {
    super(chatsObs);
    this.id = UncommittedChangesChangeset.ID;
    this.label = localize("uncommittedChanges", "Uncommitted Changes");
    this.description = localize("uncommittedChangesDescription", "Show uncommitted changes in this session");
    this.category = localize("changesCategory", "Changes");
    this.isDefault = constObservable(false);
    this.originalCheckpointRef = constObservable("HEAD");
    this.modifiedCheckpointRef = constObservable(void 0);
    this.isEnabled = derived((reader) => chatsObs.read(reader)[0]?.isArchived.read(reader) !== true);
    const uncommittedChangesCountObs = derived((reader) => {
      const gitRepository = workspaceObs.read(reader)?.folders[0].gitRepository;
      return gitRepository?.uncommittedChanges ?? 0;
    });
    const changesPromiseObs = derived((reader) => {
      const originalCheckpointRef = this.originalCheckpointRef.read(reader);
      const modifiedCheckpointRef = this.modifiedCheckpointRef.read(reader);
      uncommittedChangesCountObs.read(reader);
      const diffPromise = changesetResolver.resolve(originalCheckpointRef, modifiedCheckpointRef);
      return new ObservablePromise(diffPromise).resolvedValue;
    });
    this.isLoadingChanges = derived((reader) => {
      return changesPromiseObs.read(reader).read(reader) === void 0;
    });
    this.changes = derivedOpts({ equalsFn: sessionFileChangesEqual }, (reader) => {
      return changesPromiseObs.read(reader).read(reader) ?? [];
    });
  }
  static {
    this.ID = "uncommittedChanges";
  }
}
class AllChangesChangeset extends AbstractChangeset {
  constructor(chatsObs, changesetResolver) {
    super(chatsObs);
    this.id = AllChangesChangeset.ID;
    this.label = localize("allChanges", "All Changes");
    this.description = localize("allChangesDescription", "Show all changes made in this session");
    this.category = localize("checkpointsCategory", "Checkpoints");
    this.originalCheckpointRef = derived((reader) => {
      return chatsObs.read(reader)[0]?.checkpoints.read(reader)?.firstCheckpointRef;
    });
    this.modifiedCheckpointRef = derived((reader) => {
      const chats = chatsObs.read(reader);
      if (chats.length === 0) {
        return void 0;
      }
      if (chats.length === 1) {
        return chats[0].checkpoints.read(reader)?.lastCheckpointRef;
      }
      const chatsSortedByLastTurnEnd = chats.toSorted((chatA, chatB) => {
        const chatALastTurnEnd = chatA.lastTurnEnd.read(reader);
        const chatBLastTurnEnd = chatB.lastTurnEnd.read(reader);
        return sortDateDesc(chatALastTurnEnd, chatBLastTurnEnd);
      });
      return chatsSortedByLastTurnEnd[0].checkpoints.read(reader)?.lastCheckpointRef;
    });
    const changesPromiseObs = derived((reader) => {
      const originalCheckpointRef = this.originalCheckpointRef.read(reader);
      const modifiedCheckpointRef = this.modifiedCheckpointRef.read(reader);
      if (!originalCheckpointRef || !modifiedCheckpointRef) {
        return constObservable([]);
      }
      const diffPromise = changesetResolver.resolve(originalCheckpointRef, modifiedCheckpointRef);
      return new ObservablePromise(diffPromise).resolvedValue;
    });
    this.isLoadingChanges = derived((reader) => {
      return changesPromiseObs.read(reader).read(reader) === void 0;
    });
    this.changes = derivedOpts({ equalsFn: sessionFileChangesEqual }, (reader) => {
      return changesPromiseObs.read(reader).read(reader) ?? [];
    });
    this.isDefault = derived((reader) => chatsObs.read(reader)[0]?.isArchived.read(reader) === true);
    this.isEnabled = derived((reader) => this.originalCheckpointRef.read(reader) !== void 0 && this.modifiedCheckpointRef.read(reader) !== void 0);
  }
  static {
    this.ID = "allChanges";
  }
}
class LastTurnChangesChangeset extends AbstractChangeset {
  constructor(chatsObs, changesetResolver) {
    super(chatsObs);
    this.id = LastTurnChangesChangeset.ID;
    this.label = localize("lastTurnChanges", "Last Turn Changes");
    this.description = localize("lastTurnChangesDescription", "Show only changes made in the last turn");
    this.category = localize("checkpointsCategory", "Checkpoints");
    this.isDefault = constObservable(false);
    this.modifiedCheckpointRef = derived((reader) => {
      const chats = chatsObs.read(reader);
      if (chats.length === 0) {
        return void 0;
      }
      if (chats.length === 1) {
        return chats[0].checkpoints.read(reader)?.lastCheckpointRef;
      }
      const chatsSortedByLastTurnEnd = chats.toSorted((chatA, chatB) => {
        const chatALastTurnEnd = chatA.lastTurnEnd.read(reader);
        const chatBLastTurnEnd = chatB.lastTurnEnd.read(reader);
        return sortDateDesc(chatALastTurnEnd, chatBLastTurnEnd);
      });
      return chatsSortedByLastTurnEnd[0].checkpoints.read(reader)?.lastCheckpointRef;
    });
    this.originalCheckpointRef = derived((reader) => {
      const modifiedCheckpointRef = this.modifiedCheckpointRef.read(reader);
      return modifiedCheckpointRef ? `${modifiedCheckpointRef}^` : void 0;
    });
    const changesPromiseObs = derived((reader) => {
      const originalCheckpointRef = this.originalCheckpointRef.read(reader);
      const modifiedCheckpointRef = this.modifiedCheckpointRef.read(reader);
      if (!originalCheckpointRef || !modifiedCheckpointRef) {
        return constObservable([]);
      }
      const diffPromise = changesetResolver.resolve(originalCheckpointRef, modifiedCheckpointRef);
      return new ObservablePromise(diffPromise).resolvedValue;
    });
    this.isLoadingChanges = derived((reader) => {
      return changesPromiseObs.read(reader).read(reader) === void 0;
    });
    this.changes = derivedOpts({ equalsFn: sessionFileChangesEqual }, (reader) => {
      return changesPromiseObs.read(reader).read(reader) ?? [];
    });
    this.isEnabled = derived((reader) => this.originalCheckpointRef.read(reader) !== void 0 && this.modifiedCheckpointRef.read(reader) !== void 0);
  }
  static {
    this.ID = "lastTurnChanges";
  }
}
function sortDateDesc(dateA, dateB) {
  const chatALastTurnEnd = dateA?.getTime();
  const chatBLastTurnEnd = dateB?.getTime();
  if (!chatALastTurnEnd && !chatBLastTurnEnd) {
    return 0;
  }
  if (!chatALastTurnEnd) {
    return 1;
  }
  if (!chatBLastTurnEnd) {
    return -1;
  }
  return chatBLastTurnEnd - chatALastTurnEnd;
}
function toIChatSessionFileChange2(changes, originalRef, modifiedRef) {
  return changes.map((change) => ({
    uri: change.uri,
    originalUri: change.originalUri ? originalRef ? change.originalUri.with({ scheme: "git", query: JSON.stringify({ path: change.originalUri.fsPath, ref: originalRef }) }) : change.originalUri : void 0,
    modifiedUri: change.modifiedUri ? modifiedRef ? change.modifiedUri.with({ scheme: "git", query: JSON.stringify({ path: change.modifiedUri.fsPath, ref: modifiedRef }) }) : change.modifiedUri : void 0,
    insertions: change.insertions,
    deletions: change.deletions
  }));
}
export {
  AllChangesChangeset,
  BranchChangesChangeset,
  LastTurnChangesChangeset,
  UncommittedChangesChangeset,
  createChangesets
};
