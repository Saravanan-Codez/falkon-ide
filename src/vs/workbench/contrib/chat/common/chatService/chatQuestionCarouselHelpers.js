function getOptionsWithDefaultsFirst(question) {
  const options = question.options ?? [];
  const orderedOptions = options.map((option, index) => ({ option, originalIndex: index }));
  const defaultOptionIds = Array.isArray(question.defaultValue) ? question.defaultValue : typeof question.defaultValue === "string" ? [question.defaultValue] : [];
  if (defaultOptionIds.length === 0) {
    return orderedOptions;
  }
  const defaultIds = new Set(defaultOptionIds);
  const defaults = [];
  const nonDefaults = [];
  for (const item of orderedOptions) {
    if (defaultIds.has(item.option.id)) {
      defaults.push(item);
    } else {
      nonDefaults.push(item);
    }
  }
  return [...defaults, ...nonDefaults];
}
function getDisplayedQuestionText(question) {
  return question.message ?? question.title;
}
function findQuestionValidationFailure(value, validation) {
  if (validation.minLength !== void 0 && value.length < validation.minLength) {
    return { kind: "minLength", limit: validation.minLength };
  }
  if (validation.maxLength !== void 0 && value.length > validation.maxLength) {
    return { kind: "maxLength", limit: validation.maxLength };
  }
  switch (validation.format) {
    case "email":
      if (!value.includes("@")) {
        return { kind: "email" };
      }
      break;
    case "uri":
      if (!URL.canParse(value)) {
        return { kind: "uri" };
      }
      break;
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(new Date(value).getTime())) {
        return { kind: "date" };
      }
      break;
    case "date-time":
      if (isNaN(new Date(value).getTime())) {
        return { kind: "dateTime" };
      }
      break;
  }
  if (validation.isInteger !== void 0 || validation.minimum !== void 0 || validation.maximum !== void 0) {
    const num = Number(value);
    if (isNaN(num)) {
      return { kind: "number" };
    }
    if (validation.isInteger && !Number.isInteger(num)) {
      return { kind: "integer" };
    }
    if (validation.minimum !== void 0 && num < validation.minimum) {
      return { kind: "minimum", limit: validation.minimum };
    }
    if (validation.maximum !== void 0 && num > validation.maximum) {
      return { kind: "maximum", limit: validation.maximum };
    }
  }
  return void 0;
}
export {
  findQuestionValidationFailure,
  getDisplayedQuestionText,
  getOptionsWithDefaultsFirst
};
