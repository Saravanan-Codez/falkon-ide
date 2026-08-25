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
import * as dom from "../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../../nls.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { getCodeCitationsMessage } from "../../../common/model/chatModel.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
let ChatCodeCitationContentPart = class extends Disposable {
  constructor(citations, context, editorService, telemetryService) {
    super();
    this.editorService = editorService;
    this.telemetryService = telemetryService;
    const label = getCodeCitationsMessage(citations.citations);
    const elements = dom.h(".chat-code-citation-message@root", [
      dom.h("span.chat-code-citation-label@label"),
      dom.h(".chat-code-citation-button-container@button")
    ]);
    elements.label.textContent = label + " - ";
    const button = this._register(new Button(elements.button, {
      buttonBackground: void 0,
      buttonBorder: void 0,
      buttonForeground: void 0,
      buttonHoverBackground: void 0,
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0
    }));
    button.label = localize("viewMatches", "View matches");
    this._register(button.onDidClick(() => {
      const citationText = `# Code Citations

` + citations.citations.map((c) => `## License: ${c.license}
${c.value.toString()}

\`\`\`
${c.snippet}
\`\`\`

`).join("\n");
      this.editorService.openEditor({ resource: void 0, contents: citationText, languageId: "markdown" });
      this.telemetryService.publicLog2("openedChatCodeCitations");
    }));
    this.domNode = elements.root;
  }
  hasSameContent(other, followingContent, element) {
    return other.kind === "codeCitations";
  }
};
ChatCodeCitationContentPart = __decorateClass([
  __decorateParam(2, IEditorService),
  __decorateParam(3, ITelemetryService)
], ChatCodeCitationContentPart);
export {
  ChatCodeCitationContentPart
};
