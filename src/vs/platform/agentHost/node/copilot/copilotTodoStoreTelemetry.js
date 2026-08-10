import { AgentSession } from "../../common/agentService.js";
import { isSubagentSession } from "../../common/state/sessionState.js";
function reportCopilotTodoStoreOperation(telemetryService, session, toolCallId, toolName, toolInput) {
  const operation = getCopilotTodoStoreOperationData(toolName, toolInput);
  if (!operation) {
    return;
  }
  telemetryService.publicLog2("todoStoreOperation", {
    ...operation,
    toolCallId,
    provider: session.scheme,
    agentSessionId: AgentSession.id(session),
    isSubagentSession: isSubagentSession(session)
  });
}
function getCopilotTodoStoreOperationData(toolName, toolInput) {
  if (toolName !== "sql") {
    return void 0;
  }
  const query = toolInput?.query;
  if (typeof query !== "string") {
    return void 0;
  }
  const tokens = tokenizeSql(query);
  const readTargets = /* @__PURE__ */ new Set();
  const writeTargets = /* @__PURE__ */ new Set();
  const deleteFromIndexes = /* @__PURE__ */ new Set();
  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i].value) {
      case "insert":
      case "replace": {
        const intoIndex = findToken(tokens, i + 1, "into", ["or", "rollback", "abort", "replace", "fail", "ignore"]);
        addTodoStoreTarget(writeTargets, readTableIdentifier(tokens, intoIndex + 1));
        break;
      }
      case "update":
        addTodoStoreTarget(writeTargets, readTableIdentifier(tokens, i + 1, ["or", "rollback", "abort", "replace", "fail", "ignore"]));
        break;
      case "delete": {
        const fromIndex = findToken(tokens, i + 1, "from");
        deleteFromIndexes.add(fromIndex);
        addTodoStoreTarget(writeTargets, readTableIdentifier(tokens, fromIndex + 1));
        break;
      }
      case "create":
      case "drop":
      case "alter": {
        const tableIndex = findToken(tokens, i + 1, "table", ["temp", "temporary"]);
        addTodoStoreTarget(writeTargets, readTableIdentifier(tokens, tableIndex + 1, ["if", "not", "exists"]));
        break;
      }
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === "from" && !deleteFromIndexes.has(i)) {
      addFromClauseTargets(tokens, i + 1, readTargets);
    } else if (tokens[i].value === "join") {
      addTodoStoreTarget(readTargets, readTableIdentifier(tokens, i + 1));
    }
  }
  if (readTargets.size === 0 && writeTargets.size === 0) {
    return void 0;
  }
  const referencesTodos = readTargets.has("todos") || writeTargets.has("todos");
  const referencesTodoDeps = readTargets.has("todo_deps") || writeTargets.has("todo_deps");
  return {
    operation: readTargets.size > 0 && writeTargets.size > 0 ? "mixed" : writeTargets.size > 0 ? "write" : "read",
    target: referencesTodos && referencesTodoDeps ? "both" : referencesTodoDeps ? "todo_deps" : "todos"
  };
}
function tokenizeSql(query) {
  const tokens = [];
  for (let i = 0; i < query.length; ) {
    const char = query[i];
    const next = query[i + 1];
    if (/\s/.test(char)) {
      i++;
    } else if (char === "-" && next === "-") {
      i = skipUntil(query, i + 2, "\n");
    } else if (char === "/" && next === "*") {
      i = skipUntil(query, i + 2, "*/");
    } else if (char === "'") {
      i = skipQuoted(query, i + 1, "'", "'");
    } else if (char === '"' || char === "`") {
      const end = skipQuoted(query, i + 1, char, char);
      tokens.push({ value: query.slice(i + 1, end - 1).replaceAll(char + char, char).toLowerCase(), kind: "identifier" });
      i = end;
    } else if (char === "[") {
      const end = skipQuoted(query, i + 1, "]", "]");
      tokens.push({ value: query.slice(i + 1, end - 1).replaceAll("]]", "]").toLowerCase(), kind: "identifier" });
      i = end;
    } else if (/[a-z_$]/i.test(char)) {
      let end = i + 1;
      while (end < query.length && /[\w$]/.test(query[end])) {
        end++;
      }
      tokens.push({ value: query.slice(i, end).toLowerCase(), kind: "identifier" });
      i = end;
    } else {
      if (char === "." || char === "," || char === "(" || char === ")" || char === ";") {
        tokens.push({ value: char, kind: "punctuation" });
      }
      i++;
    }
  }
  return tokens;
}
function skipUntil(query, start, terminator) {
  const index = query.indexOf(terminator, start);
  return index === -1 ? query.length : index + terminator.length;
}
function skipQuoted(query, start, terminator, escape) {
  for (let i = start; i < query.length; i++) {
    if (query[i] !== terminator) {
      continue;
    }
    if (query[i + 1] === escape) {
      i++;
    } else {
      return i + 1;
    }
  }
  return query.length;
}
function findToken(tokens, start, value, skippedValues = []) {
  for (let i = start; i < tokens.length && tokens[i].value !== ";"; i++) {
    if (tokens[i].value === value) {
      return i;
    }
    if (!skippedValues.includes(tokens[i].value)) {
      break;
    }
  }
  return -1;
}
function readTableIdentifier(tokens, start, skippedValues = []) {
  let index = start;
  while (index < tokens.length && skippedValues.includes(tokens[index].value)) {
    index++;
  }
  if (tokens[index]?.kind !== "identifier") {
    return void 0;
  }
  let table = tokens[index].value;
  while (tokens[index + 1]?.value === "." && tokens[index + 2]?.kind === "identifier") {
    table = tokens[index + 2].value;
    index += 2;
  }
  return table;
}
function addFromClauseTargets(tokens, start, targets) {
  const terminators = /* @__PURE__ */ new Set(["where", "group", "order", "having", "limit", "union", "intersect", "except", "returning", "set", "values", ";"]);
  let expectsTable = true;
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    const value = tokens[i].value;
    if (value === "(") {
      if (depth === 0 && expectsTable) {
        expectsTable = false;
      }
      depth++;
    } else if (value === ")") {
      if (depth === 0) {
        return;
      }
      depth--;
    } else if (depth === 0 && terminators.has(value)) {
      return;
    } else if (depth === 0 && (value === "," || value === "join")) {
      expectsTable = true;
    } else if (depth === 0 && expectsTable && tokens[i].kind === "identifier") {
      addTodoStoreTarget(targets, readTableIdentifier(tokens, i));
      expectsTable = false;
    }
  }
}
function addTodoStoreTarget(targets, identifier) {
  if (identifier === "todos" || identifier === "todo_deps") {
    targets.add(identifier);
  }
}
export {
  getCopilotTodoStoreOperationData,
  reportCopilotTodoStoreOperation
};
