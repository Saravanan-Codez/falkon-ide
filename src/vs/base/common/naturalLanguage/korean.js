function getKoreanAltChars(code) {
  const result = disassembleKorean(code);
  if (result && result.length > 0) {
    return new Uint32Array(result);
  }
  return void 0;
}
let codeBufferLength = 0;
const codeBuffer = new Uint32Array(10);
function disassembleKorean(code) {
  codeBufferLength = 0;
  getCodesFromArray(code, modernConsonants, 4352 /* InitialConsonant */);
  if (codeBufferLength > 0) {
    return codeBuffer.subarray(0, codeBufferLength);
  }
  getCodesFromArray(code, modernVowels, 4449 /* Vowel */);
  if (codeBufferLength > 0) {
    return codeBuffer.subarray(0, codeBufferLength);
  }
  getCodesFromArray(code, modernFinalConsonants, 4520 /* FinalConsonant */);
  if (codeBufferLength > 0) {
    return codeBuffer.subarray(0, codeBufferLength);
  }
  getCodesFromArray(code, compatibilityJamo, 12593 /* CompatibilityJamo */);
  if (codeBufferLength) {
    return codeBuffer.subarray(0, codeBufferLength);
  }
  if (code >= 44032 && code <= 55203) {
    const hangulIndex = code - 44032;
    const vowelAndFinalConsonantProduct = hangulIndex % 588;
    const initialConsonantIndex = Math.floor(hangulIndex / 588);
    const vowelIndex = Math.floor(vowelAndFinalConsonantProduct / 28);
    const finalConsonantIndex = vowelAndFinalConsonantProduct % 28 - 1;
    if (initialConsonantIndex < modernConsonants.length) {
      getCodesFromArray(initialConsonantIndex, modernConsonants, 0);
    } else if (4352 /* InitialConsonant */ + initialConsonantIndex - 12593 /* CompatibilityJamo */ < compatibilityJamo.length) {
      getCodesFromArray(4352 /* InitialConsonant */ + initialConsonantIndex, compatibilityJamo, 12593 /* CompatibilityJamo */);
    }
    if (vowelIndex < modernVowels.length) {
      getCodesFromArray(vowelIndex, modernVowels, 0);
    } else if (4449 /* Vowel */ + vowelIndex - 12593 /* CompatibilityJamo */ < compatibilityJamo.length) {
      getCodesFromArray(4449 /* Vowel */ + vowelIndex - 12593 /* CompatibilityJamo */, compatibilityJamo, 12593 /* CompatibilityJamo */);
    }
    if (finalConsonantIndex >= 0) {
      if (finalConsonantIndex < modernFinalConsonants.length) {
        getCodesFromArray(finalConsonantIndex, modernFinalConsonants, 0);
      } else if (4520 /* FinalConsonant */ + finalConsonantIndex - 12593 /* CompatibilityJamo */ < compatibilityJamo.length) {
        getCodesFromArray(4520 /* FinalConsonant */ + finalConsonantIndex - 12593 /* CompatibilityJamo */, compatibilityJamo, 12593 /* CompatibilityJamo */);
      }
    }
    if (codeBufferLength > 0) {
      return codeBuffer.subarray(0, codeBufferLength);
    }
  }
  return void 0;
}
function getCodesFromArray(code, array, arrayStartIndex) {
  if (code >= arrayStartIndex && code < arrayStartIndex + array.length) {
    addCodesToBuffer(array[code - arrayStartIndex]);
  }
}
function addCodesToBuffer(codes) {
  if (codes === 0 /* NUL */) {
    return;
  }
  codeBuffer[codeBufferLength++] = codes & 255;
  if (codes >> 8) {
    codeBuffer[codeBufferLength++] = codes >> 8 & 255;
  }
  if (codes >> 16) {
    codeBuffer[codeBufferLength++] = codes >> 16 & 255;
  }
}
var HangulRangeStartCode = /* @__PURE__ */ ((HangulRangeStartCode2) => {
  HangulRangeStartCode2[HangulRangeStartCode2["InitialConsonant"] = 4352] = "InitialConsonant";
  HangulRangeStartCode2[HangulRangeStartCode2["Vowel"] = 4449] = "Vowel";
  HangulRangeStartCode2[HangulRangeStartCode2["FinalConsonant"] = 4520] = "FinalConsonant";
  HangulRangeStartCode2[HangulRangeStartCode2["CompatibilityJamo"] = 12593] = "CompatibilityJamo";
  return HangulRangeStartCode2;
})(HangulRangeStartCode || {});
var AsciiCode = /* @__PURE__ */ ((AsciiCode2) => {
  AsciiCode2[AsciiCode2["NUL"] = 0] = "NUL";
  AsciiCode2[AsciiCode2["A"] = 65] = "A";
  AsciiCode2[AsciiCode2["B"] = 66] = "B";
  AsciiCode2[AsciiCode2["C"] = 67] = "C";
  AsciiCode2[AsciiCode2["D"] = 68] = "D";
  AsciiCode2[AsciiCode2["E"] = 69] = "E";
  AsciiCode2[AsciiCode2["F"] = 70] = "F";
  AsciiCode2[AsciiCode2["G"] = 71] = "G";
  AsciiCode2[AsciiCode2["H"] = 72] = "H";
  AsciiCode2[AsciiCode2["I"] = 73] = "I";
  AsciiCode2[AsciiCode2["J"] = 74] = "J";
  AsciiCode2[AsciiCode2["K"] = 75] = "K";
  AsciiCode2[AsciiCode2["L"] = 76] = "L";
  AsciiCode2[AsciiCode2["M"] = 77] = "M";
  AsciiCode2[AsciiCode2["N"] = 78] = "N";
  AsciiCode2[AsciiCode2["O"] = 79] = "O";
  AsciiCode2[AsciiCode2["P"] = 80] = "P";
  AsciiCode2[AsciiCode2["Q"] = 81] = "Q";
  AsciiCode2[AsciiCode2["R"] = 82] = "R";
  AsciiCode2[AsciiCode2["S"] = 83] = "S";
  AsciiCode2[AsciiCode2["T"] = 84] = "T";
  AsciiCode2[AsciiCode2["U"] = 85] = "U";
  AsciiCode2[AsciiCode2["V"] = 86] = "V";
  AsciiCode2[AsciiCode2["W"] = 87] = "W";
  AsciiCode2[AsciiCode2["X"] = 88] = "X";
  AsciiCode2[AsciiCode2["Y"] = 89] = "Y";
  AsciiCode2[AsciiCode2["Z"] = 90] = "Z";
  AsciiCode2[AsciiCode2["a"] = 97] = "a";
  AsciiCode2[AsciiCode2["b"] = 98] = "b";
  AsciiCode2[AsciiCode2["c"] = 99] = "c";
  AsciiCode2[AsciiCode2["d"] = 100] = "d";
  AsciiCode2[AsciiCode2["e"] = 101] = "e";
  AsciiCode2[AsciiCode2["f"] = 102] = "f";
  AsciiCode2[AsciiCode2["g"] = 103] = "g";
  AsciiCode2[AsciiCode2["h"] = 104] = "h";
  AsciiCode2[AsciiCode2["i"] = 105] = "i";
  AsciiCode2[AsciiCode2["j"] = 106] = "j";
  AsciiCode2[AsciiCode2["k"] = 107] = "k";
  AsciiCode2[AsciiCode2["l"] = 108] = "l";
  AsciiCode2[AsciiCode2["m"] = 109] = "m";
  AsciiCode2[AsciiCode2["n"] = 110] = "n";
  AsciiCode2[AsciiCode2["o"] = 111] = "o";
  AsciiCode2[AsciiCode2["p"] = 112] = "p";
  AsciiCode2[AsciiCode2["q"] = 113] = "q";
  AsciiCode2[AsciiCode2["r"] = 114] = "r";
  AsciiCode2[AsciiCode2["s"] = 115] = "s";
  AsciiCode2[AsciiCode2["t"] = 116] = "t";
  AsciiCode2[AsciiCode2["u"] = 117] = "u";
  AsciiCode2[AsciiCode2["v"] = 118] = "v";
  AsciiCode2[AsciiCode2["w"] = 119] = "w";
  AsciiCode2[AsciiCode2["x"] = 120] = "x";
  AsciiCode2[AsciiCode2["y"] = 121] = "y";
  AsciiCode2[AsciiCode2["z"] = 122] = "z";
  return AsciiCode2;
})(AsciiCode || {});
var AsciiCodeCombo = /* @__PURE__ */ ((AsciiCodeCombo2) => {
  AsciiCodeCombo2[AsciiCodeCombo2["fa"] = 24934] = "fa";
  AsciiCodeCombo2[AsciiCodeCombo2["fg"] = 26470] = "fg";
  AsciiCodeCombo2[AsciiCodeCombo2["fq"] = 29030] = "fq";
  AsciiCodeCombo2[AsciiCodeCombo2["fr"] = 29286] = "fr";
  AsciiCodeCombo2[AsciiCodeCombo2["ft"] = 29798] = "ft";
  AsciiCodeCombo2[AsciiCodeCombo2["fv"] = 30310] = "fv";
  AsciiCodeCombo2[AsciiCodeCombo2["fx"] = 30822] = "fx";
  AsciiCodeCombo2[AsciiCodeCombo2["hk"] = 27496] = "hk";
  AsciiCodeCombo2[AsciiCodeCombo2["hl"] = 27752] = "hl";
  AsciiCodeCombo2[AsciiCodeCombo2["ho"] = 28520] = "ho";
  AsciiCodeCombo2[AsciiCodeCombo2["ml"] = 27757] = "ml";
  AsciiCodeCombo2[AsciiCodeCombo2["nj"] = 27246] = "nj";
  AsciiCodeCombo2[AsciiCodeCombo2["nl"] = 27758] = "nl";
  AsciiCodeCombo2[AsciiCodeCombo2["np"] = 28782] = "np";
  AsciiCodeCombo2[AsciiCodeCombo2["qt"] = 29809] = "qt";
  AsciiCodeCombo2[AsciiCodeCombo2["rt"] = 29810] = "rt";
  AsciiCodeCombo2[AsciiCodeCombo2["sg"] = 26483] = "sg";
  AsciiCodeCombo2[AsciiCodeCombo2["sw"] = 30579] = "sw";
  return AsciiCodeCombo2;
})(AsciiCodeCombo || {});
const modernConsonants = new Uint8Array([
  114 /* r */,
  // ㄱ
  82 /* R */,
  // ㄲ
  115 /* s */,
  // ㄴ
  101 /* e */,
  // ㄷ
  69 /* E */,
  // ㄸ
  102 /* f */,
  // ㄹ
  97 /* a */,
  // ㅁ
  113 /* q */,
  // ㅂ
  81 /* Q */,
  // ㅃ
  116 /* t */,
  // ㅅ
  84 /* T */,
  // ㅆ
  100 /* d */,
  // ㅇ
  119 /* w */,
  // ㅈ
  87 /* W */,
  // ㅉ
  99 /* c */,
  // ㅊ
  122 /* z */,
  // ㅋ
  120 /* x */,
  // ㅌ
  118 /* v */,
  // ㅍ
  103 /* g */
  // ㅎ
]);
const modernVowels = new Uint16Array([
  107 /* k */,
  //  -> ㅏ
  111 /* o */,
  //  -> ㅐ
  105 /* i */,
  //  -> ㅑ
  79 /* O */,
  //  -> ㅒ
  106 /* j */,
  //  -> ㅓ
  112 /* p */,
  //  -> ㅔ
  117 /* u */,
  //  -> ㅕ
  80 /* P */,
  //  -> ㅖ
  104 /* h */,
  //  -> ㅗ
  27496 /* hk */,
  //  -> ㅘ
  28520 /* ho */,
  //  -> ㅙ
  27752 /* hl */,
  //  -> ㅚ
  121 /* y */,
  //  -> ㅛ
  110 /* n */,
  //  -> ㅜ
  27246 /* nj */,
  //  -> ㅝ
  28782 /* np */,
  //  -> ㅞ
  27758 /* nl */,
  //  -> ㅟ
  98 /* b */,
  //  -> ㅠ
  109 /* m */,
  //  -> ㅡ
  27757 /* ml */,
  //  -> ㅢ
  108 /* l */
  //  -> ㅣ
]);
const modernFinalConsonants = new Uint16Array([
  114 /* r */,
  // ㄱ
  82 /* R */,
  // ㄲ
  29810 /* rt */,
  // ㄳ
  115 /* s */,
  // ㄴ
  30579 /* sw */,
  // ㄵ
  26483 /* sg */,
  // ㄶ
  101 /* e */,
  // ㄷ
  102 /* f */,
  // ㄹ
  29286 /* fr */,
  // ㄺ
  24934 /* fa */,
  // ㄻ
  29030 /* fq */,
  // ㄼ
  29798 /* ft */,
  // ㄽ
  30822 /* fx */,
  // ㄾ
  30310 /* fv */,
  // ㄿ
  26470 /* fg */,
  // ㅀ
  97 /* a */,
  // ㅁ
  113 /* q */,
  // ㅂ
  29809 /* qt */,
  // ㅄ
  116 /* t */,
  // ㅅ
  84 /* T */,
  // ㅆ
  100 /* d */,
  // ㅇ
  119 /* w */,
  // ㅈ
  99 /* c */,
  // ㅊ
  122 /* z */,
  // ㅋ
  120 /* x */,
  // ㅌ
  118 /* v */,
  // ㅍ
  103 /* g */
  // ㅎ
]);
const compatibilityJamo = new Uint16Array([
  114 /* r */,
  // ㄱ
  82 /* R */,
  // ㄲ
  29810 /* rt */,
  // ㄳ
  115 /* s */,
  // ㄴ
  30579 /* sw */,
  // ㄵ
  26483 /* sg */,
  // ㄶ
  101 /* e */,
  // ㄷ
  69 /* E */,
  // ㄸ
  102 /* f */,
  // ㄹ
  29286 /* fr */,
  // ㄺ
  24934 /* fa */,
  // ㄻ
  29030 /* fq */,
  // ㄼ
  29798 /* ft */,
  // ㄽ
  30822 /* fx */,
  // ㄾ
  30310 /* fv */,
  // ㄿ
  26470 /* fg */,
  // ㅀ
  97 /* a */,
  // ㅁ
  113 /* q */,
  // ㅂ
  81 /* Q */,
  // ㅃ
  29809 /* qt */,
  // ㅄ
  116 /* t */,
  // ㅅ
  84 /* T */,
  // ㅆ
  100 /* d */,
  // ㅇ
  119 /* w */,
  // ㅈ
  87 /* W */,
  // ㅉ
  99 /* c */,
  // ㅊ
  122 /* z */,
  // ㅋ
  120 /* x */,
  // ㅌ
  118 /* v */,
  // ㅍ
  103 /* g */,
  // ㅎ
  107 /* k */,
  // ㅏ
  111 /* o */,
  // ㅐ
  105 /* i */,
  // ㅑ
  79 /* O */,
  // ㅒ
  106 /* j */,
  // ㅓ
  112 /* p */,
  // ㅔ
  117 /* u */,
  // ㅕ
  80 /* P */,
  // ㅖ
  104 /* h */,
  // ㅗ
  27496 /* hk */,
  // ㅘ
  28520 /* ho */,
  // ㅙ
  27752 /* hl */,
  // ㅚ
  121 /* y */,
  // ㅛ
  110 /* n */,
  // ㅜ
  27246 /* nj */,
  // ㅝ
  28782 /* np */,
  // ㅞ
  27758 /* nl */,
  // ㅟ
  98 /* b */,
  // ㅠ
  109 /* m */,
  // ㅡ
  27757 /* ml */,
  // ㅢ
  108 /* l */
  // ㅣ
  // HF: Hangul Filler (everything after this is archaic)
  // ㅥ
  // ㅦ
  // ㅧ
  // ㅨ
  // ㅩ
  // ㅪ
  // ㅫ
  // ㅬ
  // ㅮ
  // ㅯ
  // ㅰ
  // ㅱ
  // ㅲ
  // ㅳ
  // ㅴ
  // ㅵ
  // ㅶ
  // ㅷ
  // ㅸ
  // ㅹ
  // ㅺ
  // ㅻ
  // ㅼ
  // ㅽ
  // ㅾ
  // ㅿ
  // ㆀ
  // ㆁ
  // ㆂ
  // ㆃ
  // ㆄ
  // ㆅ
  // ㆆ
  // ㆇ
  // ㆈ
  // ㆉ
  // ㆊ
  // ㆋ
  // ㆌ
  // ㆍ
  // ㆎ
]);
export {
  getKoreanAltChars
};
