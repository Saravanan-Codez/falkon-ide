class KeyboardLayoutContribution {
  constructor() {
    this._layoutInfos = [];
  }
  static {
    this.INSTANCE = new KeyboardLayoutContribution();
  }
  get layoutInfos() {
    return this._layoutInfos;
  }
  registerKeyboardLayout(layout) {
    this._layoutInfos.push(layout);
  }
}
export {
  KeyboardLayoutContribution
};
