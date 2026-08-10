import * as extensionsRegistry from "../../../services/extensions/common/extensionsRegistry.js";
import { terminalContributionsDescriptor } from "./terminal.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { URI } from "../../../../base/common/uri.js";
import { Emitter } from "../../../../base/common/event.js";
import { isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { isObject, isString } from "../../../../base/common/types.js";
const terminalsExtPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint(terminalContributionsDescriptor);
const ITerminalContributionService = createDecorator("terminalContributionsService");
class TerminalContributionService {
  constructor() {
    this._terminalProfiles = [];
    this._terminalCompletionProviders = [];
    this._onDidChangeTerminalCompletionProviders = new Emitter();
    this.onDidChangeTerminalCompletionProviders = this._onDidChangeTerminalCompletionProviders.event;
    terminalsExtPoint.setHandler((contributions) => {
      this._terminalProfiles = contributions.map((c) => {
        return c.value?.profiles?.filter((p) => hasValidTerminalIcon(p)).map((e) => {
          return { ...e, extensionIdentifier: c.description.identifier.value };
        }) || [];
      }).flat();
      this._terminalCompletionProviders = contributions.map((c) => {
        if (!isProposedApiEnabled(c.description, "terminalCompletionProvider")) {
          return [];
        }
        return c.value?.completionProviders?.map((p) => {
          return { ...p, extensionIdentifier: c.description.identifier.value };
        }) || [];
      }).flat();
      this._onDidChangeTerminalCompletionProviders.fire();
    });
  }
  get terminalProfiles() {
    return this._terminalProfiles;
  }
  get terminalCompletionProviders() {
    return this._terminalCompletionProviders;
  }
}
function hasValidTerminalIcon(profile) {
  function isValidDarkLightIcon(obj) {
    return isObject(obj) && "light" in obj && URI.isUri(obj.light) && "dark" in obj && URI.isUri(obj.dark);
  }
  return !profile.icon || (isString(profile.icon) || URI.isUri(profile.icon) || isValidDarkLightIcon(profile.icon));
}
export {
  ITerminalContributionService,
  TerminalContributionService
};
