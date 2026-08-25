import { NativeWorkingCopyHistoryService } from "../common/workingCopyHistoryService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IWorkingCopyHistoryService } from "../common/workingCopyHistory.js";
registerSingleton(IWorkingCopyHistoryService, NativeWorkingCopyHistoryService, InstantiationType.Delayed);
