import { createDecorator } from "../../instantiation/common/instantiation.js";
function getByokLmSelectionModelId(model) {
  const vendorPrefix = `${model.vendor}/`;
  return model.modelIdentifier?.startsWith(vendorPrefix) ? model.modelIdentifier.slice(vendorPrefix.length) : model.id;
}
const IAgentHostByokLmHandler = createDecorator("agentHostByokLmHandler");
export {
  IAgentHostByokLmHandler,
  getByokLmSelectionModelId
};
