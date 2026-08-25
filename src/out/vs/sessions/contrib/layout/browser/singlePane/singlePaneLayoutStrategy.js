import { Sequencer } from "../../../../../base/common/async.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
class SinglePaneLayoutStrategy extends Disposable {
  constructor(_ctx) {
    super();
    this._ctx = _ctx;
  }
}
class SinglePaneDockedTabsCoordinator extends Disposable {
  constructor(_sessionChangesService) {
    super();
    this._sessionChangesService = _sessionChangesService;
    this.sequencer = new Sequencer();
  }
  getChangesEditorResource(editor) {
    const resource = editor.resource;
    return resource && this._sessionChangesService.getSessionResource(resource) ? resource : void 0;
  }
}
export {
  SinglePaneDockedTabsCoordinator,
  SinglePaneLayoutStrategy
};
