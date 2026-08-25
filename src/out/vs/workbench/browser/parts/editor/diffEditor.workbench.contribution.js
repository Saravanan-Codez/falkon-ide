import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { DiffEditorCommandsService, IDiffEditorCommandsService } from "./diffEditorCommandsService.js";
registerSingleton(IDiffEditorCommandsService, DiffEditorCommandsService, InstantiationType.Delayed);
