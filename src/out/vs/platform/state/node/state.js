import { createDecorator } from "../../instantiation/common/instantiation.js";
const IStateReadService = createDecorator("stateReadService");
const IStateService = createDecorator("stateService");
export {
  IStateReadService,
  IStateService
};
