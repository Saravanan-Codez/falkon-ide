function isMenubarMenuItemSubmenu(menuItem) {
  return menuItem.submenu !== void 0;
}
function isMenubarMenuItemSeparator(menuItem) {
  return menuItem.id === "vscode.menubar.separator";
}
function isMenubarMenuItemRecentAction(menuItem) {
  return menuItem.uri !== void 0;
}
function isMenubarMenuItemAction(menuItem) {
  return !isMenubarMenuItemSubmenu(menuItem) && !isMenubarMenuItemSeparator(menuItem) && !isMenubarMenuItemRecentAction(menuItem);
}
export {
  isMenubarMenuItemAction,
  isMenubarMenuItemRecentAction,
  isMenubarMenuItemSeparator,
  isMenubarMenuItemSubmenu
};
