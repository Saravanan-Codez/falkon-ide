import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { NativeTitleService } from "../../../electron-browser/parts/titlebar/titlebarPart.js";
import { ITitleService } from "../browser/titleService.js";
registerSingleton(ITitleService, NativeTitleService, InstantiationType.Eager);
