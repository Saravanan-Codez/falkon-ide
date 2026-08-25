function parseLeadingSlashCommand(prompt) {
  const match = /^\/([^\s/]+)(?:$|\s+([\s\S]*))/.exec(prompt);
  if (!match) {
    return void 0;
  }
  const rawRest = match[2] ?? "";
  return {
    command: match[1],
    rest: rawRest.trim(),
    rawRest
  };
}
export {
  parseLeadingSlashCommand
};
