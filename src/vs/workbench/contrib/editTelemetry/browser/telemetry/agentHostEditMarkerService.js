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
import { raceTimeout } from "../../../../../base/common/async.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { ActionType } from "../../../../../platform/agentHost/common/state/protocol/common/actions.js";
import { ToolResultContentType } from "../../../../../platform/agentHost/common/state/sessionState.js";
import { IAgentHostConnectionsService } from "../../../../../platform/agentHost/common/agentHostConnectionsService.js";
import { toAgentHostUri } from "../../../../../platform/agentHost/common/agentHostUri.js";
import { buildCancelEditAttributionResource, buildCommitEditAttributionResource, buildPrepareEditAttributionResource, createFileEditContentDigest, getFileEditAttributionMarker } from "../../../../../platform/agentHost/common/fileEditAttribution.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditSources } from "../../../../../editor/common/textModelEditSource.js";
const MARKER_TTL = 5 * 60 * 1e3;
const ROUTE_TTL = 10 * 60 * 60 * 1e3;
const MAX_MARKERS_PER_RESOURCE = 128;
const MAX_OBSERVATIONS_PER_RESOURCE = 128;
const MAX_ROUTES = 1e3;
const MAX_COVERAGE_GAP_ACKNOWLEDGEMENTS = 1e3;
const COORDINATION_TIMEOUT = 15e3;
class AgentHostEditAttributionUnknownOutcomeError extends Error {
  constructor(cause) {
    super("The Agent Host edit attribution outcome is unknown", { cause });
  }
}
class AgentHostEditAttributionDeferredError extends Error {
  constructor(cause) {
    super("The Agent Host edit attribution was deferred", { cause });
  }
}
let AgentHostEditMarkerService = class extends Disposable {
  constructor(_connectionsService, _uriIdentityService) {
    super();
    this._connectionsService = _connectionsService;
    this._uriIdentityService = _uriIdentityService;
    this._markers = /* @__PURE__ */ new Map();
    this._observations = /* @__PURE__ */ new Map();
    this._routes = /* @__PURE__ */ new Map();
    this._coverageGaps = /* @__PURE__ */ new Map();
    this._acknowledgedCoverageGapIds = /* @__PURE__ */ new Map();
    this._pendingCoverageGapAcknowledgements = /* @__PURE__ */ new Map();
    this._onDidSuppress = this._register(new Emitter());
    this._onDidResolve = this._register(new Emitter());
    this._onDidInvalidate = this._register(new Emitter());
    this._onDidReceiveMarker = this._register(new Emitter());
    this._connectionListeners = this._register(new DisposableStore());
    this._updateConnectionListeners();
    this._register(this._connectionsService.onDidChangeConnections(() => this._updateConnectionListeners()));
  }
  createCorrelation(resource) {
    const resourceKey = this._key(resource);
    let currentRegistration;
    let clearRegistrationScheduled = false;
    return {
      onDidSuppress: this._onDidSuppress.event,
      onDidResolve: this._onDidResolve.event,
      onDidInvalidate: this._onDidInvalidate.event,
      register: (before, after) => {
        if (currentRegistration?.before === before && currentRegistration.after === after) {
          this._retainObservation(resourceKey, currentRegistration.id);
          return currentRegistration.id;
        }
        const id = this._registerObservation(resourceKey, before, after);
        currentRegistration = { before, after, id };
        if (!clearRegistrationScheduled) {
          clearRegistrationScheduled = true;
          queueMicrotask(() => {
            currentRegistration = void 0;
            clearRegistrationScheduled = false;
          });
        }
        return id;
      },
      isSuppressed: (id) => this._getObservation(resourceKey, id)?.resolution !== void 0,
      getResolution: (id) => this._getObservation(resourceKey, id)?.resolution,
      waitForResolution: (ids, timeoutMs) => this._waitForResolution(resourceKey, ids, timeoutMs),
      release: (id) => this._releaseObservation(resourceKey, id)
    };
  }
  takeCoverageGap(resource, throughSequence = Number.MAX_SAFE_INTEGER) {
    const resourceKey = this._key(resource);
    this._prune(resourceKey);
    const state = this._coverageGaps.get(resourceKey);
    if (!state) {
      return void 0;
    }
    const included = state.entries.filter((entry) => entry.sequence <= throughSequence);
    const remaining = state.entries.filter((entry) => entry.sequence > throughSequence);
    const editCount = included.reduce((sum, entry) => sum + entry.editCount, 0);
    const insertedCount = included.reduce((sum, entry) => sum + entry.insertedCount, 0);
    if (remaining.length > 0) {
      this._coverageGaps.set(resourceKey, {
        entries: remaining,
        timestamp: state.timestamp
      });
    } else {
      this._coverageGaps.delete(resourceKey);
    }
    return editCount > 0 || insertedCount > 0 ? { editCount, insertedCount } : void 0;
  }
  async prepareFlush(resource, trigger, statsUuid, isDirty, languageId = "plaintext") {
    const resourceKey = this._key(resource);
    this._prune(resourceKey);
    const route = this._routes.get(resourceKey);
    if (!route) {
      return void 0;
    }
    const flushToken = generateUuid();
    try {
      const result = await this._resourceRead(route.connection, buildPrepareEditAttributionResource({
        resource: route.resource,
        trigger,
        statsUuid,
        isDirty,
        flushToken,
        languageId
      }));
      const prepared = JSON.parse(result.data);
      if (prepared && (prepared.flushToken !== flushToken || !Number.isSafeInteger(prepared.agentModifiedCount) || prepared.agentModifiedCount < 0 || prepared.lastSequence !== void 0 && (!Number.isSafeInteger(prepared.lastSequence) || prepared.lastSequence < 0) || prepared.coverageGapThroughSequence !== void 0 && (!Number.isSafeInteger(prepared.coverageGapThroughSequence) || prepared.coverageGapThroughSequence < 0 || prepared.lastSequence === void 0 || prepared.coverageGapThroughSequence > prepared.lastSequence) || prepared.standaloneCoverageGapAcknowledgements !== void 0 && prepared.lastSequence === void 0 || !isValidCoverageGapAcknowledgements(prepared.standaloneCoverageGapAcknowledgements, prepared.lastSequence))) {
        throw new Error("Agent Host edit attribution returned an invalid prepared flush");
      }
      if (prepared?.lastSequence !== void 0) {
        await this._waitForMarker(resourceKey, route.connection, prepared.lastSequence);
      }
      if (prepared?.standaloneCoverageGapAcknowledgements !== void 0) {
        this._acknowledgeCoverageGaps(resourceKey, prepared.standaloneCoverageGapAcknowledgements);
      }
      return prepared ? {
        ...prepared,
        commit: async (totalModifiedCount) => {
          let commitError = new Error(`Agent Host edit attribution commit failed: ${prepared.flushToken}`);
          try {
            const result2 = await this._readOutcome(route.connection, buildCommitEditAttributionResource({
              flushToken: prepared.flushToken,
              totalModifiedCount
            }));
            if (result2.outcome === "committed") {
              return;
            }
            commitError = new Error(`Agent Host edit attribution commit was not found: ${prepared.flushToken}`);
          } catch (error) {
            commitError = error;
          }
          let cancelResult;
          try {
            cancelResult = await this._readOutcome(route.connection, buildCancelEditAttributionResource({
              flushToken: prepared.flushToken
            }));
          } catch (cancelError) {
            throw new AgentHostEditAttributionUnknownOutcomeError(new AggregateError(
              [commitError, cancelError],
              "Failed to commit or cancel Agent Host edit attribution"
            ));
          }
          if (cancelResult.outcome === "committed") {
            return;
          }
          throw new AgentHostEditAttributionDeferredError(commitError);
        }
      } : void 0;
    } catch (prepareError) {
      return this._recoverFailedPrepare(route.connection, resourceKey, flushToken, prepareError);
    }
  }
  async _recoverFailedPrepare(connection, resourceKey, flushToken, prepareError) {
    let cancelResult;
    try {
      cancelResult = await this._readOutcome(connection, buildCancelEditAttributionResource({ flushToken }));
    } catch (cancelError) {
      throw new AgentHostEditAttributionUnknownOutcomeError(new AggregateError(
        [prepareError, cancelError],
        "Failed to prepare or cancel Agent Host edit attribution"
      ));
    }
    if (cancelResult.outcome === "committed") {
      let deferCoverageGap = false;
      if (cancelResult.lastSequence !== void 0) {
        try {
          await this._waitForMarker(resourceKey, connection, cancelResult.lastSequence);
        } catch (markerError) {
          throw new AgentHostEditAttributionUnknownOutcomeError(new AggregateError(
            [prepareError, markerError],
            "Committed Agent Host attribution markers did not arrive"
          ));
        }
      }
      if (cancelResult.standaloneCoverageGapAcknowledgements?.length) {
        try {
          await this._waitForMarker(resourceKey, connection, getLastAcknowledgedSequence(cancelResult.standaloneCoverageGapAcknowledgements));
          this._acknowledgeCoverageGaps(resourceKey, cancelResult.standaloneCoverageGapAcknowledgements);
        } catch {
          this._queuePendingCoverageGapAcknowledgements(resourceKey, cancelResult.standaloneCoverageGapAcknowledgements);
          deferCoverageGap = true;
        }
      }
      return {
        flushToken,
        agentModifiedCount: cancelResult.agentModifiedCount,
        lastSequence: cancelResult.lastSequence,
        coverageGapThroughSequence: cancelResult.coverageGapThroughSequence,
        deferCoverageGap,
        commit: async () => {
        }
      };
    }
    throw new AgentHostEditAttributionDeferredError(prepareError);
  }
  async _waitForMarker(resourceKey, connection, sequence) {
    const isCaughtUp = () => {
      const route = this._routes.get(resourceKey);
      return route?.connection === connection && route.lastSequence >= sequence;
    };
    if (isCaughtUp()) {
      return;
    }
    const marker = await raceTimeout(Event.toPromise(Event.filter(
      this._onDidReceiveMarker.event,
      (event) => event.resourceKey === resourceKey && event.connection === connection && event.sequence >= sequence
    )), COORDINATION_TIMEOUT);
    if (!marker && !isCaughtUp()) {
      throw new Error(`Timed out waiting for Agent Host edit attribution marker: ${sequence}`);
    }
  }
  async _resourceRead(connection, resource) {
    const result = await raceTimeout(connection.resourceRead(resource), COORDINATION_TIMEOUT);
    if (!result) {
      throw new Error(`Agent Host edit attribution request timed out: ${resource.path}`);
    }
    return result;
  }
  async _readOutcome(connection, resource) {
    const result = await this._resourceRead(connection, resource);
    const parsed = JSON.parse(result.data);
    if (parsed.outcome !== "committed" && parsed.outcome !== "cancelled" && parsed.outcome !== "missing" || typeof parsed.agentModifiedCount !== "number" || parsed.lastSequence !== void 0 && (!Number.isSafeInteger(parsed.lastSequence) || parsed.lastSequence < 0) || parsed.coverageGapThroughSequence !== void 0 && (!Number.isSafeInteger(parsed.coverageGapThroughSequence) || parsed.coverageGapThroughSequence < 0 || parsed.lastSequence === void 0 || parsed.coverageGapThroughSequence > parsed.lastSequence) || parsed.standaloneCoverageGapAcknowledgements !== void 0 && parsed.lastSequence === void 0 || !isValidCoverageGapAcknowledgements(parsed.standaloneCoverageGapAcknowledgements)) {
      throw new Error(`Invalid Agent Host edit attribution outcome: ${resource.path}`);
    }
    return {
      outcome: parsed.outcome,
      agentModifiedCount: parsed.agentModifiedCount,
      lastSequence: parsed.lastSequence,
      coverageGapThroughSequence: parsed.coverageGapThroughSequence,
      standaloneCoverageGapAcknowledgements: parsed.standaloneCoverageGapAcknowledgements
    };
  }
  _updateConnectionListeners() {
    this._connectionListeners.clear();
    const activeConnections = new Set(this._connectionsService.connections.flatMap((info) => info.connection ? [info.connection] : []));
    for (const [resourceKey, route] of this._routes) {
      if (!activeConnections.has(route.connection)) {
        this._invalidateObservations(resourceKey);
        this._routes.delete(resourceKey);
      }
    }
    for (const connectionInfo of this._connectionsService.connections) {
      const connection = connectionInfo.connection;
      if (!connection) {
        continue;
      }
      this._connectionListeners.add(connection.onDidAction((envelope) => {
        const action = envelope.action;
        if (action.type !== ActionType.ChatToolCallComplete) {
          return;
        }
        for (const content of action.result.content ?? []) {
          if (content.type !== ToolResultContentType.FileEdit) {
            continue;
          }
          const marker = getFileEditAttributionMarker(content);
          const resourceUri = content.after?.uri ?? content.before?.uri;
          if (!marker || !resourceUri) {
            continue;
          }
          const resource = toAgentHostUri(URI.parse(resourceUri), connectionInfo.authority);
          const resourceKey = this._key(resource);
          const previousRoute = this._routes.get(resourceKey);
          if (previousRoute && (previousRoute.connection !== connection || marker.sequence <= previousRoute.lastSequence)) {
            this._invalidateObservations(resourceKey);
          }
          this._routes.delete(resourceKey);
          this._routes.set(resourceKey, {
            connection,
            resource: URI.parse(resourceUri),
            timestamp: Date.now(),
            lastSequence: marker.sequence
          });
          this._onDidReceiveMarker.fire({ resourceKey, connection, sequence: marker.sequence });
          while (this._routes.size > MAX_ROUTES) {
            const oldestKey = this._routes.keys().next().value;
            if (oldestKey === void 0) {
              break;
            }
            this._invalidateObservations(oldestKey);
            this._routes.delete(oldestKey);
          }
          if (marker.status === "skipped") {
            this._recordCoverageGap(resourceKey, marker.sequence, marker.untrackedEditCount ?? 1, marker.insertedCount);
          } else {
            this._recordMarker(resourceKey, marker);
          }
          this._applyPendingCoverageGapAcknowledgements(resourceKey);
        }
      }));
    }
  }
  _recordCoverageGap(resourceKey, sequence, editCount, insertedCount) {
    const existing = this._coverageGaps.get(resourceKey) ?? { entries: [], timestamp: Date.now() };
    if (existing.entries.some((entry) => entry.sequence === sequence)) {
      return;
    }
    existing.entries.push({ sequence, editCount, insertedCount });
    existing.timestamp = Date.now();
    this._coverageGaps.delete(resourceKey);
    this._coverageGaps.set(resourceKey, existing);
    while (this._coverageGaps.size > MAX_ROUTES) {
      const oldestKey = this._coverageGaps.keys().next().value;
      if (oldestKey === void 0) {
        break;
      }
      this._coverageGaps.delete(oldestKey);
    }
  }
  _acknowledgeCoverageGaps(resourceKey, acknowledgements) {
    const remaining = [];
    for (const acknowledgement of acknowledgements) {
      const acknowledgementKey = coverageGapAcknowledgementKey(resourceKey, acknowledgement.id);
      if (this._acknowledgedCoverageGapIds.has(acknowledgementKey)) {
        continue;
      }
      const state = this._coverageGaps.get(resourceKey);
      if (!state) {
        this._recordCoverageGapAcknowledgement(acknowledgementKey);
        continue;
      }
      const acknowledgedSequences = new Set(acknowledgement.sequences);
      const matched = state.entries.filter((entry) => acknowledgedSequences.has(entry.sequence));
      const matchedEditCount = matched.reduce((sum, entry) => sum + entry.editCount, 0);
      const matchedInsertedCount = matched.reduce((sum, entry) => sum + entry.insertedCount, 0);
      if (matched.length !== acknowledgement.sequences.length || matchedEditCount !== acknowledgement.editCount || matchedInsertedCount !== acknowledgement.insertedCount) {
        remaining.push(acknowledgement);
        continue;
      }
      state.entries.splice(0, state.entries.length, ...state.entries.filter((entry) => !acknowledgedSequences.has(entry.sequence)));
      if (state.entries.length > 0) {
        this._coverageGaps.set(resourceKey, state);
      } else {
        this._coverageGaps.delete(resourceKey);
      }
      this._recordCoverageGapAcknowledgement(acknowledgementKey);
    }
    return remaining;
  }
  _recordCoverageGapAcknowledgement(acknowledgementKey) {
    this._acknowledgedCoverageGapIds.delete(acknowledgementKey);
    this._acknowledgedCoverageGapIds.set(acknowledgementKey, Date.now());
    while (this._acknowledgedCoverageGapIds.size > MAX_COVERAGE_GAP_ACKNOWLEDGEMENTS) {
      const oldestKey = this._acknowledgedCoverageGapIds.keys().next().value;
      if (oldestKey === void 0) {
        break;
      }
      this._acknowledgedCoverageGapIds.delete(oldestKey);
    }
  }
  _queuePendingCoverageGapAcknowledgements(resourceKey, acknowledgements) {
    const pending = new Map(
      (this._pendingCoverageGapAcknowledgements.get(resourceKey)?.acknowledgements ?? []).map((acknowledgement) => [acknowledgement.id, acknowledgement])
    );
    for (const acknowledgement of acknowledgements) {
      pending.set(acknowledgement.id, acknowledgement);
    }
    this._pendingCoverageGapAcknowledgements.delete(resourceKey);
    this._pendingCoverageGapAcknowledgements.set(resourceKey, {
      acknowledgements: Array.from(pending.values()),
      timestamp: Date.now()
    });
    while (this._pendingCoverageGapAcknowledgements.size > MAX_ROUTES) {
      const oldestKey = this._pendingCoverageGapAcknowledgements.keys().next().value;
      if (oldestKey === void 0) {
        break;
      }
      this._pendingCoverageGapAcknowledgements.delete(oldestKey);
    }
  }
  _applyPendingCoverageGapAcknowledgements(resourceKey) {
    const pending = this._pendingCoverageGapAcknowledgements.get(resourceKey);
    const route = this._routes.get(resourceKey);
    if (!pending || !route || route.lastSequence < getLastAcknowledgedSequence(pending.acknowledgements)) {
      return;
    }
    this._pendingCoverageGapAcknowledgements.delete(resourceKey);
    const remaining = this._acknowledgeCoverageGaps(resourceKey, pending.acknowledgements);
    if (remaining.length > 0) {
      this._queuePendingCoverageGapAcknowledgements(resourceKey, remaining);
    }
  }
  _registerObservation(resourceKey, before, after) {
    this._prune(resourceKey);
    const observation = {
      id: generateUuid(),
      beforeDigest: createFileEditContentDigest(before),
      afterDigest: createFileEditContentDigest(after),
      timestamp: Date.now(),
      referenceCount: 1
    };
    const observations = this._observations.get(resourceKey) ?? [];
    if (observations.length >= MAX_OBSERVATIONS_PER_RESOURCE) {
      return observation.id;
    }
    observations.push(observation);
    this._observations.set(resourceKey, observations);
    this._tryResolve(resourceKey, observation);
    return observation.id;
  }
  _recordMarker(resourceKey, marker) {
    this._prune(resourceKey);
    const markers = this._markers.get(resourceKey) ?? [];
    if (!markers.some((candidate) => candidate.editId === marker.editId)) {
      markers.push({ ...marker, timestamp: Date.now() });
      markers.sort((a, b) => a.sequence - b.sequence);
      removeCompletedCycle(markers, marker.editId);
      while (markers.length > MAX_MARKERS_PER_RESOURCE) {
        markers.shift();
      }
      this._markers.set(resourceKey, markers);
    }
    for (const observation of this._observations.get(resourceKey) ?? []) {
      this._tryResolve(resourceKey, observation);
    }
  }
  _tryResolve(resourceKey, observation) {
    if (observation.resolution) {
      return;
    }
    const markers = this._markers.get(resourceKey);
    if (!markers) {
      return;
    }
    for (let startIndex = 0; startIndex < markers.length; startIndex++) {
      const first = markers[startIndex];
      if (first.beforeDigest !== observation.beforeDigest) {
        continue;
      }
      const consumed = [startIndex];
      let afterDigest = first.afterDigest;
      let sequence = first.sequence;
      while (afterDigest !== observation.afterDigest) {
        const nextIndex = markers.findIndex(
          (marker, index) => index !== startIndex && !consumed.includes(index) && marker.sequence > sequence && marker.beforeDigest === afterDigest
        );
        if (nextIndex < 0) {
          break;
        }
        consumed.push(nextIndex);
        afterDigest = markers[nextIndex].afterDigest;
        sequence = markers[nextIndex].sequence;
      }
      if (afterDigest !== observation.afterDigest) {
        continue;
      }
      const sources = consumed.map((index) => markers[index].source);
      const firstSource = sources[0];
      const source = firstSource && sources.every(
        (candidate) => candidate !== void 0 && candidate.modelId === firstSource.modelId && candidate.harness === firstSource.harness
      ) ? EditSources.agentHostChatApplyEdits({
        modelId: firstSource.modelId,
        sessionId: firstSource.conversationId,
        requestId: firstSource.requestId,
        harness: firstSource.harness
      }) : void 0;
      observation.resolution = { id: observation.id, source };
      for (const index of consumed.toSorted((a, b) => b - a)) {
        markers.splice(index, 1);
      }
      if (markers.length === 0) {
        this._markers.delete(resourceKey);
      }
      this._onDidSuppress.fire(observation.id);
      this._onDidResolve.fire(observation.resolution);
      return;
    }
  }
  _retainObservation(resourceKey, id) {
    const observation = this._getObservation(resourceKey, id);
    if (observation) {
      observation.referenceCount++;
    }
  }
  _releaseObservation(resourceKey, id) {
    const observations = this._observations.get(resourceKey);
    if (!observations) {
      return;
    }
    const index = observations.findIndex((observation) => observation.id === id);
    if (index >= 0) {
      const observation = observations[index];
      observation.referenceCount--;
      if (observation.referenceCount <= 0) {
        observations.splice(index, 1);
      }
    }
    if (observations.length === 0) {
      this._observations.delete(resourceKey);
    }
  }
  _invalidateObservations(resourceKey) {
    this._markers.delete(resourceKey);
    this._coverageGaps.delete(resourceKey);
    this._pendingCoverageGapAcknowledgements.delete(resourceKey);
    const acknowledgementPrefix = coverageGapAcknowledgementKey(resourceKey, "");
    for (const acknowledgementKey of this._acknowledgedCoverageGapIds.keys()) {
      if (acknowledgementKey.startsWith(acknowledgementPrefix)) {
        this._acknowledgedCoverageGapIds.delete(acknowledgementKey);
      }
    }
    const observations = this._observations.get(resourceKey);
    if (!observations) {
      return;
    }
    for (const observation of observations) {
      if (observation.resolution) {
        this._onDidInvalidate.fire(observation.id);
      }
    }
    this._observations.delete(resourceKey);
  }
  _prune(resourceKey) {
    const now = Date.now();
    const minimumTimestamp = now - MARKER_TTL;
    const markers = this._markers.get(resourceKey)?.filter((marker) => marker.timestamp >= minimumTimestamp);
    if (markers?.length) {
      this._markers.set(resourceKey, markers);
    } else {
      this._markers.delete(resourceKey);
    }
    const observations = this._observations.get(resourceKey)?.filter((observation) => observation.resolution !== void 0 || observation.timestamp >= minimumTimestamp);
    if (observations?.length) {
      this._observations.set(resourceKey, observations);
    } else {
      this._observations.delete(resourceKey);
    }
    if ((this._routes.get(resourceKey)?.timestamp ?? now) < now - ROUTE_TTL) {
      this._invalidateObservations(resourceKey);
      this._routes.delete(resourceKey);
    }
    if ((this._coverageGaps.get(resourceKey)?.timestamp ?? now) < now - ROUTE_TTL) {
      this._coverageGaps.delete(resourceKey);
    }
    if ((this._pendingCoverageGapAcknowledgements.get(resourceKey)?.timestamp ?? now) < now - ROUTE_TTL) {
      this._pendingCoverageGapAcknowledgements.delete(resourceKey);
    }
    for (const [acknowledgementKey, timestamp] of this._acknowledgedCoverageGapIds) {
      if (timestamp < now - ROUTE_TTL) {
        this._acknowledgedCoverageGapIds.delete(acknowledgementKey);
      }
    }
  }
  _key(resource) {
    const normalizedResource = resource.scheme === Schemas.vscodeRemote ? URI.from({ scheme: Schemas.file, path: resource.path }) : resource;
    return this._uriIdentityService.extUri.getComparisonKey(this._uriIdentityService.asCanonicalUri(normalizedResource));
  }
  _getObservation(resourceKey, id) {
    return this._observations.get(resourceKey)?.find((observation) => observation.id === id);
  }
  async _waitForResolution(resourceKey, ids, timeoutMs) {
    const unresolved = new Set(ids.filter((id) => {
      const observation = this._getObservation(resourceKey, id);
      return observation !== void 0 && observation.resolution === void 0;
    }));
    if (unresolved.size === 0) {
      return;
    }
    const store = new DisposableStore();
    try {
      await raceTimeout(new Promise((resolve) => {
        const complete = (id) => {
          unresolved.delete(id);
          if (unresolved.size === 0) {
            resolve();
          }
        };
        store.add(this._onDidResolve.event((resolution) => complete(resolution.id)));
        store.add(this._onDidInvalidate.event(complete));
      }), timeoutMs);
    } finally {
      store.dispose();
    }
  }
};
AgentHostEditMarkerService = __decorateClass([
  __decorateParam(0, IAgentHostConnectionsService),
  __decorateParam(1, IUriIdentityService)
], AgentHostEditMarkerService);
function isValidCoverageGapAcknowledgements(acknowledgements, lastSequence) {
  if (acknowledgements === void 0) {
    return true;
  }
  if (!Array.isArray(acknowledgements) || acknowledgements.length === 0 || new Set(acknowledgements.map((acknowledgement) => acknowledgement.id)).size !== acknowledgements.length) {
    return false;
  }
  return acknowledgements.every(
    (acknowledgement) => typeof acknowledgement.id === "string" && acknowledgement.id.length > 0 && Array.isArray(acknowledgement.sequences) && acknowledgement.sequences.length > 0 && acknowledgement.sequences.every((sequence) => Number.isSafeInteger(sequence) && sequence >= 0 && (lastSequence === void 0 || sequence <= lastSequence)) && new Set(acknowledgement.sequences).size === acknowledgement.sequences.length && Number.isSafeInteger(acknowledgement.editCount) && acknowledgement.editCount > 0 && Number.isSafeInteger(acknowledgement.insertedCount) && acknowledgement.insertedCount >= 0
  );
}
function getLastAcknowledgedSequence(acknowledgements) {
  return Math.max(...acknowledgements.flatMap((acknowledgement) => acknowledgement.sequences));
}
function coverageGapAcknowledgementKey(resourceKey, acknowledgementId) {
  return `${resourceKey}\0${acknowledgementId}`;
}
function removeCompletedCycle(markers, latestEditId) {
  const latestIndex = markers.findIndex((marker) => marker.editId === latestEditId);
  if (latestIndex < 0) {
    return;
  }
  const completedDigest = markers[latestIndex].afterDigest;
  const consumed = [latestIndex];
  let beforeDigest = markers[latestIndex].beforeDigest;
  let sequence = markers[latestIndex].sequence;
  while (true) {
    if (beforeDigest === completedDigest && consumed.length > 1) {
      for (const index of consumed.toSorted((a, b) => b - a)) {
        markers.splice(index, 1);
      }
      return;
    }
    let previousIndex = -1;
    for (let index = markers.length - 1; index >= 0; index--) {
      const marker = markers[index];
      if (marker.sequence < sequence && marker.afterDigest === beforeDigest) {
        previousIndex = index;
        break;
      }
    }
    if (previousIndex < 0) {
      return;
    }
    consumed.push(previousIndex);
    beforeDigest = markers[previousIndex].beforeDigest;
    sequence = markers[previousIndex].sequence;
  }
}
export {
  AgentHostEditAttributionDeferredError,
  AgentHostEditAttributionUnknownOutcomeError,
  AgentHostEditMarkerService
};
