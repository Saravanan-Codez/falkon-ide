const BANG_COMMAND_PREFIX = "!";
function parseBangCommand(prompt) {
  if (!prompt.startsWith(BANG_COMMAND_PREFIX)) {
    return void 0;
  }
  const command = prompt.slice(BANG_COMMAND_PREFIX.length).trim();
  return command.length > 0 ? command : void 0;
}
export {
  BANG_COMMAND_PREFIX,
  parseBangCommand
};
