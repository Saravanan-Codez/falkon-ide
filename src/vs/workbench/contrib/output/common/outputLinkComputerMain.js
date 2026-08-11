import { create } from "./outputLinkComputer.js";
import { bootstrapWebWorker } from "../../../../base/common/worker/webWorkerBootstrap.js";
bootstrapWebWorker(create);
