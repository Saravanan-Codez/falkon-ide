import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ISpeechService } from "../common/speechService.js";
import { SpeechService } from "./speechService.js";
registerSingleton(
  ISpeechService,
  SpeechService,
  InstantiationType.Eager
  /* Reads Extension Points */
);
