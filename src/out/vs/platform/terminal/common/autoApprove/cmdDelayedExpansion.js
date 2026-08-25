const cmdDelayedExpansionRegex = /![^!\r\n]+!/;
function containsCmdDelayedExpansion(value) {
  return cmdDelayedExpansionRegex.test(value);
}
export {
  containsCmdDelayedExpansion
};
