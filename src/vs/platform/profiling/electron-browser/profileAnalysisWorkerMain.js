import { create } from "./profileAnalysisWorker.js";
import { bootstrapWebWorker } from "../../../base/common/worker/webWorkerBootstrap.js";
bootstrapWebWorker(create);
