var DebugLocation;
((DebugLocation2) => {
  let enabled = false;
  function enable() {
    enabled = true;
  }
  DebugLocation2.enable = enable;
  function ofCaller() {
    if (!enabled) {
      return void 0;
    }
    const Err = Error;
    const l = Err.stackTraceLimit;
    Err.stackTraceLimit = 3;
    const stack = new Error().stack;
    Err.stackTraceLimit = l;
    return DebugLocationImpl.fromStack(stack, 2);
  }
  DebugLocation2.ofCaller = ofCaller;
})(DebugLocation || (DebugLocation = {}));
class DebugLocationImpl {
  constructor(fileName, line, column, id) {
    this.fileName = fileName;
    this.line = line;
    this.column = column;
    this.id = id;
  }
  static fromStack(stack, parentIdx) {
    const lines = stack.split("\n");
    const location = parseLine(lines[parentIdx + 1]);
    if (location) {
      return new DebugLocationImpl(
        location.fileName,
        location.line,
        location.column,
        location.id
      );
    } else {
      return void 0;
    }
  }
}
function parseLine(stackLine) {
  const match = stackLine.match(/\((.*):(\d+):(\d+)\)/);
  if (match) {
    return {
      fileName: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      id: stackLine
    };
  }
  const match2 = stackLine.match(/at ([^\(\)]*):(\d+):(\d+)/);
  if (match2) {
    return {
      fileName: match2[1],
      line: parseInt(match2[2]),
      column: parseInt(match2[3]),
      id: stackLine
    };
  }
  return void 0;
}
export {
  DebugLocation
};
