import { CharCode } from "../../../../base/common/charCode.js";
var StringEOL = /* @__PURE__ */ ((StringEOL2) => {
  StringEOL2[StringEOL2["Unknown"] = 0] = "Unknown";
  StringEOL2[StringEOL2["Invalid"] = 3] = "Invalid";
  StringEOL2[StringEOL2["LF"] = 1] = "LF";
  StringEOL2[StringEOL2["CRLF"] = 2] = "CRLF";
  return StringEOL2;
})(StringEOL || {});
function countEOL(text) {
  let eolCount = 0;
  let firstLineLength = 0;
  let lastLineStart = 0;
  let eol = 0 /* Unknown */;
  for (let i = 0, len = text.length; i < len; i++) {
    const chr = text.charCodeAt(i);
    if (chr === CharCode.CarriageReturn) {
      if (eolCount === 0) {
        firstLineLength = i;
      }
      eolCount++;
      if (i + 1 < len && text.charCodeAt(i + 1) === CharCode.LineFeed) {
        eol |= 2 /* CRLF */;
        i++;
      } else {
        eol |= 3 /* Invalid */;
      }
      lastLineStart = i + 1;
    } else if (chr === CharCode.LineFeed) {
      eol |= 1 /* LF */;
      if (eolCount === 0) {
        firstLineLength = i;
      }
      eolCount++;
      lastLineStart = i + 1;
    }
  }
  if (eolCount === 0) {
    firstLineLength = text.length;
  }
  return [eolCount, firstLineLength, text.length - lastLineStart, eol];
}
export {
  StringEOL,
  countEOL
};
