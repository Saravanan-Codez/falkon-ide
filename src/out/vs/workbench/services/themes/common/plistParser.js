var ChCode = /* @__PURE__ */ ((ChCode2) => {
  ChCode2[ChCode2["BOM"] = 65279] = "BOM";
  ChCode2[ChCode2["SPACE"] = 32] = "SPACE";
  ChCode2[ChCode2["TAB"] = 9] = "TAB";
  ChCode2[ChCode2["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
  ChCode2[ChCode2["LINE_FEED"] = 10] = "LINE_FEED";
  ChCode2[ChCode2["SLASH"] = 47] = "SLASH";
  ChCode2[ChCode2["LESS_THAN"] = 60] = "LESS_THAN";
  ChCode2[ChCode2["QUESTION_MARK"] = 63] = "QUESTION_MARK";
  ChCode2[ChCode2["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
  return ChCode2;
})(ChCode || {});
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["ROOT_STATE"] = 0] = "ROOT_STATE";
  State2[State2["DICT_STATE"] = 1] = "DICT_STATE";
  State2[State2["ARR_STATE"] = 2] = "ARR_STATE";
  return State2;
})(State || {});
function parse(content) {
  return _parse(content, null, null);
}
function _parse(content, filename, locationKeyName) {
  const len = content.length;
  let pos = 0;
  let line = 1;
  let char = 0;
  if (len > 0 && content.charCodeAt(0) === 65279 /* BOM */) {
    pos = 1;
  }
  function advancePosBy(by) {
    if (locationKeyName === null) {
      pos = pos + by;
    } else {
      while (by > 0) {
        const chCode = content.charCodeAt(pos);
        if (chCode === 10 /* LINE_FEED */) {
          pos++;
          line++;
          char = 0;
        } else {
          pos++;
          char++;
        }
        by--;
      }
    }
  }
  function advancePosTo(to) {
    if (locationKeyName === null) {
      pos = to;
    } else {
      advancePosBy(to - pos);
    }
  }
  function skipWhitespace() {
    while (pos < len) {
      const chCode = content.charCodeAt(pos);
      if (chCode !== 32 /* SPACE */ && chCode !== 9 /* TAB */ && chCode !== 13 /* CARRIAGE_RETURN */ && chCode !== 10 /* LINE_FEED */) {
        break;
      }
      advancePosBy(1);
    }
  }
  function advanceIfStartsWith(str) {
    if (content.substr(pos, str.length) === str) {
      advancePosBy(str.length);
      return true;
    }
    return false;
  }
  function advanceUntil(str) {
    const nextOccurence = content.indexOf(str, pos);
    if (nextOccurence !== -1) {
      advancePosTo(nextOccurence + str.length);
    } else {
      advancePosTo(len);
    }
  }
  function captureUntil(str) {
    const nextOccurence = content.indexOf(str, pos);
    if (nextOccurence !== -1) {
      const r = content.substring(pos, nextOccurence);
      advancePosTo(nextOccurence + str.length);
      return r;
    } else {
      const r = content.substr(pos);
      advancePosTo(len);
      return r;
    }
  }
  let state = 0 /* ROOT_STATE */;
  let cur = null;
  const stateStack = [];
  const objStack = [];
  let curKey = null;
  function pushState(newState, newCur) {
    stateStack.push(state);
    objStack.push(cur);
    state = newState;
    cur = newCur;
  }
  function popState() {
    if (stateStack.length === 0) {
      return fail("illegal state stack");
    }
    state = stateStack.pop();
    cur = objStack.pop();
  }
  function fail(msg) {
    throw new Error("Near offset " + pos + ": " + msg + " ~~~" + content.substr(pos, 50) + "~~~");
  }
  const dictState = {
    enterDict: function() {
      if (curKey === null) {
        return fail("missing <key>");
      }
      const newDict = {};
      if (locationKeyName !== null) {
        newDict[locationKeyName] = {
          filename,
          line,
          char
        };
      }
      cur[curKey] = newDict;
      curKey = null;
      pushState(1 /* DICT_STATE */, newDict);
    },
    enterArray: function() {
      if (curKey === null) {
        return fail("missing <key>");
      }
      const newArr = [];
      cur[curKey] = newArr;
      curKey = null;
      pushState(2 /* ARR_STATE */, newArr);
    }
  };
  const arrState = {
    enterDict: function() {
      const newDict = {};
      if (locationKeyName !== null) {
        newDict[locationKeyName] = {
          filename,
          line,
          char
        };
      }
      cur.push(newDict);
      pushState(1 /* DICT_STATE */, newDict);
    },
    enterArray: function() {
      const newArr = [];
      cur.push(newArr);
      pushState(2 /* ARR_STATE */, newArr);
    }
  };
  function enterDict() {
    if (state === 1 /* DICT_STATE */) {
      dictState.enterDict();
    } else if (state === 2 /* ARR_STATE */) {
      arrState.enterDict();
    } else {
      cur = {};
      if (locationKeyName !== null) {
        cur[locationKeyName] = {
          filename,
          line,
          char
        };
      }
      pushState(1 /* DICT_STATE */, cur);
    }
  }
  function leaveDict() {
    if (state === 1 /* DICT_STATE */) {
      popState();
    } else if (state === 2 /* ARR_STATE */) {
      return fail("unexpected </dict>");
    } else {
      return fail("unexpected </dict>");
    }
  }
  function enterArray() {
    if (state === 1 /* DICT_STATE */) {
      dictState.enterArray();
    } else if (state === 2 /* ARR_STATE */) {
      arrState.enterArray();
    } else {
      cur = [];
      pushState(2 /* ARR_STATE */, cur);
    }
  }
  function leaveArray() {
    if (state === 1 /* DICT_STATE */) {
      return fail("unexpected </array>");
    } else if (state === 2 /* ARR_STATE */) {
      popState();
    } else {
      return fail("unexpected </array>");
    }
  }
  function acceptKey(val) {
    if (state === 1 /* DICT_STATE */) {
      if (curKey !== null) {
        return fail("too many <key>");
      }
      curKey = val;
    } else if (state === 2 /* ARR_STATE */) {
      return fail("unexpected <key>");
    } else {
      return fail("unexpected <key>");
    }
  }
  function acceptString(val) {
    if (state === 1 /* DICT_STATE */) {
      if (curKey === null) {
        return fail("missing <key>");
      }
      cur[curKey] = val;
      curKey = null;
    } else if (state === 2 /* ARR_STATE */) {
      cur.push(val);
    } else {
      cur = val;
    }
  }
  function acceptReal(val) {
    if (isNaN(val)) {
      return fail("cannot parse float");
    }
    if (state === 1 /* DICT_STATE */) {
      if (curKey === null) {
        return fail("missing <key>");
      }
      cur[curKey] = val;
      curKey = null;
    } else if (state === 2 /* ARR_STATE */) {
      cur.push(val);
    } else {
      cur = val;
    }
  }
  function acceptInteger(val) {
    if (isNaN(val)) {
      return fail("cannot parse integer");
    }
    if (state === 1 /* DICT_STATE */) {
      if (curKey === null) {
        return fail("missing <key>");
      }
      cur[curKey] = val;
      curKey = null;
    } else if (state === 2 /* ARR_STATE */) {
      cur.push(val);
    } else {
      cur = val;
    }
  }
  function acceptDate(val) {
    if (state === 1 /* DICT_STATE */) {
      if (curKey === null) {
        return fail("missing <key>");
      }
      cur[curKey] = val;
      curKey = null;
    } else if (state === 2 /* ARR_STATE */) {
      cur.push(val);
    } else {
      cur = val;
    }
  }
  function acceptData(val) {
    if (state === 1 /* DICT_STATE */) {
      if (curKey === null) {
        return fail("missing <key>");
      }
      cur[curKey] = val;
      curKey = null;
    } else if (state === 2 /* ARR_STATE */) {
      cur.push(val);
    } else {
      cur = val;
    }
  }
  function acceptBool(val) {
    if (state === 1 /* DICT_STATE */) {
      if (curKey === null) {
        return fail("missing <key>");
      }
      cur[curKey] = val;
      curKey = null;
    } else if (state === 2 /* ARR_STATE */) {
      cur.push(val);
    } else {
      cur = val;
    }
  }
  function escapeVal(str) {
    return str.replace(/&#([0-9]+);/g, function(_, m0) {
      return String.fromCodePoint(parseInt(m0, 10));
    }).replace(/&#x([0-9a-f]+);/g, function(_, m0) {
      return String.fromCodePoint(parseInt(m0, 16));
    }).replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, function(_) {
      switch (_) {
        case "&amp;":
          return "&";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        case "&apos;":
          return "'";
      }
      return _;
    });
  }
  function parseOpenTag() {
    let r = captureUntil(">");
    let isClosed = false;
    if (r.charCodeAt(r.length - 1) === 47 /* SLASH */) {
      isClosed = true;
      r = r.substring(0, r.length - 1);
    }
    return {
      name: r.trim(),
      isClosed
    };
  }
  function parseTagValue(tag) {
    if (tag.isClosed) {
      return "";
    }
    const val = captureUntil("</");
    advanceUntil(">");
    return escapeVal(val);
  }
  while (pos < len) {
    skipWhitespace();
    if (pos >= len) {
      break;
    }
    const chCode = content.charCodeAt(pos);
    advancePosBy(1);
    if (chCode !== 60 /* LESS_THAN */) {
      return fail("expected <");
    }
    if (pos >= len) {
      return fail("unexpected end of input");
    }
    const peekChCode = content.charCodeAt(pos);
    if (peekChCode === 63 /* QUESTION_MARK */) {
      advancePosBy(1);
      advanceUntil("?>");
      continue;
    }
    if (peekChCode === 33 /* EXCLAMATION_MARK */) {
      advancePosBy(1);
      if (advanceIfStartsWith("--")) {
        advanceUntil("-->");
        continue;
      }
      advanceUntil(">");
      continue;
    }
    if (peekChCode === 47 /* SLASH */) {
      advancePosBy(1);
      skipWhitespace();
      if (advanceIfStartsWith("plist")) {
        advanceUntil(">");
        continue;
      }
      if (advanceIfStartsWith("dict")) {
        advanceUntil(">");
        leaveDict();
        continue;
      }
      if (advanceIfStartsWith("array")) {
        advanceUntil(">");
        leaveArray();
        continue;
      }
      return fail("unexpected closed tag");
    }
    const tag = parseOpenTag();
    switch (tag.name) {
      case "dict":
        enterDict();
        if (tag.isClosed) {
          leaveDict();
        }
        continue;
      case "array":
        enterArray();
        if (tag.isClosed) {
          leaveArray();
        }
        continue;
      case "key":
        acceptKey(parseTagValue(tag));
        continue;
      case "string":
        acceptString(parseTagValue(tag));
        continue;
      case "real":
        acceptReal(parseFloat(parseTagValue(tag)));
        continue;
      case "integer":
        acceptInteger(parseInt(parseTagValue(tag), 10));
        continue;
      case "date":
        acceptDate(new Date(parseTagValue(tag)));
        continue;
      case "data":
        acceptData(parseTagValue(tag));
        continue;
      case "true":
        parseTagValue(tag);
        acceptBool(true);
        continue;
      case "false":
        parseTagValue(tag);
        acceptBool(false);
        continue;
    }
    if (/^plist/.test(tag.name)) {
      continue;
    }
    return fail("unexpected opened tag " + tag.name);
  }
  return cur;
}
export {
  parse
};
