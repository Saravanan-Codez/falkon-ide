import { assertNever } from "../../../../../base/common/assert.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { isUndefinedOrNull } from "../../../../../base/common/types.js";
function prefixError(e, prefix) {
  e.message = prefix + e.message;
  if (e.stack) {
    const nlIdx = e.stack.indexOf("\n");
    e.stack = nlIdx !== -1 ? `${e.name}: ${e.message}${e.stack.slice(nlIdx)}` : `${e.name}: ${e.message}`;
  }
}
function rethrowWithPathSegment(e, segment) {
  if (e instanceof Error) {
    const part = typeof segment === "number" ? `[${segment}]` : `.${segment}`;
    const needsSep = !e.message.startsWith("[") && !e.message.startsWith(".");
    prefixError(e, part + (needsSep ? ": " : ""));
  }
  throw e;
}
var TransformKind = /* @__PURE__ */ ((TransformKind2) => {
  TransformKind2[TransformKind2["Key"] = 0] = "Key";
  TransformKind2[TransformKind2["Primitive"] = 1] = "Primitive";
  TransformKind2[TransformKind2["Array"] = 2] = "Array";
  TransformKind2[TransformKind2["Object"] = 3] = "Object";
  return TransformKind2;
})(TransformKind || {});
function key(comparator) {
  return {
    kind: 0 /* Key */,
    extract: (from) => from,
    equals: comparator ?? ((a, b) => a === b)
  };
}
function value(comparator) {
  return {
    kind: 1 /* Primitive */,
    extract: (from) => {
      let value2 = from;
      if (!!value2 && typeof value2 === "object") {
        value2 = deepCloneWithFallback(value2);
      }
      return value2;
    },
    equals: comparator ?? ((a, b) => a === b)
  };
}
function array(schema) {
  return {
    kind: 2 /* Array */,
    itemSchema: schema,
    extract: (from) => from?.map((item, i) => {
      try {
        return schema.extract(item);
      } catch (e) {
        rethrowWithPathSegment(e, i);
      }
    })
  };
}
function object(schema, options) {
  const entries = Object.entries(schema).sort(([, a], [, b]) => a.kind - b.kind);
  return {
    kind: 3 /* Object */,
    children: entries,
    sealed: options?.sealed,
    extract: (from) => {
      if (isUndefinedOrNull(from)) {
        return from;
      }
      const result = /* @__PURE__ */ Object.create(null);
      for (const [key2, transform] of entries) {
        try {
          result[key2] = transform.extract(from);
        } catch (e) {
          rethrowWithPathSegment(e, key2);
        }
      }
      return result;
    }
  };
}
function t(getter, schema) {
  return {
    ...schema,
    extract: (from) => schema.extract(getter(from))
  };
}
function v(getter, comparator) {
  const inner = value(comparator);
  return {
    ...inner,
    extract: (from) => inner.extract(getter(from))
  };
}
var EntryKind = /* @__PURE__ */ ((EntryKind2) => {
  EntryKind2[EntryKind2["Initial"] = 0] = "Initial";
  EntryKind2[EntryKind2["Set"] = 1] = "Set";
  EntryKind2[EntryKind2["Push"] = 2] = "Push";
  EntryKind2[EntryKind2["Delete"] = 3] = "Delete";
  return EntryKind2;
})(EntryKind || {});
const LF = VSBuffer.fromString("\n");
const PERSIST_ENTRY_MAX_STRING_CHARS = 1 * 1024 * 1024;
const PERSIST_ENTRY_MAX_TOTAL_CHARS = 100 * 1024 * 1024;
const TRUNCATION_MARKER_PREFIX = "[VS Code: value truncated for persistence";
const TRUNCATION_MARKER_TOTAL = `${TRUNCATION_MARKER_PREFIX}; entry exceeded size budget]`;
function stringifyEntryWithFallback(entry) {
  try {
    return JSON.stringify(entry);
  } catch (e) {
    if (!(e instanceof RangeError)) {
      throw e;
    }
    return JSON.stringify(entry, makeTruncatingReplacer(PERSIST_ENTRY_MAX_STRING_CHARS, PERSIST_ENTRY_MAX_TOTAL_CHARS));
  }
}
function deepCloneWithFallback(value2) {
  return JSON.parse(stringifyEntryWithFallback(value2));
}
function makeTruncatingReplacer(maxStringChars, maxTotalChars) {
  let total = 0;
  return (_key, val) => {
    if (typeof val === "string") {
      let emitted;
      if (val.length > maxStringChars) {
        emitted = `${TRUNCATION_MARKER_PREFIX}; original ${val.length} chars]`;
      } else if (total + val.length + 2 > maxTotalChars) {
        emitted = TRUNCATION_MARKER_TOTAL;
      } else {
        total += val.length + 2;
        return val;
      }
      total += emitted.length + 2;
      return emitted;
    }
    return val;
  };
}
class ObjectMutationLog {
  constructor(_transform, _compactAfterEntries = 512) {
    this._transform = _transform;
    this._compactAfterEntries = _compactAfterEntries;
    this._entryCount = 0;
    this._hasPendingWrite = false;
    this._pendingEntryCount = 0;
  }
  /**
   * Creates an initial log file from the given object.
   */
  createInitial(current) {
    return this.createInitialFromSerialized(this._transform.extract(current));
  }
  /**
   * Creates an initial log file from the serialized object.
   *
   * Unlike {@link write}, this commits state immediately without requiring
   * {@link confirmWrite}. This is safe because the returned buffer contains
   * a self-contained `Initial` entry — if it fails to persist, no
   * incremental entries can be appended to a non-existent file.
   */
  createInitialFromSerialized(value2) {
    this._previous = value2;
    this._entryCount = 1;
    this._clearPending();
    const entry = { kind: 0 /* Initial */, v: value2 };
    return VSBuffer.fromString(stringifyEntryWithFallback(entry) + "\n");
  }
  /**
   * Reads and reconstructs the state from a log file.
   */
  read(content) {
    let state;
    let lineCount = 0;
    let start = 0;
    const len = content.byteLength;
    while (start < len) {
      let end = content.indexOf(LF, start);
      if (end === -1) {
        end = len;
      }
      if (end > start) {
        const line = content.slice(start, end);
        if (line.byteLength > 0) {
          lineCount++;
          const entry = JSON.parse(line.toString());
          switch (entry.kind) {
            case 0 /* Initial */:
              state = entry.v;
              break;
            case 1 /* Set */:
              if (state === void 0) {
                throw new Error("Log file is missing an initial entry");
              }
              this._applySet(state, entry.k, entry.v);
              break;
            case 2 /* Push */:
              if (state === void 0) {
                throw new Error("Log file is missing an initial entry");
              }
              this._applyPush(state, entry.k, entry.v, entry.i);
              break;
            case 3 /* Delete */:
              if (state === void 0) {
                throw new Error("Log file is missing an initial entry");
              }
              this._applySet(state, entry.k, void 0);
              break;
            default:
              assertNever(entry);
          }
        }
      }
      start = end + 1;
    }
    if (lineCount === 0) {
      throw new Error("Empty log file");
    }
    this._previous = state;
    this._entryCount = lineCount;
    this._clearPending();
    return state;
  }
  /**
   * Writes updates to the log. Returns the operation type and data to write.
   * The caller **must** invoke {@link confirmWrite} after the data is
   * successfully persisted to commit the internal state. Without confirmation,
   * the next write is computed against the last confirmed state, and will only
   * produce a full initial entry when no confirmed state exists, preventing
   * corrupted log files when a write fails.
   */
  write(current) {
    const currentValue = this._transform.extract(current);
    if (!this._previous || this._entryCount > this._compactAfterEntries) {
      this._hasPendingWrite = true;
      this._pendingPrevious = currentValue;
      this._pendingEntryCount = 1;
      const entry = { kind: 0 /* Initial */, v: currentValue };
      return { op: "replace", data: VSBuffer.fromString(stringifyEntryWithFallback(entry) + "\n") };
    }
    const entries = [];
    const path = [];
    try {
      this._diff(this._transform, path, this._previous, currentValue, entries);
    } catch (e) {
      if (e instanceof Error) {
        const pathStr = path.map((s) => typeof s === "number" ? `[${s}]` : `.${s}`).join("") || "<root>";
        prefixError(e, `error diffing at ${pathStr}: `);
      }
      throw e;
    }
    if (entries.length === 0) {
      this._clearPending();
      return { op: "append", data: VSBuffer.fromString("") };
    }
    this._hasPendingWrite = true;
    this._pendingEntryCount = this._entryCount + entries.length;
    this._pendingPrevious = currentValue;
    let data = "";
    for (const e of entries) {
      data += stringifyEntryWithFallback(e) + "\n";
    }
    return { op: "append", data: VSBuffer.fromString(data) };
  }
  /**
   * Commits the internal state after a successful write to disk.
   */
  confirmWrite() {
    if (this._hasPendingWrite) {
      this._previous = this._pendingPrevious;
      this._entryCount = this._pendingEntryCount;
      this._clearPending();
    }
  }
  _clearPending() {
    this._hasPendingWrite = false;
    this._pendingPrevious = void 0;
    this._pendingEntryCount = 0;
  }
  _applySet(state, path, value2) {
    if (path.length === 0) {
      return;
    }
    let current = state;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value2;
  }
  _applyPush(state, path, values, startIndex) {
    let current = state;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    const arrayKey = path[path.length - 1];
    const arr = current[arrayKey] || [];
    if (startIndex !== void 0) {
      arr.length = startIndex;
    }
    if (values && values.length > 0) {
      arr.push(...values);
    }
    current[arrayKey] = arr;
  }
  _diff(transform, path, prev, curr, entries) {
    if (transform.kind === 0 /* Key */ || transform.kind === 1 /* Primitive */) {
      if (!transform.equals(prev, curr)) {
        entries.push({ kind: 1 /* Set */, k: path.slice(), v: curr });
      }
    } else if (isUndefinedOrNull(prev) || isUndefinedOrNull(curr)) {
      if (prev !== curr) {
        if (curr === void 0) {
          entries.push({ kind: 3 /* Delete */, k: path.slice() });
        } else if (curr === null) {
          entries.push({ kind: 1 /* Set */, k: path.slice(), v: null });
        } else {
          entries.push({ kind: 1 /* Set */, k: path.slice(), v: curr });
        }
      }
    } else if (transform.kind === 2 /* Array */) {
      this._diffArray(transform, path, prev, curr, entries);
    } else if (transform.kind === 3 /* Object */) {
      this._diffObject(transform.children, path, prev, curr, entries, transform.sealed);
    } else {
      throw new Error(`Unknown transform kind ${JSON.stringify(transform)}`);
    }
  }
  _diffObject(children, path, prev, curr, entries, sealed) {
    const prevObj = prev;
    const currObj = curr;
    let i = 0;
    for (; i < children.length; i++) {
      const [key2, transform] = children[i];
      if (transform.kind !== 0 /* Key */) {
        break;
      }
      if (!transform.equals(prevObj?.[key2], currObj[key2])) {
        entries.push({ kind: 1 /* Set */, k: path.slice(), v: curr });
        return;
      }
    }
    if (sealed && sealed(prev, true) && sealed(curr, false)) {
      return;
    }
    for (; i < children.length; i++) {
      const [key2, transform] = children[i];
      path.push(key2);
      this._diff(transform, path, prevObj?.[key2], currObj[key2], entries);
      path.pop();
    }
  }
  _diffArray(transform, path, prev, curr, entries) {
    const prevArr = prev || [];
    const currArr = curr || [];
    const itemSchema = transform.itemSchema;
    const minLen = Math.min(prevArr.length, currArr.length);
    if (itemSchema.kind === 3 /* Object */) {
      const childEntries = itemSchema.children;
      for (let i = 0; i < minLen; i++) {
        const prevItem = prevArr[i];
        const currItem = currArr[i];
        if (this._hasKeyMismatch(childEntries, prevItem, currItem)) {
          const newItems = currArr.slice(i);
          entries.push({ kind: 2 /* Push */, k: path.slice(), v: newItems.length > 0 ? newItems : void 0, i });
          return;
        }
        path.push(i);
        this._diffObject(childEntries, path, prevItem, currItem, entries, itemSchema.sealed);
        path.pop();
      }
      if (currArr.length > prevArr.length) {
        entries.push({ kind: 2 /* Push */, k: path.slice(), v: currArr.slice(prevArr.length) });
      } else if (currArr.length < prevArr.length) {
        entries.push({ kind: 2 /* Push */, k: path.slice(), i: currArr.length });
      }
    } else {
      let firstMismatch = -1;
      for (let i = 0; i < minLen; i++) {
        if (!itemSchema.equals(prevArr[i], currArr[i])) {
          firstMismatch = i;
          break;
        }
      }
      if (firstMismatch === -1) {
        if (currArr.length > prevArr.length) {
          entries.push({ kind: 2 /* Push */, k: path.slice(), v: currArr.slice(prevArr.length) });
        } else if (currArr.length < prevArr.length) {
          entries.push({ kind: 2 /* Push */, k: path.slice(), i: currArr.length });
        }
      } else {
        const newItems = currArr.slice(firstMismatch);
        entries.push({ kind: 2 /* Push */, k: path.slice(), v: newItems.length > 0 ? newItems : void 0, i: firstMismatch });
      }
    }
  }
  _hasKeyMismatch(children, prev, curr) {
    const prevObj = prev;
    const currObj = curr;
    for (const [key2, transform] of children) {
      if (transform.kind !== 0 /* Key */) {
        break;
      }
      if (!transform.equals(prevObj?.[key2], currObj[key2])) {
        return true;
      }
    }
    return false;
  }
}
export {
  ObjectMutationLog,
  PERSIST_ENTRY_MAX_STRING_CHARS,
  PERSIST_ENTRY_MAX_TOTAL_CHARS,
  array,
  deepCloneWithFallback,
  key,
  makeTruncatingReplacer,
  object,
  stringifyEntryWithFallback,
  t,
  v,
  value
};
