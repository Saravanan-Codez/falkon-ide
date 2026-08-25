import { OffBuffer } from "./offBuffer.js";
import { ParagraphBuffer } from "./paragraphBuffer.js";
import { WordBuffer } from "./wordBuffer.js";
const BUFFER_MODES = {
  off: (_domNode) => new OffBuffer(),
  word: (_domNode) => new WordBuffer(),
  paragraph: (_domNode) => new ParagraphBuffer()
};
export {
  BUFFER_MODES
};
