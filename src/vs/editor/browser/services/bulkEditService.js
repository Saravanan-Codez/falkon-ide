import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { URI } from "../../../base/common/uri.js";
import { isObject } from "../../../base/common/types.js";
const IBulkEditService = createDecorator("IWorkspaceEditService");
class ResourceEdit {
  constructor(metadata) {
    this.metadata = metadata;
  }
  static convert(edit) {
    return edit.edits.map((edit2) => {
      if (ResourceTextEdit.is(edit2)) {
        return ResourceTextEdit.lift(edit2);
      }
      if (ResourceFileEdit.is(edit2)) {
        return ResourceFileEdit.lift(edit2);
      }
      throw new Error("Unsupported edit");
    });
  }
}
class ResourceTextEdit extends ResourceEdit {
  constructor(resource, textEdit, versionId = void 0, metadata) {
    super(metadata);
    this.resource = resource;
    this.textEdit = textEdit;
    this.versionId = versionId;
  }
  static is(candidate) {
    if (candidate instanceof ResourceTextEdit) {
      return true;
    }
    return isObject(candidate) && URI.isUri(candidate.resource) && isObject(candidate.textEdit);
  }
  static lift(edit) {
    if (edit instanceof ResourceTextEdit) {
      return edit;
    } else {
      return new ResourceTextEdit(edit.resource, edit.textEdit, edit.versionId, edit.metadata);
    }
  }
}
class ResourceFileEdit extends ResourceEdit {
  constructor(oldResource, newResource, options = {}, metadata) {
    super(metadata);
    this.oldResource = oldResource;
    this.newResource = newResource;
    this.options = options;
  }
  static is(candidate) {
    if (candidate instanceof ResourceFileEdit) {
      return true;
    } else {
      return isObject(candidate) && (Boolean(candidate.newResource) || Boolean(candidate.oldResource));
    }
  }
  static lift(edit) {
    if (edit instanceof ResourceFileEdit) {
      return edit;
    } else {
      return new ResourceFileEdit(edit.oldResource, edit.newResource, edit.options, edit.metadata);
    }
  }
}
export {
  IBulkEditService,
  ResourceEdit,
  ResourceFileEdit,
  ResourceTextEdit
};
