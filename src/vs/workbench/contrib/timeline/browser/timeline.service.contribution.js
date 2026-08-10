import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ITimelineService } from "../common/timeline.js";
import { TimelineService } from "../common/timelineService.js";
registerSingleton(ITimelineService, TimelineService, InstantiationType.Delayed);
