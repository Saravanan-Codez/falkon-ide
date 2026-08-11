function matchesTerminalSandboxCommandRule(command, rule, context) {
  if (!rule.keywords.includes(command.keyword.toLowerCase())) {
    return false;
  }
  if (rule.condition && (!context || !rule.condition(context))) {
    return false;
  }
  if (rule.subcommands) {
    const subcommand = getCommandSubcommand(command.args, rule.optionsWithValue);
    if (subcommand === void 0 || !rule.subcommands.includes(subcommand)) {
      return false;
    }
  }
  return rule.when?.(command) ?? true;
}
function getCommandSubcommand(args, optionsWithValue) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      return void 0;
    }
    if (arg.startsWith("-")) {
      const option = arg.includes("=") ? arg.substring(0, arg.indexOf("=")) : arg;
      if (!arg.includes("=") && optionsWithValue?.has(option)) {
        i++;
      }
      continue;
    }
    return arg.toLowerCase();
  }
  return void 0;
}
export {
  getCommandSubcommand,
  matchesTerminalSandboxCommandRule
};
