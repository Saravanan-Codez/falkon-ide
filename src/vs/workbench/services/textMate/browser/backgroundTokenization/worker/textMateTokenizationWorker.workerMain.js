import { create } from "./textMateTokenizationWorker.worker.js";
import { bootstrapWebWorker } from "../../../../../../base/common/worker/webWorkerBootstrap.js";
bootstrapWebWorker(create);
