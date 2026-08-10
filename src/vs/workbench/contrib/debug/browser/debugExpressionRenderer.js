var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import * as dom from "../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { Expression, ExpressionContainer, Variable } from "../common/debugModel.js";
import { ReplEvaluationResult } from "../common/replModel.js";
import { splitExpressionOrScopeHighlights } from "./baseDebugView.js";
import { handleANSIOutput } from "./debugANSIHandling.js";
import { COPY_EVALUATE_PATH_ID, COPY_VALUE_ID } from "./debugCommands.js";
import { DebugLinkHoverBehavior, LinkDetector } from "./linkDetector.js";
const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
const booleanRegex = /^(true|false)$/i;
const stringRegex = /^(['"]).*\1$/;
var Cls = /* @__PURE__ */ ((Cls2) => {
  Cls2["Value"] = "value";
  Cls2["Unavailable"] = "unavailable";
  Cls2["Error"] = "error";
  Cls2["Changed"] = "changed";
  Cls2["Boolean"] = "boolean";
  Cls2["String"] = "string";
  Cls2["Number"] = "number";
  return Cls2;
})(Cls || {});
const allClasses = Object.keys({
  ["value" /* Value */]: 0,
  ["unavailable" /* Unavailable */]: 0,
  ["error" /* Error */]: 0,
  ["changed" /* Changed */]: 0,
  ["boolean" /* Boolean */]: 0,
  ["string" /* String */]: 0,
  ["number" /* Number */]: 0
});
let DebugExpressionRenderer = class {
  constructor(commandService, configurationService, instantiationService, hoverService) {
    this.commandService = commandService;
    this.hoverService = hoverService;
    this.linkDetector = instantiationService.createInstance(LinkDetector);
    this.displayType = observableConfigValue("debug.showVariableTypes", false, configurationService);
  }
  renderVariable(data, variable, options = {}) {
    const displayType = this.displayType.get();
    const highlights = splitExpressionOrScopeHighlights(variable, options.highlights || []);
    if (variable.available) {
      data.type.textContent = "";
      let text = variable.name;
      if (variable.value && typeof variable.name === "string") {
        if (variable.type && displayType) {
          text += ": ";
          data.type.textContent = variable.type + " =";
        } else {
          text += " =";
        }
      }
      data.label.set(text, highlights.name, variable.type && !displayType ? variable.type : variable.name);
      data.name.classList.toggle("virtual", variable.presentationHint?.kind === "virtual");
      data.name.classList.toggle("internal", variable.presentationHint?.visibility === "internal");
    } else if (variable.value && typeof variable.name === "string" && variable.name) {
      data.label.set(":");
    }
    data.expression.classList.toggle("lazy", !!variable.presentationHint?.lazy);
    const commands = [
      { id: COPY_VALUE_ID, args: [variable, [variable]] }
    ];
    if (variable.evaluateName) {
      commands.push({ id: COPY_EVALUATE_PATH_ID, args: [{ variable }] });
    }
    return this.renderValue(data.value, variable, {
      showChanged: options.showChanged,
      maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
      hover: { commands },
      highlights: highlights.value,
      colorize: true,
      session: variable.getSession()
    });
  }
  renderValue(container, expressionOrValue, options = {}) {
    const store = new DisposableStore();
    const supportsANSI = options.session?.rememberedCapabilities?.supportsANSIStyling ?? options.wasANSI ?? false;
    let value = typeof expressionOrValue === "string" ? expressionOrValue : expressionOrValue.value;
    for (const cls of allClasses) {
      container.classList.remove(cls);
    }
    container.classList.add("value" /* Value */);
    if (value === null || (expressionOrValue instanceof Expression || expressionOrValue instanceof Variable || expressionOrValue instanceof ReplEvaluationResult) && !expressionOrValue.available) {
      container.classList.add("unavailable" /* Unavailable */);
      if (value !== Expression.DEFAULT_VALUE) {
        container.classList.add("error" /* Error */);
      }
    } else {
      if (typeof expressionOrValue !== "string" && options.showChanged && expressionOrValue.valueChanged && value !== Expression.DEFAULT_VALUE) {
        container.classList.add("changed" /* Changed */);
        expressionOrValue.valueChanged = false;
      }
      if (options.colorize && typeof expressionOrValue !== "string") {
        if (expressionOrValue.type === "number" || expressionOrValue.type === "boolean" || expressionOrValue.type === "string") {
          container.classList.add(expressionOrValue.type);
        } else if (!isNaN(+value)) {
          container.classList.add("number" /* Number */);
        } else if (booleanRegex.test(value)) {
          container.classList.add("boolean" /* Boolean */);
        } else if (stringRegex.test(value)) {
          container.classList.add("string" /* String */);
        }
      }
    }
    if (options.maxValueLength && value && value.length > options.maxValueLength) {
      value = value.substring(0, options.maxValueLength) + "...";
    }
    if (!value) {
      value = "";
    }
    const session = options.session ?? (expressionOrValue instanceof ExpressionContainer ? expressionOrValue.getSession() : void 0);
    const hoverBehavior = options.hover === false ? { type: DebugLinkHoverBehavior.Rich, store } : { type: DebugLinkHoverBehavior.None, store };
    dom.clearNode(container);
    const locationReference = options.locationReference ?? (expressionOrValue instanceof ExpressionContainer && expressionOrValue.valueLocationReference);
    let linkDetector = this.linkDetector;
    if (locationReference && session) {
      linkDetector = this.linkDetector.makeReferencedLinkDetector(locationReference, session);
    }
    if (supportsANSI) {
      container.appendChild(handleANSIOutput(value, linkDetector, session ? session.root : void 0, options.highlights, hoverBehavior));
    } else {
      container.appendChild(linkDetector.linkify(value, hoverBehavior, false, session?.root, true, options.highlights));
    }
    if (options.hover !== false) {
      const { commands = [] } = options.hover || {};
      store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), container, () => {
        const container2 = dom.$("div");
        const markdownHoverElement = dom.$("div.hover-row");
        const hoverContentsElement = dom.append(markdownHoverElement, dom.$("div.hover-contents"));
        const hoverContentsPre = dom.append(hoverContentsElement, dom.$("pre.debug-var-hover-pre"));
        if (supportsANSI) {
          hoverContentsPre.appendChild(handleANSIOutput(value, this.linkDetector, session ? session.root : void 0, options.highlights, hoverBehavior));
        } else {
          hoverContentsPre.textContent = value;
        }
        container2.appendChild(markdownHoverElement);
        return container2;
      }, {
        actions: commands.map(({ id, args }) => {
          const description = CommandsRegistry.getCommand(id)?.metadata?.description;
          return {
            label: typeof description === "string" ? description : description ? description.value : id,
            commandId: id,
            run: () => this.commandService.executeCommand(id, ...args)
          };
        })
      }));
    }
    return store;
  }
};
DebugExpressionRenderer = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IHoverService)
], DebugExpressionRenderer);
export {
  DebugExpressionRenderer
};
