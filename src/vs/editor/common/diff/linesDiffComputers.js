import { LegacyLinesDiffComputer } from "./legacyLinesDiffComputer.js";
import { DefaultLinesDiffComputer } from "./defaultLinesDiffComputer/defaultLinesDiffComputer.js";
import { getExternalLinesDiffComputer } from "./externalLinesDiffComputer.js";
const linesDiffComputers = {
  getLegacy: () => new LegacyLinesDiffComputer(),
  getDefault: () => new DefaultLinesDiffComputer(),
  getAdvancedExternal: () => getExternalLinesDiffComputer(false),
  getAdvancedWasm: () => getExternalLinesDiffComputer(true)
};
export {
  linesDiffComputers
};
