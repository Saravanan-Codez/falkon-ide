import { BlockAnimation } from "./blockAnimations.js";
const ANIMATION_STYLES = {
  none: () => ({ animate() {
  } }),
  fade: () => new BlockAnimation("fade"),
  rise: () => new BlockAnimation("rise"),
  blur: () => new BlockAnimation("blur"),
  scale: () => new BlockAnimation("scale"),
  slide: () => new BlockAnimation("slide"),
  reveal: () => new BlockAnimation("reveal")
};
export {
  ANIMATION_STYLES
};
