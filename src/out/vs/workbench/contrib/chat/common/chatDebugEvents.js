function debugEventMatchesText(event, term) {
  if (event.kind.toLowerCase().includes(term)) {
    return true;
  }
  switch (event.kind) {
    case "toolCall":
      return event.toolName.toLowerCase().includes(term) || (event.input?.toLowerCase().includes(term) ?? false) || (event.output?.toLowerCase().includes(term) ?? false);
    case "modelTurn":
      return (event.model?.toLowerCase().includes(term) ?? false) || (event.requestName?.toLowerCase().includes(term) ?? false);
    case "generic":
      return event.name.toLowerCase().includes(term) || (event.details?.toLowerCase().includes(term) ?? false) || (event.category?.toLowerCase().includes(term) ?? false);
    case "subagentInvocation":
      return event.agentName.toLowerCase().includes(term) || (event.description?.toLowerCase().includes(term) ?? false);
    case "userMessage":
    case "agentResponse":
      return event.message.toLowerCase().includes(term) || event.sections.some((s) => s.name.toLowerCase().includes(term) || s.content.toLowerCase().includes(term));
  }
}
const timestampTokenPattern = /\b(?:before|after):\d{4}(?:-\d{2}(?:-\d{2}(?:t\d{1,2}(?::\d{2}(?::\d{2})?)?)?)?)?(\b|$)/g;
function parseTimeToken(text, prefix) {
  const regex = new RegExp(`${prefix}:(\\d{4})(?:-(\\d{2})(?:-(\\d{2})(?:t(\\d{1,2})(?::(\\d{2})(?::(\\d{2}))?)?)?)?)?(?!\\w)`);
  const m = regex.exec(text);
  if (!m) {
    return void 0;
  }
  const year = parseInt(m[1], 10);
  const month = m[2] !== void 0 ? parseInt(m[2], 10) - 1 : void 0;
  const day = m[3] !== void 0 ? parseInt(m[3], 10) : void 0;
  const hour = m[4] !== void 0 ? parseInt(m[4], 10) : void 0;
  const minute = m[5] !== void 0 ? parseInt(m[5], 10) : void 0;
  const second = m[6] !== void 0 ? parseInt(m[6], 10) : void 0;
  if (prefix === "before") {
    if (second !== void 0) {
      return new Date(year, month, day, hour, minute, second, 999).getTime();
    } else if (minute !== void 0) {
      return new Date(year, month, day, hour, minute, 59, 999).getTime();
    } else if (hour !== void 0) {
      return new Date(year, month, day, hour, 59, 59, 999).getTime();
    } else if (day !== void 0) {
      return new Date(year, month, day, 23, 59, 59, 999).getTime();
    } else if (month !== void 0) {
      return new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    } else {
      return new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    }
  } else {
    return new Date(
      year,
      month ?? 0,
      day ?? 1,
      hour ?? 0,
      minute ?? 0,
      second ?? 0,
      0
    ).getTime();
  }
}
function stripTimestampTokens(text) {
  return text.replace(timestampTokenPattern, "").trim();
}
function filterDebugEventsByText(events, filterText) {
  const beforeTimestamp = parseTimeToken(filterText, "before");
  const afterTimestamp = parseTimeToken(filterText, "after");
  const textOnly = stripTimestampTokens(filterText);
  const terms = textOnly.split(/\s*,\s*/).filter((t) => t.length > 0);
  const includeTerms = terms.filter((t) => !t.startsWith("!")).map((t) => t.trim());
  const excludeTerms = terms.filter((t) => t.startsWith("!")).map((t) => t.slice(1).trim()).filter((t) => t.length > 0);
  return events.filter((e) => {
    const time = e.created.getTime();
    if (beforeTimestamp !== void 0 && time > beforeTimestamp) {
      return false;
    }
    if (afterTimestamp !== void 0 && time < afterTimestamp) {
      return false;
    }
    if (excludeTerms.some((term) => debugEventMatchesText(e, term))) {
      return false;
    }
    if (includeTerms.length > 0) {
      return includeTerms.some((term) => debugEventMatchesText(e, term));
    }
    return true;
  });
}
function filterDebugEvents(events, options) {
  let result = events;
  if (options.kind) {
    result = result.filter((e) => e.kind === options.kind);
  }
  if (options.filter) {
    result = filterDebugEventsByText(result, options.filter);
  }
  if (options.limit !== void 0 && options.limit > 0 && result.length > options.limit) {
    result = result.slice(result.length - options.limit);
  }
  return result;
}
export {
  debugEventMatchesText,
  filterDebugEvents,
  filterDebugEventsByText,
  parseTimeToken,
  stripTimestampTokens
};
