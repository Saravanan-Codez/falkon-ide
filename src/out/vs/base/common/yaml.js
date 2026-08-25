import { localize } from "../../nls.js";
function parse(input, errors = [], options = {}) {
  const scanner = new YamlScanner(input);
  const tokens = scanner.scan();
  const parser = new YamlParser(tokens, input, errors, options);
  return parser.parse();
}
function parseFrontMatter(input, errors = [], options = {}) {
  const tokens = new YamlScanner(input).scan();
  if (tokens.length === 0 || tokens[0].type !== 11 /* DocumentStart */) {
    return new MarkdownNode(void 0, input);
  }
  const hasClosingFrontMatter = tokens.slice(1).some((token) => token.type === 11 /* DocumentStart */);
  if (!hasClosingFrontMatter) {
    return new MarkdownNode(void 0, input);
  }
  const header = new YamlParser(tokens, input, errors, options).parse();
  const lastToken = tokens[tokens.length - 1];
  const body = lastToken.type === 13 /* EOF */ ? input.substring(lastToken.startOffset) : "";
  return new MarkdownNode(header, body);
}
class MarkdownNode {
  constructor(header, body) {
    this.header = header;
    this.body = body;
  }
  getStringValue(name) {
    if (this.header && this.header.type === "map") {
      const property = this.header.properties.find((p) => p.key.value === name);
      if (property && property.value.type === "scalar") {
        return property.value.value;
      }
    }
    return void 0;
  }
  getStringArrayValue(name) {
    if (this.header && this.header.type === "map") {
      const property = this.header.properties.find((p) => p.key.value === name);
      if (property && property.value.type === "sequence") {
        return property.value.items.filter((item) => item.type === "scalar").map((item) => item.value);
      } else if (property && property.value.type === "scalar") {
        if (property.value.format === "none") {
          return parseCommaSeparatedList(property.value.value, 0).map((item) => item.value);
        } else {
          return [property.value.value];
        }
      }
    }
    return void 0;
  }
  getBooleanValue(name) {
    const value = this.getStringValue(name);
    if (value === "true") {
      return true;
    } else if (value === "false") {
      return false;
    }
    return void 0;
  }
}
function parseCommaSeparatedList(value, offset = 0) {
  const parsed = parse(`[${value}]`);
  const shift = offset - 1;
  const items = [];
  if (parsed && parsed.type === "sequence") {
    for (const item of parsed.items) {
      if (item.type === "scalar") {
        items.push({ ...item, startOffset: item.startOffset + shift, endOffset: item.endOffset + shift });
      }
    }
  } else {
    items.push({ type: "scalar", value, rawValue: value, startOffset: offset, endOffset: value.length + offset, format: "none" });
  }
  return items;
}
var TokenType = /* @__PURE__ */ ((TokenType2) => {
  TokenType2[TokenType2["Scalar"] = 0] = "Scalar";
  TokenType2[TokenType2["Colon"] = 1] = "Colon";
  TokenType2[TokenType2["Dash"] = 2] = "Dash";
  TokenType2[TokenType2["Comma"] = 3] = "Comma";
  TokenType2[TokenType2["FlowMapStart"] = 4] = "FlowMapStart";
  TokenType2[TokenType2["FlowMapEnd"] = 5] = "FlowMapEnd";
  TokenType2[TokenType2["FlowSeqStart"] = 6] = "FlowSeqStart";
  TokenType2[TokenType2["FlowSeqEnd"] = 7] = "FlowSeqEnd";
  TokenType2[TokenType2["Newline"] = 8] = "Newline";
  TokenType2[TokenType2["Indent"] = 9] = "Indent";
  TokenType2[TokenType2["Comment"] = 10] = "Comment";
  TokenType2[TokenType2["DocumentStart"] = 11] = "DocumentStart";
  TokenType2[TokenType2["DocumentEnd"] = 12] = "DocumentEnd";
  TokenType2[TokenType2["EOF"] = 13] = "EOF";
  return TokenType2;
})(TokenType || {});
function makeToken(type, startOffset, endOffset, extra) {
  return {
    type,
    startOffset,
    endOffset,
    rawValue: extra?.rawValue ?? "",
    value: extra?.value ?? "",
    format: extra?.format ?? "none",
    indent: extra?.indent ?? 0
  };
}
class YamlScanner {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
    // Track flow nesting depth so commas and flow indicators are only special inside flow collections
    this.flowDepth = 0;
    // Track whether we've already seen a block colon on the current line.
    // After the first key: value colon, subsequent ': ' on the same line is part of the scalar value.
    this.seenBlockColon = false;
    this.seenDocumentStart = 0;
  }
  scan(maxDocuments = 1) {
    while (this.pos < this.input.length) {
      this.scanLine();
      if (this.seenDocumentStart > maxDocuments) {
        break;
      }
    }
    this.tokens.push(makeToken(13 /* EOF */, this.pos, this.pos));
    return this.tokens;
  }
  // Scan a single logical line (up to and including the newline character)
  scanLine() {
    this.seenBlockColon = false;
    if (this.peekChar() === "\n") {
      this.tokens.push(makeToken(8 /* Newline */, this.pos, this.pos + 1));
      this.pos++;
      return;
    }
    if (this.peekChar() === "\r") {
      const end = this.pos + (this.input[this.pos + 1] === "\n" ? 2 : 1);
      this.tokens.push(makeToken(8 /* Newline */, this.pos, end));
      this.pos = end;
      return;
    }
    const indentStart = this.pos;
    let indent = 0;
    while (this.pos < this.input.length && (this.input[this.pos] === " " || this.input[this.pos] === "	")) {
      indent++;
      this.pos++;
    }
    if (indent > 0) {
      this.tokens.push(makeToken(9 /* Indent */, indentStart, this.pos, { indent }));
    }
    if (this.pos >= this.input.length || this.peekChar() === "\n" || this.peekChar() === "\r") {
      if (this.pos < this.input.length) {
        const nlStart = this.pos;
        const end = this.peekChar() === "\r" && this.input[this.pos + 1] === "\n" ? this.pos + 2 : this.pos + 1;
        this.tokens.push(makeToken(8 /* Newline */, nlStart, end));
        this.pos = end;
      }
      return;
    }
    if (indent === 0 && this.input.length - this.pos >= 3) {
      const c0 = this.input[this.pos];
      const c1 = this.input[this.pos + 1];
      const c2 = this.input[this.pos + 2];
      const c3 = this.input[this.pos + 3];
      const isTerminator = c3 === void 0 || c3 === " " || c3 === "	" || c3 === "\n" || c3 === "\r";
      if (c0 === "-" && c1 === "-" && c2 === "-" && isTerminator) {
        this.tokens.push(makeToken(11 /* DocumentStart */, this.pos, this.pos + 3));
        this.pos += 3;
        this.scanLineContent();
        this.scanNewline();
        this.seenDocumentStart++;
        return;
      }
      if (c0 === "." && c1 === "." && c2 === "." && isTerminator) {
        this.tokens.push(makeToken(12 /* DocumentEnd */, this.pos, this.pos + 3));
        this.pos += 3;
        this.scanLineContent();
        this.scanNewline();
        return;
      }
    }
    if (this.peekChar() === "#") {
      this.scanComment();
      this.scanNewline();
      return;
    }
    if (this.peekChar() === "%") {
      while (this.pos < this.input.length && this.input[this.pos] !== "\n" && this.input[this.pos] !== "\r") {
        this.pos++;
      }
      this.scanNewline();
      return;
    }
    this.scanLineContent();
    this.scanNewline();
  }
  scanLineContent() {
    while (this.pos < this.input.length && this.peekChar() !== "\n" && this.peekChar() !== "\r") {
      this.skipInlineWhitespace();
      if (this.pos >= this.input.length || this.peekChar() === "\n" || this.peekChar() === "\r") {
        break;
      }
      const ch = this.peekChar();
      if (ch === "#") {
        this.scanComment();
        break;
      } else if (ch === "{") {
        this.flowDepth++;
        this.tokens.push(makeToken(4 /* FlowMapStart */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === "}" && this.flowDepth > 0) {
        this.flowDepth--;
        this.tokens.push(makeToken(5 /* FlowMapEnd */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === "[") {
        this.flowDepth++;
        this.tokens.push(makeToken(6 /* FlowSeqStart */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === "]" && this.flowDepth > 0) {
        this.flowDepth--;
        this.tokens.push(makeToken(7 /* FlowSeqEnd */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === "," && this.flowDepth > 0) {
        this.tokens.push(makeToken(3 /* Comma */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === "-" && this.isBlockDash()) {
        this.tokens.push(makeToken(2 /* Dash */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === ":" && this.isBlockColon()) {
        this.tokens.push(makeToken(1 /* Colon */, this.pos, this.pos + 1));
        this.pos++;
        if (this.flowDepth === 0) {
          this.seenBlockColon = true;
        }
      } else if (ch === ":" && this.flowDepth > 0 && this.lastTokenIsJsonLike()) {
        this.tokens.push(makeToken(1 /* Colon */, this.pos, this.pos + 1));
        this.pos++;
      } else if (ch === "'" || ch === '"') {
        this.scanQuotedScalar(ch);
      } else if ((ch === "|" || ch === ">") && this.flowDepth === 0 && this.isBlockScalarStart()) {
        this.scanBlockScalar(ch);
        break;
      } else {
        this.scanUnquotedScalar();
      }
    }
  }
  /** Check if '-' is a block sequence dash (followed by space, newline, or EOF) */
  isBlockDash() {
    const next = this.input[this.pos + 1];
    return next === void 0 || next === " " || next === "	" || next === "\n" || next === "\r";
  }
  /** Check if ':' acts as a mapping value indicator (followed by space, newline, EOF, or flow indicator) */
  isBlockColon() {
    if (this.seenBlockColon && this.flowDepth === 0) {
      return false;
    }
    const next = this.input[this.pos + 1];
    if (next === void 0 || next === " " || next === "	" || next === "\n" || next === "\r") {
      return true;
    }
    if (this.flowDepth > 0 && (next === "," || next === "}" || next === "]")) {
      return true;
    }
    return false;
  }
  /** Check if the last non-whitespace token is a JSON-like node (quoted scalar or flow end) */
  lastTokenIsJsonLike() {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const t = this.tokens[i];
      if (t.type === 8 /* Newline */ || t.type === 9 /* Indent */ || t.type === 10 /* Comment */) {
        continue;
      }
      if (t.type === 0 /* Scalar */ && t.format !== "none") {
        return true;
      }
      if (t.type === 5 /* FlowMapEnd */ || t.type === 7 /* FlowSeqEnd */) {
        return true;
      }
      return false;
    }
    return false;
  }
  scanQuotedScalar(quote) {
    const start = this.pos;
    this.pos++;
    let value = "";
    let trailingLiteralWs = 0;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === quote) {
        if (quote === "'" && this.input[this.pos + 1] === "'") {
          value += "'";
          this.pos += 2;
          trailingLiteralWs = 0;
          continue;
        }
        this.pos++;
        const rawValue2 = this.input.substring(start, this.pos);
        this.tokens.push(makeToken(0 /* Scalar */, start, this.pos, {
          rawValue: rawValue2,
          value,
          format: quote === "'" ? "single" : "double"
        }));
        return;
      }
      if (quote === '"' && ch === "\\") {
        const next = this.input[this.pos + 1];
        if (next === "\n" || next === "\r") {
          this.pos++;
          this.consumeNewline();
          this.skipInlineWhitespace();
          trailingLiteralWs = 0;
          continue;
        }
        switch (next) {
          case "n":
            value += "\n";
            break;
          case "t":
            value += "	";
            break;
          case "\\":
            value += "\\";
            break;
          case '"':
            value += '"';
            break;
          case "/":
            value += "/";
            break;
          case "r":
            value += "\r";
            break;
          case "0":
            value += "\0";
            break;
          case "a":
            value += "\x07";
            break;
          case "b":
            value += "\b";
            break;
          case "e":
            value += "\x1B";
            break;
          case "v":
            value += "\v";
            break;
          case "f":
            value += "\f";
            break;
          case " ":
            value += " ";
            break;
          case "_":
            value += "\xA0";
            break;
          case "x": {
            const hex = this.input.substring(this.pos + 2, this.pos + 4);
            const code = parseInt(hex, 16);
            if (hex.length === 2 && !isNaN(code)) {
              value += String.fromCharCode(code);
              this.pos += 4;
            } else {
              value += "\\x";
              this.pos += 2;
            }
            trailingLiteralWs = 0;
            continue;
          }
          case "u": {
            const hex = this.input.substring(this.pos + 2, this.pos + 6);
            const code = parseInt(hex, 16);
            if (hex.length === 4 && !isNaN(code)) {
              value += String.fromCodePoint(code);
              this.pos += 6;
            } else {
              value += "\\u";
              this.pos += 2;
            }
            trailingLiteralWs = 0;
            continue;
          }
          case "U": {
            const hex = this.input.substring(this.pos + 2, this.pos + 10);
            const code = parseInt(hex, 16);
            if (hex.length === 8 && !isNaN(code)) {
              value += String.fromCodePoint(code);
              this.pos += 10;
            } else {
              value += "\\U";
              this.pos += 2;
            }
            trailingLiteralWs = 0;
            continue;
          }
          default:
            value += "\\" + (next ?? "");
            break;
        }
        this.pos += 2;
        trailingLiteralWs = 0;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (trailingLiteralWs > 0) {
          value = value.substring(0, value.length - trailingLiteralWs);
        }
        trailingLiteralWs = 0;
        this.consumeNewline();
        let emptyLineCount = 0;
        while (this.pos < this.input.length) {
          this.skipInlineWhitespace();
          const c = this.input[this.pos];
          if (c === "\n" || c === "\r") {
            emptyLineCount++;
            this.consumeNewline();
          } else {
            break;
          }
        }
        if (emptyLineCount > 0) {
          value += "\n".repeat(emptyLineCount);
        } else {
          value += " ";
        }
        continue;
      }
      if (ch === " " || ch === "	") {
        trailingLiteralWs++;
      } else {
        trailingLiteralWs = 0;
      }
      value += ch;
      this.pos++;
    }
    const rawValue = this.input.substring(start, this.pos);
    this.tokens.push(makeToken(0 /* Scalar */, start, this.pos, {
      rawValue,
      value,
      format: quote === "'" ? "single" : "double"
    }));
  }
  scanUnquotedScalar() {
    const start = this.pos;
    let end = this.pos;
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === "\n" || ch === "\r") {
        break;
      }
      if (this.flowDepth > 0 && (ch === "," || ch === "}" || ch === "]")) {
        break;
      }
      if (this.flowDepth > 0 && (ch === "{" || ch === "[")) {
        break;
      }
      if (ch === ":" && this.isBlockColon()) {
        break;
      }
      if (ch === "#" && this.pos > start && (this.input[this.pos - 1] === " " || this.input[this.pos - 1] === "	")) {
        break;
      }
      this.pos++;
      if (ch !== " " && ch !== "	") {
        end = this.pos;
      }
    }
    const rawValue = this.input.substring(start, end);
    this.tokens.push(makeToken(0 /* Scalar */, start, end, {
      rawValue,
      value: rawValue,
      format: "none"
    }));
  }
  /**
   * Check if '|' or '>' at the current position is a block scalar indicator.
   * Must be followed by optional indentation/chomping indicators, optional comment, then newline.
   */
  isBlockScalarStart() {
    let p = this.pos + 1;
    while (p < this.input.length) {
      const c2 = this.input[p];
      if (c2 >= "1" && c2 <= "9") {
        p++;
        continue;
      }
      if (c2 === "+" || c2 === "-") {
        p++;
        continue;
      }
      break;
    }
    while (p < this.input.length && (this.input[p] === " " || this.input[p] === "	")) {
      p++;
    }
    if (p >= this.input.length) {
      return true;
    }
    const c = this.input[p];
    return c === "\n" || c === "\r" || c === "#";
  }
  /**
   * Scan a block scalar (literal '|' or folded '>').
   * Parses the header line for indentation indicator and chomping mode,
   * then collects all content lines that are indented beyond the detected indentation.
   */
  scanBlockScalar(style) {
    const start = this.pos;
    this.pos++;
    let explicitIndent = 0;
    let chomping = "clip";
    for (let i = 0; i < 2; i++) {
      if (this.pos < this.input.length) {
        const c = this.input[this.pos];
        if (c >= "1" && c <= "9" && explicitIndent === 0) {
          explicitIndent = parseInt(c, 10);
          this.pos++;
        } else if (c === "-" && chomping === "clip") {
          chomping = "strip";
          this.pos++;
        } else if (c === "+" && chomping === "clip") {
          chomping = "keep";
          this.pos++;
        }
      }
    }
    while (this.pos < this.input.length && (this.input[this.pos] === " " || this.input[this.pos] === "	")) {
      this.pos++;
    }
    if (this.pos < this.input.length && this.input[this.pos] === "#") {
      while (this.pos < this.input.length && this.input[this.pos] !== "\n" && this.input[this.pos] !== "\r") {
        this.pos++;
      }
    }
    this.consumeNewline();
    const parentBlockIndent = this.getParentBlockIndent(start);
    let contentIndent = explicitIndent > 0 ? parentBlockIndent + explicitIndent : 0;
    const lines = [];
    let trailingNewlines = 0;
    while (this.pos < this.input.length) {
      const lineStart = this.pos;
      let lineIndent = 0;
      while (this.pos < this.input.length && this.input[this.pos] === " ") {
        lineIndent++;
        this.pos++;
      }
      if (this.pos >= this.input.length || this.input[this.pos] === "\n" || this.input[this.pos] === "\r") {
        if (contentIndent > 0 && lineIndent >= contentIndent) {
          const preserved = this.input.substring(lineStart + contentIndent, this.pos);
          lines.push(preserved);
          if (preserved === "") {
            trailingNewlines++;
          } else {
            trailingNewlines = 0;
          }
        } else {
          lines.push("");
          trailingNewlines++;
        }
        this.consumeNewline();
        continue;
      }
      if (lineIndent === 0 && this.input.length - this.pos >= 3) {
        const c0 = this.input[this.pos];
        const c1 = this.input[this.pos + 1];
        const c2 = this.input[this.pos + 2];
        const c3 = this.input[this.pos + 3];
        const isTerm = c3 === void 0 || c3 === " " || c3 === "	" || c3 === "\n" || c3 === "\r";
        if (c0 === "-" && c1 === "-" && c2 === "-" && isTerm || c0 === "." && c1 === "." && c2 === "." && isTerm) {
          this.pos = lineStart;
          break;
        }
      }
      if (contentIndent === 0) {
        if (lineIndent <= parentBlockIndent) {
          this.pos = lineStart;
          break;
        }
        contentIndent = lineIndent;
      }
      if (lineIndent < contentIndent) {
        this.pos = lineStart;
        break;
      }
      const contentStart = lineStart + contentIndent;
      while (this.pos < this.input.length && this.input[this.pos] !== "\n" && this.input[this.pos] !== "\r") {
        this.pos++;
      }
      const lineContent = this.input.substring(contentStart, this.pos);
      lines.push(lineContent);
      trailingNewlines = 0;
      this.consumeNewline();
    }
    let value;
    if (style === "|") {
      value = lines.join("\n");
    } else {
      value = "";
      let lastNonEmptyIsMoreIndented = false;
      let inEmptyRun = false;
      let seenNonEmpty = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isMoreIndented = line.length > 0 && (line[0] === " " || line[0] === "	");
        if (line === "") {
          value += "\n";
          inEmptyRun = true;
        } else if (i === 0) {
          value = line;
          lastNonEmptyIsMoreIndented = isMoreIndented;
          seenNonEmpty = true;
        } else if (inEmptyRun) {
          if ((lastNonEmptyIsMoreIndented || isMoreIndented) && seenNonEmpty) {
            value += "\n" + line;
          } else {
            value += line;
          }
          lastNonEmptyIsMoreIndented = isMoreIndented;
          inEmptyRun = false;
          seenNonEmpty = true;
        } else if (isMoreIndented || lastNonEmptyIsMoreIndented) {
          value += "\n" + line;
          lastNonEmptyIsMoreIndented = isMoreIndented;
          seenNonEmpty = true;
        } else {
          value += " " + line;
          lastNonEmptyIsMoreIndented = false;
          seenNonEmpty = true;
        }
      }
    }
    if (trailingNewlines > 0) {
      let end = value.length;
      while (end > 0 && value[end - 1] === "\n") {
        end--;
      }
      value = value.substring(0, end);
    }
    const hasContent = lines.some((l) => l !== "");
    switch (chomping) {
      case "clip":
        if (hasContent) {
          value += "\n";
        }
        break;
      case "keep":
        if (hasContent) {
          value += "\n".repeat(trailingNewlines + 1);
        } else {
          value = "\n".repeat(trailingNewlines);
        }
        break;
      case "strip":
        break;
    }
    const rawValue = this.input.substring(start, this.pos);
    this.tokens.push(makeToken(0 /* Scalar */, start, this.pos, {
      rawValue,
      value,
      format: style === "|" ? "literal" : "folded"
    }));
  }
  /**
   * Determine the parent block's indentation level for a block scalar.
   * Looks at preceding tokens to find the context:
   * - After Colon: the indentation of the line containing the mapping key
   * - After Dash: the column of the dash
   * - At document level: -1 (allows content at indent 0)
   */
  getParentBlockIndent(blockScalarPos) {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const t = this.tokens[i];
      if (t.type === 8 /* Newline */ || t.type === 10 /* Comment */ || t.type === 9 /* Indent */) {
        continue;
      }
      if (t.type === 1 /* Colon */) {
        for (let j = i - 1; j >= 0; j--) {
          const kt = this.tokens[j];
          if (kt.type === 8 /* Newline */ || kt.type === 10 /* Comment */ || kt.type === 9 /* Indent */) {
            continue;
          }
          return this.getColumnAt(kt.startOffset);
        }
        return 0;
      }
      if (t.type === 2 /* Dash */) {
        return this.getColumnAt(t.startOffset);
      }
      if (t.type === 11 /* DocumentStart */) {
        return -1;
      }
      break;
    }
    return 0;
  }
  /**
   * Get the column (0-based offset from start of line) for a position in the input.
   */
  getColumnAt(offset) {
    let col = 0;
    let p = offset - 1;
    while (p >= 0 && this.input[p] !== "\n" && this.input[p] !== "\r") {
      col++;
      p--;
    }
    return col;
  }
  scanComment() {
    const start = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== "\n" && this.input[this.pos] !== "\r") {
      this.pos++;
    }
    this.tokens.push(makeToken(10 /* Comment */, start, this.pos, {
      rawValue: this.input.substring(start, this.pos),
      value: this.input.substring(start, this.pos)
    }));
  }
  scanNewline() {
    const start = this.pos;
    if (this.consumeNewline()) {
      this.tokens.push(makeToken(8 /* Newline */, start, this.pos));
    }
  }
  skipInlineWhitespace() {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === " " || ch === "	") {
        this.pos++;
      } else {
        break;
      }
    }
  }
  /** Advance past a newline sequence (\r\n, \n, or \r). Returns true if a newline was consumed. */
  consumeNewline() {
    if (this.pos >= this.input.length) {
      return false;
    }
    if (this.input[this.pos] === "\r" && this.input[this.pos + 1] === "\n") {
      this.pos += 2;
      return true;
    }
    if (this.input[this.pos] === "\n" || this.input[this.pos] === "\r") {
      this.pos++;
      return true;
    }
    return false;
  }
  peekChar() {
    return this.input[this.pos];
  }
}
class YamlParser {
  constructor(tokens, input, errors, options) {
    this.tokens = tokens;
    this.input = input;
    this.errors = errors;
    this.options = options;
    this.pos = 0;
  }
  parse() {
    this.skipNewlinesAndComments();
    if (this.currentToken().type === 11 /* DocumentStart */) {
      this.advance();
      this.skipNewlinesAndComments();
    }
    if (this.currentToken().type === 13 /* EOF */ || this.currentToken().type === 12 /* DocumentEnd */) {
      return void 0;
    }
    const result = this.parseValue(-1);
    return result;
  }
  // -- helpers ----------------------------------------------------------
  currentToken() {
    return this.tokens[this.pos];
  }
  peek(offset = 0) {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }
  advance() {
    const t = this.tokens[this.pos];
    if (t.type !== 13 /* EOF */) {
      this.pos++;
    }
    return t;
  }
  expect(type) {
    const t = this.currentToken();
    if (t.type === type) {
      return this.advance();
    }
    return t;
  }
  emitError(message, startOffset, endOffset, code) {
    this.errors.push({ message, startOffset, endOffset, code });
  }
  skipNewlinesAndComments() {
    while (this.currentToken().type === 8 /* Newline */ || this.currentToken().type === 10 /* Comment */ || this.currentToken().type === 9 /* Indent */ && this.isFollowedByNewlineOrComment()) {
      this.advance();
    }
  }
  /** Returns true if the current Indent token is followed immediately by Newline/Comment/EOF */
  isFollowedByNewlineOrComment() {
    const next = this.peek(1);
    return next.type === 8 /* Newline */ || next.type === 10 /* Comment */ || next.type === 13 /* EOF */;
  }
  /**
   * Determines the current indentation level.
   * If the current token is an Indent, returns its indent value.
   * Otherwise returns 0 (token is at column 0).
   */
  currentIndent() {
    if (this.currentToken().type === 9 /* Indent */) {
      return this.currentToken().indent;
    }
    return 0;
  }
  // -- Main parse entry for a value at a given indentation --------------
  parseValue(parentIndent) {
    this.skipNewlinesAndComments();
    const token = this.currentToken();
    const flowToken = token.type === 9 /* Indent */ ? this.peek(1) : token;
    if (flowToken.type === 4 /* FlowMapStart */ || flowToken.type === 6 /* FlowSeqStart */) {
      if (token.type === 9 /* Indent */) {
        this.advance();
      }
      if (flowToken.type === 4 /* FlowMapStart */) {
        return this.parseFlowMap();
      }
      return this.parseFlowSeq();
    }
    const indent = this.currentIndent();
    const firstContentToken = this.peekPastIndent();
    if (firstContentToken.type === 2 /* Dash */) {
      return this.parseBlockSequence(indent);
    }
    if (this.looksLikeMapping()) {
      return this.parseBlockMapping(indent);
    }
    if (token.type === 0 /* Scalar */ || token.type === 9 /* Indent */) {
      return this.parseScalar(parentIndent);
    }
    return void 0;
  }
  /** Peek past an optional Indent token to see the first content token */
  peekPastIndent() {
    if (this.currentToken().type === 9 /* Indent */) {
      return this.peek(1);
    }
    return this.currentToken();
  }
  /** Check if tokens at current position look like a mapping entry (key: value) */
  looksLikeMapping() {
    let offset = 0;
    if (this.peek(offset).type === 9 /* Indent */) {
      offset++;
    }
    if (this.peek(offset).type === 0 /* Scalar */) {
      offset++;
      if (this.peek(offset).type === 1 /* Colon */) {
        return true;
      }
    }
    return false;
  }
  // -- Scalar ----------------------------------------------------------
  parseScalar(parentIndent = -1) {
    if (this.currentToken().type === 9 /* Indent */) {
      this.advance();
    }
    const token = this.expect(0 /* Scalar */);
    if (token.format !== "none") {
      return this.scalarFromToken(token);
    }
    return this.parsePlainMultiline(token, parentIndent);
  }
  /**
   * Parse a multiline plain scalar. The first line's token is already consumed.
   * Continuation lines must be indented deeper than `parentIndent`.
   * Line folding rules:
   * - Single line break → space
   * - Each empty line → preserved as \n
   */
  parsePlainMultiline(firstToken, parentIndent) {
    let value = firstToken.value;
    let endOffset = firstToken.endOffset;
    while (true) {
      const savedPos = this.pos;
      let emptyLineCount = 0;
      let foundContent = false;
      while (this.pos < this.tokens.length) {
        const t = this.currentToken();
        if (t.type === 10 /* Comment */) {
          break;
        }
        if (t.type === 8 /* Newline */) {
          this.advance();
          const afterNewline = this.currentToken();
          if (afterNewline.type === 8 /* Newline */) {
            emptyLineCount++;
            continue;
          }
          if (afterNewline.type === 9 /* Indent */) {
            const afterIndent = this.peek(1);
            if (afterIndent.type === 8 /* Newline */ || afterIndent.type === 13 /* EOF */) {
              emptyLineCount++;
              this.advance();
              continue;
            }
            if (afterIndent.type === 10 /* Comment */) {
              break;
            }
            if (afterNewline.indent > parentIndent) {
              foundContent = true;
              break;
            } else {
              break;
            }
          }
          if (afterNewline.type === 13 /* EOF */) {
            break;
          }
          if (afterNewline.type === 11 /* DocumentStart */ || afterNewline.type === 12 /* DocumentEnd */) {
            break;
          }
          if (parentIndent < 0) {
            foundContent = true;
            break;
          }
          break;
        }
        if (t.type === 9 /* Indent */) {
          break;
        }
        break;
      }
      if (!foundContent) {
        this.pos = savedPos;
        break;
      }
      if (this.currentToken().type === 9 /* Indent */) {
        this.advance();
      }
      if (this.currentToken().type !== 0 /* Scalar */) {
        if (this.currentToken().type === 2 /* Dash */) {
          const dashToken = this.advance();
          let lineText = "-";
          if (this.currentToken().type === 0 /* Scalar */) {
            const restToken = this.advance();
            lineText = "- " + restToken.value;
            endOffset = restToken.endOffset;
          } else {
            endOffset = dashToken.endOffset;
          }
          if (emptyLineCount > 0) {
            value += "\n".repeat(emptyLineCount);
          } else {
            value += " ";
          }
          value += lineText;
          continue;
        }
        this.pos = savedPos;
        break;
      }
      if (this.peek(1).type === 1 /* Colon */) {
        this.pos = savedPos;
        break;
      }
      const contToken = this.advance();
      if (emptyLineCount > 0) {
        value += "\n".repeat(emptyLineCount);
      } else {
        value += " ";
      }
      value += contToken.value;
      endOffset = contToken.endOffset;
    }
    return {
      type: "scalar",
      value,
      rawValue: this.input.substring(firstToken.startOffset, endOffset),
      startOffset: firstToken.startOffset,
      endOffset,
      format: "none"
    };
  }
  // -- Block mapping ---------------------------------------------------
  parseBlockMapping(baseIndent, inlineFirstEntry = false) {
    const startOffset = this.currentToken().startOffset;
    const properties = [];
    const seenKeys = /* @__PURE__ */ new Set();
    if (inlineFirstEntry) {
      const firstEntry = this.parseMappingEntry(baseIndent);
      if (firstEntry) {
        seenKeys.add(firstEntry.key.value);
        properties.push(firstEntry);
      }
    }
    while (this.currentToken().type !== 13 /* EOF */) {
      this.skipNewlinesAndComments();
      if (this.currentToken().type === 13 /* EOF */) {
        break;
      }
      const indent = this.currentIndent();
      if (indent < baseIndent) {
        break;
      }
      if (indent !== baseIndent) {
        if (indent > baseIndent) {
          this.emitError(
            localize("unexpectedIndentation", "Unexpected indentation (expected {0}, got {1})", baseIndent, indent),
            this.currentToken().startOffset,
            this.currentToken().endOffset,
            "unexpected-indentation"
          );
        } else {
          break;
        }
      }
      if (!this.looksLikeMapping()) {
        break;
      }
      const entry = this.parseMappingEntry(baseIndent);
      if (!entry) {
        break;
      }
      if (!this.options.allowDuplicateKeys && seenKeys.has(entry.key.value)) {
        this.emitError(
          localize("duplicateKey", 'Duplicate key: "{0}"', entry.key.value),
          entry.key.startOffset,
          entry.key.endOffset,
          "duplicate-key"
        );
      }
      seenKeys.add(entry.key.value);
      properties.push(entry);
    }
    const endOffset = properties.length > 0 ? properties[properties.length - 1].value.endOffset : startOffset;
    return { type: "map", properties, style: "block", startOffset, endOffset };
  }
  parseMappingEntry(baseIndent) {
    if (this.currentToken().type === 9 /* Indent */) {
      this.advance();
    }
    const keyToken = this.expect(0 /* Scalar */);
    const key = this.scalarFromToken(keyToken);
    const colon = this.expect(1 /* Colon */);
    if (colon.type !== 1 /* Colon */) {
      this.emitError(localize("expectedColon", 'Expected ":"'), colon.startOffset, colon.endOffset, "expected-colon");
      return void 0;
    }
    const value = this.parseMappingValue(baseIndent, colon);
    return { key, value };
  }
  parseMappingValue(baseIndent, colonToken) {
    const next = this.currentToken();
    if (next.type === 4 /* FlowMapStart */) {
      return this.parseFlowMap();
    }
    if (next.type === 6 /* FlowSeqStart */) {
      return this.parseFlowSeq();
    }
    if (next.type === 0 /* Scalar */) {
      if (this.currentToken().type === 9 /* Indent */) {
        this.advance();
      }
      const token = this.advance();
      if (token.format !== "none") {
        return this.scalarFromToken(token);
      }
      return this.parsePlainMultiline(token, baseIndent);
    }
    this.skipNewlinesAndComments();
    const afterNewline = this.currentToken();
    if (afterNewline.type === 13 /* EOF */) {
      this.emitError(localize("missingValue", "Missing value"), colonToken.startOffset, colonToken.endOffset, "missing-value");
      return this.makeEmptyScalar(colonToken.endOffset);
    }
    const nextIndent = this.currentIndent();
    if (nextIndent === baseIndent && this.peekPastIndent().type === 2 /* Dash */) {
      return this.parseValue(baseIndent) ?? this.makeEmptyScalar(colonToken.endOffset);
    }
    if (nextIndent <= baseIndent) {
      this.emitError(localize("missingValue", "Missing value"), colonToken.startOffset, colonToken.endOffset, "missing-value");
      return this.makeEmptyScalar(colonToken.endOffset);
    }
    return this.parseValue(baseIndent) ?? this.makeEmptyScalar(colonToken.endOffset);
  }
  // -- Block sequence --------------------------------------------------
  parseBlockSequence(baseIndent) {
    const items = [];
    const startOffset = this.currentToken().startOffset;
    let endOffset = startOffset;
    let isFirstItem = true;
    while (this.currentToken().type !== 13 /* EOF */) {
      this.skipNewlinesAndComments();
      if (this.currentToken().type === 13 /* EOF */) {
        break;
      }
      let indent;
      if (isFirstItem && this.currentToken().type === 2 /* Dash */) {
        indent = this.currentToken().startOffset - this.getLineStart(this.currentToken().startOffset);
      } else {
        indent = this.currentIndent();
      }
      isFirstItem = false;
      if (indent < baseIndent) {
        break;
      }
      if (indent !== baseIndent) {
        if (indent > baseIndent) {
          this.emitError(
            localize("unexpectedIndentation", "Unexpected indentation (expected {0}, got {1})", baseIndent, indent),
            this.currentToken().startOffset,
            this.currentToken().endOffset,
            "unexpected-indentation"
          );
        } else {
          break;
        }
      }
      const contentToken = this.peekPastIndent();
      if (contentToken.type !== 2 /* Dash */) {
        break;
      }
      if (this.currentToken().type === 9 /* Indent */) {
        this.advance();
      }
      const dashToken = this.advance();
      const itemValue = this.parseSequenceItemValue(baseIndent, dashToken);
      items.push(itemValue);
      endOffset = itemValue.endOffset;
    }
    return { type: "sequence", items, style: "block", startOffset, endOffset };
  }
  parseSequenceItemValue(baseIndent, dashToken) {
    const next = this.currentToken();
    if (next.type === 10 /* Comment */) {
      this.advance();
    }
    if (next.type === 4 /* FlowMapStart */) {
      return this.parseFlowMap();
    }
    if (next.type === 6 /* FlowSeqStart */) {
      return this.parseFlowSeq();
    }
    if (next.type === 2 /* Dash */) {
      const nestedIndent = next.startOffset - this.getLineStart(next.startOffset);
      return this.parseBlockSequence(nestedIndent);
    }
    if (next.type === 0 /* Scalar */) {
      if (this.peek(1).type === 1 /* Colon */) {
        const itemIndent = next.startOffset - this.getLineStart(next.startOffset);
        return this.parseBlockMapping(itemIndent, true);
      }
      return this.parseScalar(baseIndent);
    }
    this.skipNewlinesAndComments();
    if (this.currentToken().type === 13 /* EOF */) {
      this.emitError(localize("missingSeqItemValue", "Missing sequence item value"), dashToken.startOffset, dashToken.endOffset, "missing-value");
      return this.makeEmptyScalar(dashToken.endOffset);
    }
    const nextIndent = this.currentIndent();
    if (nextIndent <= baseIndent) {
      this.emitError(localize("missingSeqItemValue", "Missing sequence item value"), dashToken.startOffset, dashToken.endOffset, "missing-value");
      return this.makeEmptyScalar(dashToken.endOffset);
    }
    return this.parseValue(baseIndent) ?? this.makeEmptyScalar(dashToken.endOffset);
  }
  /** Calculate the start of the line containing the given offset */
  getLineStart(offset) {
    let i = offset - 1;
    while (i >= 0 && this.input[i] !== "\n" && this.input[i] !== "\r") {
      i--;
    }
    return i + 1;
  }
  // -- Flow map --------------------------------------------------------
  parseFlowMap() {
    const startToken = this.advance();
    const properties = [];
    this.skipFlowWhitespace();
    while (this.currentToken().type !== 5 /* FlowMapEnd */ && this.currentToken().type !== 13 /* EOF */) {
      let key;
      if (this.currentToken().type === 0 /* Scalar */) {
        key = this.parseFlowScalar();
      } else {
        this.emitError(localize("expectedMappingKey", "Expected mapping key"), this.currentToken().startOffset, this.currentToken().endOffset, "expected-key");
        break;
      }
      this.skipFlowWhitespace();
      let value;
      if (this.currentToken().type === 1 /* Colon */) {
        this.advance();
        this.skipFlowWhitespace();
        value = this.parseFlowValue();
      } else {
        value = this.makeEmptyScalar(key.endOffset);
      }
      properties.push({ key, value });
      this.skipFlowWhitespace();
      if (this.currentToken().type === 3 /* Comma */) {
        this.advance();
        this.skipFlowWhitespace();
      }
    }
    const endToken = this.currentToken();
    if (endToken.type === 5 /* FlowMapEnd */) {
      this.advance();
    } else {
      this.emitError(localize("expectedFlowMapEnd", 'Expected "}"'), endToken.startOffset, endToken.endOffset, "expected-flow-map-end");
    }
    return {
      type: "map",
      properties,
      style: "flow",
      startOffset: startToken.startOffset,
      endOffset: endToken.type === 5 /* FlowMapEnd */ ? endToken.endOffset : endToken.startOffset
    };
  }
  // -- Flow sequence ---------------------------------------------------
  parseFlowSeq() {
    const startToken = this.advance();
    const items = [];
    this.skipFlowWhitespace();
    while (this.currentToken().type !== 7 /* FlowSeqEnd */ && this.currentToken().type !== 13 /* EOF */) {
      let item;
      if (this.currentToken().type === 4 /* FlowMapStart */) {
        item = this.parseFlowMap();
      } else if (this.currentToken().type === 6 /* FlowSeqStart */) {
        item = this.parseFlowSeq();
      } else if (this.currentToken().type === 0 /* Scalar */) {
        item = this.parseFlowScalar();
      } else {
        this.emitError(localize("unexpectedTokenInFlowSeq", "Unexpected token in flow sequence"), this.currentToken().startOffset, this.currentToken().endOffset, "unexpected-token");
        this.advance();
        continue;
      }
      items.push(item);
      this.skipFlowWhitespace();
      if (this.currentToken().type === 3 /* Comma */) {
        this.advance();
        this.skipFlowWhitespace();
      }
    }
    const endToken = this.currentToken();
    if (endToken.type === 7 /* FlowSeqEnd */) {
      this.advance();
    } else {
      this.emitError(localize("expectedFlowSeqEnd", 'Expected "]"'), endToken.startOffset, endToken.endOffset, "expected-flow-seq-end");
    }
    return {
      type: "sequence",
      items,
      style: "flow",
      startOffset: startToken.startOffset,
      endOffset: endToken.type === 7 /* FlowSeqEnd */ ? endToken.endOffset : endToken.startOffset
    };
  }
  /**
   * Parse a scalar inside a flow collection, handling multiline plain scalars.
   * In flow context, plain (unquoted) scalars can span multiple lines;
   * line breaks are folded into spaces.
   */
  parseFlowScalar() {
    const token = this.advance();
    if (token.format !== "none") {
      return this.scalarFromToken(token);
    }
    let value = token.value;
    let endOffset = token.endOffset;
    while (true) {
      let hasNewline = false;
      let p = this.pos;
      while (p < this.tokens.length) {
        const t = this.tokens[p];
        if (t.type === 8 /* Newline */) {
          hasNewline = true;
          p++;
        } else if (t.type === 9 /* Indent */ || t.type === 10 /* Comment */) {
          p++;
        } else {
          break;
        }
      }
      if (!hasNewline || p >= this.tokens.length) {
        break;
      }
      const nextToken = this.tokens[p];
      if (nextToken.type === 0 /* Scalar */ && nextToken.format === "none") {
        this.pos = p + 1;
        value += " " + nextToken.value;
        endOffset = nextToken.endOffset;
      } else {
        break;
      }
    }
    return {
      type: "scalar",
      value,
      rawValue: this.input.substring(token.startOffset, endOffset),
      startOffset: token.startOffset,
      endOffset,
      format: "none"
    };
  }
  /** Parse a value in flow context (used after colon in flow mappings/implicit mappings) */
  parseFlowValue() {
    if (this.currentToken().type === 4 /* FlowMapStart */) {
      return this.parseFlowMap();
    } else if (this.currentToken().type === 6 /* FlowSeqStart */) {
      return this.parseFlowSeq();
    } else if (this.currentToken().type === 0 /* Scalar */) {
      return this.parseFlowScalar();
    } else {
      return this.makeEmptyScalar(this.currentToken().startOffset);
    }
  }
  /** Skip whitespace, newlines, and comments inside flow collections */
  skipFlowWhitespace() {
    while (true) {
      const t = this.currentToken().type;
      if (t === 8 /* Newline */ || t === 9 /* Indent */ || t === 10 /* Comment */) {
        this.advance();
      } else {
        break;
      }
    }
  }
  scalarFromToken(token) {
    return {
      type: "scalar",
      value: token.value,
      rawValue: token.rawValue,
      startOffset: token.startOffset,
      endOffset: token.endOffset,
      format: token.format
    };
  }
  makeEmptyScalar(offset) {
    return {
      type: "scalar",
      value: "",
      rawValue: "",
      startOffset: offset,
      endOffset: offset,
      format: "none"
    };
  }
}
export {
  MarkdownNode,
  parse,
  parseCommaSeparatedList,
  parseFrontMatter
};
