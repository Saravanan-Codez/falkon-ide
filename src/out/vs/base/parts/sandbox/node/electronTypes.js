function isUtilityProcess(process) {
  return !!process.parentPort;
}
export {
  isUtilityProcess
};
