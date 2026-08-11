import { create } from "./languageDetectionWebWorker.js";
import { bootstrapWebWorker } from "../../../../base/common/worker/webWorkerBootstrap.js";
bootstrapWebWorker(create);
