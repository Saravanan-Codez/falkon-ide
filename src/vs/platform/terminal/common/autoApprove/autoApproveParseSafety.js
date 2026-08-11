function shouldRequireConfirmationForAutoApproveParse(language, hasError) {
  return language === "powershell" && hasError;
}
export {
  shouldRequireConfirmationForAutoApproveParse
};
