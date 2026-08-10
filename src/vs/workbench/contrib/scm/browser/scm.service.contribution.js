import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ISCMService, ISCMViewService } from "../common/scm.js";
import { SCMService } from "../common/scmService.js";
import { SCMViewService } from "./scmViewService.js";
registerSingleton(ISCMService, SCMService, InstantiationType.Delayed);
registerSingleton(ISCMViewService, SCMViewService, InstantiationType.Delayed);
