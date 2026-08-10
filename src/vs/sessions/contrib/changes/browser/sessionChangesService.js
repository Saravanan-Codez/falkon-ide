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
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../../workbench/services/editor/common/editorService.js";
import { IAgentWorkbenchLayoutService } from "../../../browser/workbench.js";
import { SessionChangesEditorInput } from "./sessionChangesEditorInput.js";
const ISessionChangesService = createDecorator("sessionChangesService");
const CHANGES_MULTI_DIFF_SOURCE_SCHEME = "changes-multi-diff-source";
let SessionChangesService = class {
  constructor(editorService, instantiationService, layoutService) {
    this.editorService = editorService;
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
  }
  getChangesEditorResource(sessionResource) {
    return URI.from({
      scheme: CHANGES_MULTI_DIFF_SOURCE_SCHEME,
      query: JSON.stringify({ sessionResource: sessionResource.toString() })
    });
  }
  getSessionResource(editorResource) {
    if (editorResource.scheme !== CHANGES_MULTI_DIFF_SOURCE_SCHEME) {
      return void 0;
    }
    let fields;
    try {
      fields = JSON.parse(editorResource.query);
    } catch {
      return void 0;
    }
    if (typeof fields !== "object" || fields === null || typeof fields.sessionResource !== "string") {
      return void 0;
    }
    return URI.parse(fields.sessionResource);
  }
  async openChangesEditor(sessionResource, options, group) {
    const multiDiffSource = this.getChangesEditorResource(sessionResource);
    if (this.layoutService.isSinglePaneLayoutEnabled) {
      const input = this.instantiationService.createInstance(SessionChangesEditorInput, multiDiffSource);
      const pane2 = await this.editorService.openEditor(input, { ...options, pinned: true }, group);
      return pane2?.group;
    }
    const pane = await this.editorService.openEditor({
      multiDiffSource,
      label: localize("sessions.changes.title", "Session Changes"),
      options
    }, group);
    return pane?.group;
  }
};
SessionChangesService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IAgentWorkbenchLayoutService)
], SessionChangesService);
export {
  ISessionChangesService,
  SessionChangesService
};
