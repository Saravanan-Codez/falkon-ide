import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ITitleService } from "../../../../workbench/services/title/browser/titleService.js";
import { NativeTitleService } from "../../../electron-browser/parts/titlebarPart.js";
registerSingleton(ITitleService, NativeTitleService, InstantiationType.Eager);
