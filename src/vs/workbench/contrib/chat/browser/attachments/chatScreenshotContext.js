import { localize } from "../../../../../nls.js";
const ScreenshotVariableId = "screenshot-focused-window";
function convertBufferToScreenshotVariable(buffer) {
  return {
    id: ScreenshotVariableId,
    name: localize("screenshot", "Screenshot"),
    value: buffer.buffer,
    kind: "image"
  };
}
export {
  ScreenshotVariableId,
  convertBufferToScreenshotVariable
};
