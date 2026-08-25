function combineVoiceInput(existing, transcript) {
  if (!existing) {
    return transcript;
  }
  if (!transcript) {
    return existing;
  }
  return /\s$/.test(existing) ? `${existing}${transcript}` : `${existing} ${transcript}`;
}
export {
  combineVoiceInput
};
