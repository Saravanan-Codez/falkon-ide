function formatQuestionPrompt(question, allowSkip) {
  const parts = [];
  const title = question.title.trim();
  if (title) {
    parts.push(title);
  }
  if (question.options.length > 0) {
    const choices = question.options.map((option, index) => `${index + 1}, ${option.label}`).join(". ");
    parts.push(`Options: ${choices}.`);
    if (question.allow_freeform) {
      parts.push("You can also give your own answer.");
    }
  }
  if (allowSkip) {
    parts.push("Or say skip.");
  }
  return parts.join(" ");
}
export {
  formatQuestionPrompt
};
