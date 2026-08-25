import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
function toKey(extension, source) {
  return `${typeof extension === "string" ? extension : ExtensionIdentifier.toKey(extension)}|${source}`;
}
const TimelinePaneId = "timeline";
const TIMELINE_SERVICE_ID = "timeline";
const ITimelineService = createDecorator(TIMELINE_SERVICE_ID);
export {
  ITimelineService,
  TimelinePaneId,
  toKey
};
