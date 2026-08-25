import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IGitService } from "../common/gitService.js";
import { GitService } from "./gitService.js";
registerSingleton(IGitService, GitService, InstantiationType.Delayed);
