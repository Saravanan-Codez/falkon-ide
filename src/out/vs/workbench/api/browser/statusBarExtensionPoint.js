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
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../services/extensions/common/extensionsRegistry.js";
import { IStatusbarService, StatusbarAlignment } from "../../services/statusbar/browser/statusbar.js";
import { isAccessibilityInformation } from "../../../platform/accessibility/common/accessibility.js";
import { isMarkdownString } from "../../../base/common/htmlContent.js";
import { getCodiconAriaLabel } from "../../../base/common/iconLabels.js";
import { hash } from "../../../base/common/hash.js";
import { Emitter } from "../../../base/common/event.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { Iterable } from "../../../base/common/iterator.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { asStatusBarItemIdentifier } from "../common/extHostTypes.js";
import { STATUS_BAR_ERROR_ITEM_BACKGROUND, STATUS_BAR_WARNING_ITEM_BACKGROUND } from "../../common/theme.js";
const IExtensionStatusBarItemService = createDecorator("IExtensionStatusBarItemService");
var StatusBarUpdateKind = /* @__PURE__ */ ((StatusBarUpdateKind2) => {
  StatusBarUpdateKind2[StatusBarUpdateKind2["DidDefine"] = 0] = "DidDefine";
  StatusBarUpdateKind2[StatusBarUpdateKind2["DidUpdate"] = 1] = "DidUpdate";
  return StatusBarUpdateKind2;
})(StatusBarUpdateKind || {});
let ExtensionStatusBarItemService = class {
  constructor(_statusbarService) {
    this._statusbarService = _statusbarService;
    this._entries = /* @__PURE__ */ new Map();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  dispose() {
    this._entries.forEach((entry) => entry.accessor.dispose());
    this._entries.clear();
    this._onDidChange.dispose();
  }
  setOrUpdateEntry(entryId, id, extensionId, name, text, tooltip, command, color, backgroundColor, alignLeft, priority, accessibilityInformation) {
    let ariaLabel;
    let role = void 0;
    if (accessibilityInformation) {
      ariaLabel = accessibilityInformation.label;
      role = accessibilityInformation.role;
    } else {
      ariaLabel = getCodiconAriaLabel(text);
      if (typeof tooltip === "string" || isMarkdownString(tooltip)) {
        const tooltipString = typeof tooltip === "string" ? tooltip : tooltip.value;
        ariaLabel += `, ${tooltipString}`;
      }
    }
    let kind = void 0;
    switch (backgroundColor?.id) {
      case STATUS_BAR_ERROR_ITEM_BACKGROUND:
      case STATUS_BAR_WARNING_ITEM_BACKGROUND:
        kind = backgroundColor.id === STATUS_BAR_ERROR_ITEM_BACKGROUND ? "error" : "warning";
        color = void 0;
        backgroundColor = void 0;
    }
    const entry = { name, text, tooltip, command, color, backgroundColor, ariaLabel, role, kind, extensionId };
    if (typeof priority === "undefined") {
      priority = 0;
    }
    let alignment = alignLeft ? StatusbarAlignment.LEFT : StatusbarAlignment.RIGHT;
    const existingEntry = this._entries.get(entryId);
    if (existingEntry) {
      alignment = existingEntry.alignment;
      priority = existingEntry.priority;
    }
    if (!existingEntry) {
      let entryPriority;
      if (typeof extensionId === "string") {
        entryPriority = { primary: priority, secondary: hash(extensionId) };
      } else {
        entryPriority = priority;
      }
      const accessor = this._statusbarService.addEntry(entry, id, alignment, entryPriority);
      this._entries.set(entryId, {
        accessor,
        entry,
        alignment,
        priority,
        disposable: toDisposable(() => {
          accessor.dispose();
          this._entries.delete(entryId);
          this._onDidChange.fire({ removed: entryId });
        })
      });
      this._onDidChange.fire({ added: [entryId, { entry, alignment, priority }] });
      return 0 /* DidDefine */;
    } else {
      existingEntry.accessor.update(entry);
      existingEntry.entry = entry;
      return 1 /* DidUpdate */;
    }
  }
  unsetEntry(entryId) {
    this._entries.get(entryId)?.disposable.dispose();
    this._entries.delete(entryId);
  }
  getEntries() {
    return this._entries.entries();
  }
};
ExtensionStatusBarItemService = __decorateClass([
  __decorateParam(0, IStatusbarService)
], ExtensionStatusBarItemService);
registerSingleton(IExtensionStatusBarItemService, ExtensionStatusBarItemService, InstantiationType.Delayed);
function isUserFriendlyStatusItemEntry(candidate) {
  const obj = candidate;
  return typeof obj.id === "string" && obj.id.length > 0 && typeof obj.name === "string" && typeof obj.text === "string" && (obj.alignment === "left" || obj.alignment === "right") && (obj.command === void 0 || typeof obj.command === "string") && (obj.tooltip === void 0 || typeof obj.tooltip === "string") && (obj.priority === void 0 || typeof obj.priority === "number") && (obj.accessibilityInformation === void 0 || isAccessibilityInformation(obj.accessibilityInformation));
}
const statusBarItemSchema = {
  type: "object",
  required: ["id", "text", "alignment", "name"],
  properties: {
    id: {
      type: "string",
      markdownDescription: localize("id", "The identifier of the status bar entry. Must be unique within the extension. The same value must be used when calling the `vscode.window.createStatusBarItem(id, ...)`-API")
    },
    name: {
      type: "string",
      description: localize("name", "The name of the entry, like 'Python Language Indicator', 'Git Status' etc. Try to keep the length of the name short, yet descriptive enough that users can understand what the status bar item is about.")
    },
    text: {
      type: "string",
      description: localize("text", "The text to show for the entry. You can embed icons in the text by leveraging the `$(<name>)`-syntax, like 'Hello {0}!'", "$(globe)")
    },
    tooltip: {
      type: "string",
      description: localize("tooltip", "The tooltip text for the entry.")
    },
    command: {
      type: "string",
      description: localize("command", "The command to execute when the status bar entry is clicked.")
    },
    alignment: {
      type: "string",
      enum: ["left", "right"],
      description: localize("alignment", "The alignment of the status bar entry.")
    },
    priority: {
      type: "number",
      description: localize("priority", "The priority of the status bar entry. Higher value means the item should be shown more to the left.")
    },
    accessibilityInformation: {
      type: "object",
      description: localize("accessibilityInformation", "Defines the role and aria label to be used when the status bar entry is focused."),
      required: ["label"],
      properties: {
        role: {
          type: "string",
          description: localize("accessibilityInformation.role", "The role of the status bar entry which defines how a screen reader interacts with it. More about aria roles can be found here https://w3c.github.io/aria/#widget_roles")
        },
        label: {
          type: "string",
          description: localize("accessibilityInformation.label", "The aria label of the status bar entry. Defaults to the entry's text.")
        }
      }
    }
  }
};
const statusBarItemsSchema = {
  description: localize("vscode.extension.contributes.statusBarItems", "Contributes items to the status bar."),
  oneOf: [
    statusBarItemSchema,
    {
      type: "array",
      items: statusBarItemSchema
    }
  ]
};
const statusBarItemsExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "statusBarItems",
  jsonSchema: statusBarItemsSchema
});
let StatusBarItemsExtensionPoint = class {
  constructor(statusBarItemsService) {
    const contributions = new DisposableStore();
    statusBarItemsExtensionPoint.setHandler((extensions) => {
      contributions.clear();
      for (const entry of extensions) {
        if (!isProposedApiEnabled(entry.description, "contribStatusBarItems")) {
          entry.collector.error(`The ${statusBarItemsExtensionPoint.name} is proposed API`);
          continue;
        }
        const { value, collector } = entry;
        for (const candidate of Iterable.wrap(value)) {
          if (!isUserFriendlyStatusItemEntry(candidate)) {
            collector.error(localize("invalid", "Invalid status bar item contribution."));
            continue;
          }
          const fullItemId = asStatusBarItemIdentifier(entry.description.identifier, candidate.id);
          const kind = statusBarItemsService.setOrUpdateEntry(
            fullItemId,
            fullItemId,
            ExtensionIdentifier.toKey(entry.description.identifier),
            candidate.name ?? entry.description.displayName ?? entry.description.name,
            candidate.text,
            candidate.tooltip,
            candidate.command ? { id: candidate.command, title: candidate.name } : void 0,
            void 0,
            void 0,
            candidate.alignment === "left",
            candidate.priority,
            candidate.accessibilityInformation
          );
          if (kind === 0 /* DidDefine */) {
            contributions.add(toDisposable(() => statusBarItemsService.unsetEntry(fullItemId)));
          }
        }
      }
    });
  }
};
StatusBarItemsExtensionPoint = __decorateClass([
  __decorateParam(0, IExtensionStatusBarItemService)
], StatusBarItemsExtensionPoint);
export {
  IExtensionStatusBarItemService,
  StatusBarItemsExtensionPoint,
  StatusBarUpdateKind
};
