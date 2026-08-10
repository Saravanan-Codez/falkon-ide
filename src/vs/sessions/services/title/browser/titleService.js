import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ITitleService } from "../../../../workbench/services/title/browser/titleService.js";
import { TitleService } from "../../../browser/parts/titlebarPart.js";
registerSingleton(ITitleService, TitleService, InstantiationType.Eager);
