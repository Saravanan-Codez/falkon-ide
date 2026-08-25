import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IStatusbarService = createDecorator("statusbarService");
var StatusbarAlignment = /* @__PURE__ */ ((StatusbarAlignment2) => {
  StatusbarAlignment2[StatusbarAlignment2["LEFT"] = 0] = "LEFT";
  StatusbarAlignment2[StatusbarAlignment2["RIGHT"] = 1] = "RIGHT";
  return StatusbarAlignment2;
})(StatusbarAlignment || {});
function isStatusbarEntryLocation(thing) {
  const candidate = thing;
  return typeof candidate?.location?.id === "string" && typeof candidate.alignment === "number";
}
function isStatusbarEntryPriority(thing) {
  const candidate = thing;
  return (typeof candidate?.primary === "number" || isStatusbarEntryLocation(candidate?.primary)) && typeof candidate?.secondary === "number";
}
const ShowTooltipCommand = {
  id: "statusBar.entry.showTooltip",
  title: ""
};
const StatusbarEntryKinds = ["standard", "warning", "error", "prominent", "remote", "offline"];
function isTooltipWithCommands(thing) {
  const candidate = thing;
  return !!candidate?.content && Array.isArray(candidate?.commands);
}
export {
  IStatusbarService,
  ShowTooltipCommand,
  StatusbarAlignment,
  StatusbarEntryKinds,
  isStatusbarEntryLocation,
  isStatusbarEntryPriority,
  isTooltipWithCommands
};
