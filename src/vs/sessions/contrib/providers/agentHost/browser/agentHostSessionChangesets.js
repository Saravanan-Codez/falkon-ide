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
import { arrayEqualsC, structuralEquals } from "../../../../../base/common/equals.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { constObservable, derived, derivedObservableWithCache, derivedOpts, mapObservableArrayCached, observableFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { format } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isDefined } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ChangesetOperationTargetKind } from "../../../../../platform/agentHost/common/state/protocol/channels-changeset/commands.js";
import { ChangesetOperationScope, ChangesetOperationStatus } from "../../../../../platform/agentHost/common/state/protocol/state.js";
import { ActionType } from "../../../../../platform/agentHost/common/state/sessionActions.js";
import { buildDefaultChatUri, ChangesetStatus, StateComponents } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { SessionChangesetOperationScope, SessionChangesetOperationStatus, sessionFileChangesEqual } from "../../../../services/sessions/common/session.js";
import { changesetFileToChange } from "./agentHostDiffs.js";
var ChangesetKind = /* @__PURE__ */ ((ChangesetKind2) => {
  ChangesetKind2["Branch"] = "branch";
  ChangesetKind2["Uncommitted"] = "uncommitted";
  ChangesetKind2["Session"] = "session";
  ChangesetKind2["Turn"] = "turn";
  ChangesetKind2["Compare"] = "compare-turns";
  return ChangesetKind2;
})(ChangesetKind || {});
function createChangesets(sessionUri, options, isActiveSessionObs, changesets) {
  if (!changesets) {
    return [];
  }
  const sessionChangesets = [];
  const defaultChangeset = changesets.find((c) => c.changeKind === "branch" /* Branch */) ?? changesets[0];
  for (const changeset of changesets) {
    const isDefault = changeset === defaultChangeset;
    if (changeset.changeKind === "branch" /* Branch */ || changeset.changeKind === "uncommitted" /* Uncommitted */ || changeset.changeKind === "session" /* Session */) {
      sessionChangesets.push(options.instantiationService.createInstance(AgentHostChangeset, options, isActiveSessionObs, {
        ...changeset,
        isDefault
      }));
    } else if (changeset.changeKind === "turn" /* Turn */) {
      sessionChangesets.push(options.instantiationService.createInstance(AgentHostLastTurnChangeset, sessionUri, options, isActiveSessionObs, {
        ...changeset,
        isDefault
      }));
    }
  }
  return sessionChangesets;
}
function createActiveSessionSubscriptionObs(options, isActiveSessionObs, component, resourceObs) {
  return derived((reader) => {
    const connection = options.getConnection();
    if (!connection) {
      return constObservable(null);
    }
    const resource = resourceObs.read(reader);
    if (!resource) {
      return constObservable(null);
    }
    const isActiveSession = isActiveSessionObs.read(reader);
    if (!isActiveSession) {
      return constObservable(null);
    }
    const subscriptionRef = connection.getSubscription(component, resource, "AgentHostSessionChangesets");
    reader.store.add(subscriptionRef);
    return observableFromEvent(
      subscriptionRef.object.onDidChange,
      () => subscriptionRef.object.value
    );
  });
}
function selectMostRecentChatUri(sessionState, sessionUri) {
  if (!sessionState || sessionState instanceof Error) {
    return URI.parse(buildDefaultChatUri(sessionUri));
  }
  const mostRecentChat = sessionState.chats.reduce(
    (best, c) => !best || c.modifiedAt > best.modifiedAt ? c : best,
    void 0
  );
  return URI.parse(mostRecentChat?.resource ?? sessionState.defaultChat ?? buildDefaultChatUri(sessionUri));
}
function toSessionChangesetOperationScope(scope) {
  switch (scope) {
    case ChangesetOperationScope.Changeset:
      return SessionChangesetOperationScope.Changeset;
    case ChangesetOperationScope.Resource:
      return SessionChangesetOperationScope.Resource;
    case ChangesetOperationScope.Range:
      return SessionChangesetOperationScope.Range;
    default:
      throw new Error(`Unknown ChangesetOperationScope: ${scope}`);
  }
}
function toSessionChangesetOperationStatus(status) {
  switch (status) {
    case ChangesetOperationStatus.Idle:
      return SessionChangesetOperationStatus.Idle;
    case ChangesetOperationStatus.Running:
      return SessionChangesetOperationStatus.Running;
    case ChangesetOperationStatus.Error:
      return SessionChangesetOperationStatus.Error;
    case ChangesetOperationStatus.Disabled:
      return SessionChangesetOperationStatus.Disabled;
    default:
      throw new Error(`Unknown ChangesetOperationStatus: ${status}`);
  }
}
function toSessionChangesetOperation(operation) {
  return {
    id: operation.id,
    label: operation.label,
    description: operation.description,
    icon: operation.icon ? ThemeIcon.fromId(operation.icon) : void 0,
    group: operation.group,
    confirmation: operation.confirmation ? typeof operation.confirmation === "string" ? operation.confirmation : new MarkdownString(operation.confirmation.markdown, {
      isTrusted: false,
      supportThemeIcons: true
    }) : void 0,
    scopes: operation.scopes.map(toSessionChangesetOperationScope),
    status: toSessionChangesetOperationStatus(operation.status)
  };
}
class AbstractAgentHostChangeset {
  constructor(changeset, _options, _dialogService) {
    this._options = _options;
    this._dialogService = _dialogService;
    this.originalCheckpointRef = observableValue(this, void 0);
    this.modifiedCheckpointRef = observableValue(this, void 0);
    this.capabilities = {
      review: changeset.capabilities?.review !== void 0
    };
    this.isLoadingChanges = derived((reader) => {
      const changesetState = this.changesetStateObs.read(reader).read(reader);
      if (changesetState === void 0) {
        return true;
      }
      if (changesetState === null || changesetState instanceof Error) {
        return false;
      }
      return changesetState.status === ChangesetStatus.Computing;
    });
    const mapDiffUri = this._options.mapDiffUri;
    this._changesetFilesObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const changesetState = this.changesetStateObs.read(reader).read(reader);
      if (changesetState === null || changesetState instanceof Error) {
        return [];
      }
      if (changesetState === void 0) {
        return lastValue;
      }
      if (changesetState.status !== ChangesetStatus.Ready && lastValue !== void 0) {
        return lastValue;
      }
      return changesetState.files;
    });
    const mappedChangesObs = mapObservableArrayCached(
      this,
      this._changesetFilesObs.map((files) => files ?? []),
      (file) => changesetFileToChange(file, mapDiffUri)
    );
    const changesObs = derived(this, (reader) => {
      return mappedChangesObs.read(reader).filter(isDefined);
    });
    this.changes = derivedOpts({ equalsFn: sessionFileChangesEqual }, (reader) => {
      return changesObs.read(reader) ?? [];
    });
    const operationsObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const changesetState = this.changesetStateObs.read(reader).read(reader);
      if (changesetState === null || changesetState instanceof Error) {
        return [];
      }
      if (changesetState === void 0) {
        return lastValue ?? [];
      }
      return changesetState.operations?.map(toSessionChangesetOperation) ?? [];
    });
    this.operations = derivedOpts({ equalsFn: arrayEqualsC(structuralEquals) }, (reader) => {
      return operationsObs.read(reader) ?? [];
    });
  }
  async invokeOperation(operationId, target) {
    const connection = this._options.getConnection();
    if (!connection) {
      return;
    }
    const channel = this.channelUriObs.get();
    if (!channel) {
      return;
    }
    const operation = this.operations.get().find((o) => o.id === operationId);
    if (operation?.confirmation) {
      const message = typeof operation.confirmation === "string" ? operation.confirmation : operation.confirmation.value;
      const { confirmed } = await this._dialogService.confirm({
        type: "warning",
        message: target?.kind === "resource" ? format(message, basename(target.resource)) : message,
        primaryButton: operation.label
      });
      if (!confirmed) {
        return;
      }
    }
    await connection.invokeChangesetOperation({
      operationId,
      channel: channel.toString(),
      target: target?.kind === "resource" ? {
        kind: ChangesetOperationTargetKind.Resource,
        resource: target.resource.toString()
      } : void 0
    });
  }
  setReviewState(resources, reviewed) {
    if (!this.capabilities.review) {
      return;
    }
    const connection = this._options.getConnection();
    const channel = this.channelUriObs.get();
    if (!connection || !channel) {
      return;
    }
    const files = resources.map((resource) => {
      const file = this._changesetFilesObs.get()?.find((candidate) => {
        const change = changesetFileToChange(candidate, this._options.mapDiffUri);
        return isEqual(change?.modifiedUri, resource) || isEqual(change?.originalUri, resource);
      });
      if (!file) {
        throw new Error(`Resource '${resource.toString()}' is not part of changeset '${this.id}'`);
      }
      return file.id;
    });
    if (files.length === 0) {
      return;
    }
    connection.dispatch(channel.toString(), {
      type: ActionType.ChangesetFilesReviewChanged,
      files,
      reviewed
    });
  }
}
let AgentHostChangeset = class extends AbstractAgentHostChangeset {
  constructor(options, isActiveSessionObs, changesetSummary, dialogService) {
    super(changesetSummary, options, dialogService);
    this.isEnabled = constObservable(true);
    this.channelUriObs = constObservable(URI.parse(changesetSummary.uriTemplate));
    this.changesetStateObs = createActiveSessionSubscriptionObs(
      options,
      isActiveSessionObs,
      StateComponents.Changeset,
      this.channelUriObs
    );
    this.id = changesetSummary.changeKind;
    this._label = changesetSummary.label;
    this._description = changesetSummary.description;
    this.isDefault = constObservable(changesetSummary.isDefault);
  }
  get label() {
    return this._label;
  }
  get description() {
    return this._description;
  }
};
AgentHostChangeset = __decorateClass([
  __decorateParam(3, IDialogService)
], AgentHostChangeset);
let AgentHostLastTurnChangeset = class extends AbstractAgentHostChangeset {
  constructor(sessionUri, options, isActiveSessionObs, changesetSummary, dialogService) {
    super(changesetSummary, options, dialogService);
    this.label = localize("lastTurnChanges", "Last Turn Changes");
    this.description = localize("lastTurnChangesDescription", "Show only changes made in the last turn");
    this.isDefault = observableValue(this, false);
    this.id = changesetSummary.changeKind;
    const sessionStateObs = createActiveSessionSubscriptionObs(
      options,
      isActiveSessionObs,
      StateComponents.Session,
      constObservable(sessionUri)
    );
    const mostRecentChatUriObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      const sessionState = sessionStateObs.read(reader).read(reader);
      return selectMostRecentChatUri(sessionState, sessionUri);
    });
    const chatStateObs = createActiveSessionSubscriptionObs(
      options,
      isActiveSessionObs,
      StateComponents.Chat,
      mostRecentChatUriObs
    );
    const lastTurnIdObs = derived((reader) => {
      const chatState = chatStateObs.read(reader).read(reader);
      if (!chatState || chatState instanceof Error) {
        return void 0;
      }
      return chatState.activeTurn?.id ?? chatState.turns?.at(-1)?.id;
    });
    this.channelUriObs = derivedOpts({ equalsFn: isEqual }, (reader) => {
      const lastTurnId = lastTurnIdObs.read(reader);
      if (!lastTurnId) {
        return void 0;
      }
      const uri = changesetSummary.uriTemplate.replace("{turnId}", lastTurnId);
      return uri ? URI.parse(uri) : void 0;
    });
    this.changesetStateObs = createActiveSessionSubscriptionObs(
      options,
      isActiveSessionObs,
      StateComponents.Changeset,
      this.channelUriObs
    );
    this.isEnabled = derived((reader) => this.channelUriObs.read(reader) !== void 0);
  }
};
AgentHostLastTurnChangeset = __decorateClass([
  __decorateParam(4, IDialogService)
], AgentHostLastTurnChangeset);
export {
  createActiveSessionSubscriptionObs,
  createChangesets,
  selectMostRecentChatUri
};
