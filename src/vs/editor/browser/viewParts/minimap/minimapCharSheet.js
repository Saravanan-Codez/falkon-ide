var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["START_CH_CODE"] = 32] = "START_CH_CODE";
  Constants2[Constants2["END_CH_CODE"] = 126] = "END_CH_CODE";
  Constants2[Constants2["UNKNOWN_CODE"] = 65533] = "UNKNOWN_CODE";
  Constants2[Constants2["CHAR_COUNT"] = 96] = "CHAR_COUNT";
  Constants2[Constants2["SAMPLED_CHAR_HEIGHT"] = 16] = "SAMPLED_CHAR_HEIGHT";
  Constants2[Constants2["SAMPLED_CHAR_WIDTH"] = 10] = "SAMPLED_CHAR_WIDTH";
  Constants2[Constants2["BASE_CHAR_HEIGHT"] = 2] = "BASE_CHAR_HEIGHT";
  Constants2[Constants2["BASE_CHAR_WIDTH"] = 1] = "BASE_CHAR_WIDTH";
  Constants2[Constants2["RGBA_CHANNELS_CNT"] = 4] = "RGBA_CHANNELS_CNT";
  Constants2[Constants2["RGBA_SAMPLED_ROW_WIDTH"] = 3840] = "RGBA_SAMPLED_ROW_WIDTH";
  return Constants2;
})(Constants || {});
const allCharCodes = (() => {
  const v = [];
  for (let i = 32 /* START_CH_CODE */; i <= 126 /* END_CH_CODE */; i++) {
    v.push(i);
  }
  v.push(65533 /* UNKNOWN_CODE */);
  return v;
})();
const getCharIndex = (chCode, fontScale) => {
  chCode -= 32 /* START_CH_CODE */;
  if (chCode < 0 || chCode > 96 /* CHAR_COUNT */) {
    if (fontScale <= 2) {
      return (chCode + 96 /* CHAR_COUNT */) % 96 /* CHAR_COUNT */;
    }
    return 96 /* CHAR_COUNT */ - 1;
  }
  return chCode;
};
export {
  Constants,
  allCharCodes,
  getCharIndex
};
