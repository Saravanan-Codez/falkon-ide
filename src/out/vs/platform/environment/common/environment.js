import { createDecorator, refineServiceDecorator } from "../../instantiation/common/instantiation.js";
const IEnvironmentService = createDecorator("environmentService");
const INativeEnvironmentService = refineServiceDecorator(IEnvironmentService);
export {
  IEnvironmentService,
  INativeEnvironmentService
};
