function unwrapShellInvocation(command) {
  const match = /^\s*\S*sh(?:\.exe)?\s+-[a-z]*c\s+([\s\S]+)$/i.exec(command);
  if (!match) {
    return command;
  }
  return unquoteShellArg(match[1].trim());
}
function unquoteShellArg(arg) {
  if (arg.length >= 2 && arg[0] === "'" && arg[arg.length - 1] === "'") {
    return arg.slice(1, -1).replace(/'\\''/g, "'");
  }
  if (arg.length >= 2 && arg[0] === '"' && arg[arg.length - 1] === '"') {
    return arg.slice(1, -1).replace(/\\(["\\$`])/g, "$1");
  }
  return arg;
}
export {
  unwrapShellInvocation
};
