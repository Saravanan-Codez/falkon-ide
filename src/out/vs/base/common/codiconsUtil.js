import { isString } from "./types.js";
const _codiconFontCharacters = /* @__PURE__ */ Object.create(null);
function register(id, fontCharacter) {
  if (isString(fontCharacter)) {
    const val = _codiconFontCharacters[fontCharacter];
    if (val === void 0) {
      throw new Error(`${id} references an unknown codicon: ${fontCharacter}`);
    }
    fontCharacter = val;
  }
  _codiconFontCharacters[id] = fontCharacter;
  return { id };
}
function getCodiconFontCharacters() {
  return _codiconFontCharacters;
}
export {
  getCodiconFontCharacters,
  register
};
