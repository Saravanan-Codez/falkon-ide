import { createDecorator } from "../../instantiation/common/instantiation.js";
import { stringHash } from "../../../base/common/hash.js";
import { URI } from "../../../base/common/uri.js";
const FILE_EDIT_ATTRIBUTION_PROPERTY = "_vscodeEditAttribution";
const MAX_EDIT_ATTRIBUTION_FILE_SIZE = 5 * 1024 * 1024;
const EDIT_ATTRIBUTION_RESOURCE_SCHEME = "agent-edit-attribution";
const IAgentEditAttributionService = createDecorator("agentEditAttributionService");
class NullAgentEditAttributionService {
  setEnabled(_enabled) {
  }
  async recordEdit(_edit) {
    return void 0;
  }
  async flushSession(_sessionUri) {
  }
  async prepareFlush(_params) {
    return void 0;
  }
  async commitFlush(_params) {
    return { outcome: "missing", agentModifiedCount: 0 };
  }
  async cancelFlush(_params) {
    return { outcome: "missing", agentModifiedCount: 0 };
  }
}
function getFileEditAttributionMarker(content) {
  const marker = content[FILE_EDIT_ATTRIBUTION_PROPERTY];
  if (marker?.version !== 1 || typeof marker.editId !== "string" || !Number.isSafeInteger(marker.sequence) || marker.sequence < 0) {
    return void 0;
  }
  if (marker.status === "skipped") {
    return marker.reason === "fileTooLarge" && (marker.untrackedEditCount === void 0 || Number.isSafeInteger(marker.untrackedEditCount) && marker.untrackedEditCount > 0) && Number.isSafeInteger(marker.insertedCount) && marker.insertedCount >= 0 ? marker : void 0;
  }
  if (marker.status !== void 0 && marker.status !== "tracked") {
    return void 0;
  }
  if (typeof marker.beforeDigest !== "string" || typeof marker.afterDigest !== "string" || marker.source !== void 0 && !isFileEditAttributionSource(marker.source)) {
    return void 0;
  }
  return marker;
}
function isFileEditAttributionSource(source) {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return false;
  }
  const candidate = source;
  return (candidate.modelId === void 0 || typeof candidate.modelId === "string") && typeof candidate.conversationId === "string" && typeof candidate.requestId === "string" && typeof candidate.harness === "string";
}
function createFileEditContentDigest(content) {
  return `${content.length}:${stringHash(content, 0)}:${stringHash(content, 5381)}`;
}
function buildPrepareEditAttributionResource(params) {
  return buildEditAttributionResource("prepare", {
    resource: params.resource.toString(),
    trigger: params.trigger,
    statsUuid: params.statsUuid,
    isDirty: params.isDirty,
    flushToken: params.flushToken,
    languageId: params.languageId
  });
}
function buildCommitEditAttributionResource(params) {
  return buildEditAttributionResource("commit", params);
}
function buildCancelEditAttributionResource(params) {
  return buildEditAttributionResource("cancel", params);
}
function parseEditAttributionResource(resource) {
  if (resource.scheme !== EDIT_ATTRIBUTION_RESOURCE_SCHEME) {
    return void 0;
  }
  const kind = resource.path.substring(1);
  const payload = new URLSearchParams(resource.query).get("payload");
  if (!payload) {
    return void 0;
  }
  try {
    const value = JSON.parse(payload);
    if (kind === "prepare" && typeof value.resource === "string" && isEditTelemetryTrigger(value.trigger) && typeof value.statsUuid === "string" && typeof value.isDirty === "boolean" && typeof value.flushToken === "string" && typeof value.languageId === "string") {
      return {
        kind,
        params: {
          resource: URI.parse(value.resource),
          trigger: value.trigger,
          statsUuid: value.statsUuid,
          isDirty: value.isDirty,
          flushToken: value.flushToken,
          languageId: value.languageId
        }
      };
    }
    if (kind === "commit" && typeof value.flushToken === "string" && typeof value.totalModifiedCount === "number") {
      return {
        kind,
        params: {
          flushToken: value.flushToken,
          totalModifiedCount: value.totalModifiedCount
        }
      };
    }
    if (kind === "cancel" && typeof value.flushToken === "string") {
      return {
        kind,
        params: {
          flushToken: value.flushToken
        }
      };
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function buildEditAttributionResource(kind, value) {
  const params = new URLSearchParams();
  params.set("payload", JSON.stringify(value));
  return URI.from({
    scheme: EDIT_ATTRIBUTION_RESOURCE_SCHEME,
    path: `/${kind}`,
    query: params.toString()
  });
}
function isEditTelemetryTrigger(value) {
  return value === "10hours" || value === "hashChange" || value === "branchChange" || value === "closed" || value === "time";
}
export {
  FILE_EDIT_ATTRIBUTION_PROPERTY,
  IAgentEditAttributionService,
  MAX_EDIT_ATTRIBUTION_FILE_SIZE,
  NullAgentEditAttributionService,
  buildCancelEditAttributionResource,
  buildCommitEditAttributionResource,
  buildPrepareEditAttributionResource,
  createFileEditContentDigest,
  getFileEditAttributionMarker,
  parseEditAttributionResource
};
