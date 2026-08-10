function isClientTransport(transport) {
  return typeof transport.connect === "function";
}
export {
  isClientTransport
};
