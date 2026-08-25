function combineUriFlags(args) {
  const result = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      result.push(...args.slice(i));
      break;
    }
    if ((arg === "--folder-uri" || arg === "--file-uri") && i + 1 < args.length && !args[i + 1].startsWith("-")) {
      result.push(`${arg}=${args[i + 1]}`);
      i++;
    } else {
      result.push(arg);
    }
  }
  return result;
}
export {
  combineUriFlags
};
