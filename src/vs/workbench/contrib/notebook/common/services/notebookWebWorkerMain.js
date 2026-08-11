import { bootstrapWebWorker } from "../../../../../base/common/worker/webWorkerBootstrap.js";
import { create } from "./notebookWebWorker.js";
bootstrapWebWorker(create);
