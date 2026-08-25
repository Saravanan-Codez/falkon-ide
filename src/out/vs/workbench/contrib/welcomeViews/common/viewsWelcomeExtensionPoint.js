import * as nls from "../../../../nls.js";
var ViewsWelcomeExtensionPointFields = /* @__PURE__ */ ((ViewsWelcomeExtensionPointFields2) => {
  ViewsWelcomeExtensionPointFields2["view"] = "view";
  ViewsWelcomeExtensionPointFields2["contents"] = "contents";
  ViewsWelcomeExtensionPointFields2["when"] = "when";
  ViewsWelcomeExtensionPointFields2["group"] = "group";
  ViewsWelcomeExtensionPointFields2["enablement"] = "enablement";
  return ViewsWelcomeExtensionPointFields2;
})(ViewsWelcomeExtensionPointFields || {});
const ViewIdentifierMap = {
  "explorer": "workbench.explorer.emptyView",
  "debug": "workbench.debug.welcome",
  "scm": "workbench.scm",
  "testing": "workbench.view.testing"
};
const viewsWelcomeExtensionPointSchema = Object.freeze({
  type: "array",
  description: nls.localize("contributes.viewsWelcome", "Contributed views welcome content. Welcome content will be rendered in tree based views whenever they have no meaningful content to display, ie. the File Explorer when no folder is open. Such content is useful as in-product documentation to drive users to use certain features before they are available. A good example would be a `Clone Repository` button in the File Explorer welcome view."),
  items: {
    type: "object",
    description: nls.localize("contributes.viewsWelcome.view", "Contributed welcome content for a specific view."),
    required: [
      "view" /* view */,
      "contents" /* contents */
    ],
    properties: {
      ["view" /* view */]: {
        anyOf: [
          {
            type: "string",
            description: nls.localize("contributes.viewsWelcome.view.view", "Target view identifier for this welcome content. Only tree based views are supported.")
          },
          {
            type: "string",
            description: nls.localize("contributes.viewsWelcome.view.view", "Target view identifier for this welcome content. Only tree based views are supported."),
            enum: Object.keys(ViewIdentifierMap)
          }
        ]
      },
      ["contents" /* contents */]: {
        type: "string",
        description: nls.localize("contributes.viewsWelcome.view.contents", "Welcome content to be displayed. The format of the contents is a subset of Markdown, with support for links only.")
      },
      ["when" /* when */]: {
        type: "string",
        description: nls.localize("contributes.viewsWelcome.view.when", "Condition when the welcome content should be displayed.")
      },
      ["group" /* group */]: {
        type: "string",
        description: nls.localize("contributes.viewsWelcome.view.group", "Group to which this welcome content belongs. Proposed API.")
      },
      ["enablement" /* enablement */]: {
        type: "string",
        description: nls.localize("contributes.viewsWelcome.view.enablement", "Condition when the welcome content buttons and command links should be enabled.")
      }
    }
  }
});
const viewsWelcomeExtensionPointDescriptor = {
  extensionPoint: "viewsWelcome",
  jsonSchema: viewsWelcomeExtensionPointSchema
};
export {
  ViewIdentifierMap,
  ViewsWelcomeExtensionPointFields,
  viewsWelcomeExtensionPointDescriptor
};
