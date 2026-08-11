import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { ISnippetsService } from "./snippets.js";
import { SnippetsService } from "./snippetsService.js";
registerSingleton(ISnippetsService, SnippetsService, InstantiationType.Delayed);
