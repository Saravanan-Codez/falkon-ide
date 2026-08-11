const ANIMATION_DURATION_MS = 600;
const STAGGER_DELAY_MS = 150;
class BlockAnimation {
  constructor(_style) {
    this._style = _style;
  }
  animate(children, fromIndex, currentCount, elapsed) {
    const className = `chat-smooth-animate-${this._style}`;
    for (let i = fromIndex; i < currentCount; i++) {
      const child = children[i];
      if (!child.classList) {
        continue;
      }
      const staggerOffset = (i - fromIndex) * STAGGER_DELAY_MS;
      const childDelay = -elapsed + staggerOffset;
      child.classList.add(className);
      child.style.setProperty("--chat-smooth-duration", `${ANIMATION_DURATION_MS}ms`);
      child.style.setProperty("--chat-smooth-delay", `${childDelay}ms`);
      child.addEventListener("animationend", (e) => {
        if (e.target !== child) {
          return;
        }
        child.classList.remove(className);
        child.style.removeProperty("--chat-smooth-duration");
        child.style.removeProperty("--chat-smooth-delay");
      }, { once: true });
    }
  }
}
export {
  ANIMATION_DURATION_MS,
  BlockAnimation
};
