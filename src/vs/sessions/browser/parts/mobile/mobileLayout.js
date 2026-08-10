const PHONE_LAYOUT_CLASS = "phone-layout";
function isPhoneLayout(layoutService) {
  return layoutService.mainContainer.classList.contains(PHONE_LAYOUT_CLASS);
}
export {
  isPhoneLayout
};
