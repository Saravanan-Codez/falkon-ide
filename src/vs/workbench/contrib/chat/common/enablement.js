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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { transaction } from "../../../../base/common/observable.js";
import { observableMemento } from "../../../../platform/observable/common/observableMemento.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
var ContributionEnablementState = /* @__PURE__ */ ((ContributionEnablementState2) => {
  ContributionEnablementState2[ContributionEnablementState2["DisabledProfile"] = 0] = "DisabledProfile";
  ContributionEnablementState2[ContributionEnablementState2["DisabledWorkspace"] = 1] = "DisabledWorkspace";
  ContributionEnablementState2[ContributionEnablementState2["EnabledProfile"] = 2] = "EnabledProfile";
  ContributionEnablementState2[ContributionEnablementState2["EnabledWorkspace"] = 3] = "EnabledWorkspace";
  return ContributionEnablementState2;
})(ContributionEnablementState || {});
function isContributionEnabled(state) {
  return state === 2 /* EnabledProfile */ || state === 3 /* EnabledWorkspace */;
}
function isContributionDisabled(state) {
  return !isContributionEnabled(state);
}
function mapToStorage(value) {
  return JSON.stringify([...value]);
}
function mapFromStorage(value) {
  const parsed = JSON.parse(value);
  return new Map(Array.isArray(parsed) ? parsed : []);
}
let EnablementModel = class extends Disposable {
  constructor(storageKey, storageService) {
    super();
    const mapMemento = observableMemento({
      key: storageKey,
      defaultValue: /* @__PURE__ */ new Map(),
      toStorage: mapToStorage,
      fromStorage: mapFromStorage
    });
    this._profileState = this._register(
      mapMemento(StorageScope.PROFILE, StorageTarget.MACHINE, storageService)
    );
    this._workspaceState = this._register(
      mapMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE, storageService)
    );
  }
  readEnabled(key, reader) {
    return this.readEnabledWithWorkspaceKey(key, key, reader);
  }
  readEnabledWithWorkspaceKey(profileKey, workspaceKey, reader) {
    const wsMap = this._workspaceState.read(reader);
    if (workspaceKey !== void 0 && wsMap.has(workspaceKey)) {
      return wsMap.get(workspaceKey) ? 3 /* EnabledWorkspace */ : 1 /* DisabledWorkspace */;
    }
    const profileMap = this._profileState.read(reader);
    if (profileMap.has(profileKey)) {
      return profileMap.get(profileKey) ? 2 /* EnabledProfile */ : 0 /* DisabledProfile */;
    }
    return 2 /* EnabledProfile */;
  }
  setEnabled(key, state, tx) {
    this.setEnabledWithWorkspaceKey(key, key, state, tx);
  }
  setEnabledWithWorkspaceKey(profileKey, workspaceKey, state, tx) {
    switch (state) {
      case 2 /* EnabledProfile */: {
        this._deleteFromMap(this._profileState, profileKey, tx);
        if (workspaceKey !== void 0) {
          this._deleteFromMap(this._workspaceState, workspaceKey, tx);
        }
        break;
      }
      case 0 /* DisabledProfile */: {
        this._setInMap(this._profileState, profileKey, false, tx);
        if (workspaceKey !== void 0) {
          this._deleteFromMap(this._workspaceState, workspaceKey, tx);
        }
        break;
      }
      case 3 /* EnabledWorkspace */: {
        if (workspaceKey === void 0) {
          throw new Error("Cannot enable a contribution for a workspace without a workspace key.");
        }
        this._setInMap(this._workspaceState, workspaceKey, true, tx);
        break;
      }
      case 1 /* DisabledWorkspace */: {
        if (workspaceKey === void 0) {
          throw new Error("Cannot disable a contribution for a workspace without a workspace key.");
        }
        this._setInMap(this._workspaceState, workspaceKey, false, tx);
        break;
      }
    }
  }
  remove(key) {
    this._deleteFromMap(this._profileState, key);
    this._deleteFromMap(this._workspaceState, key);
  }
  _setInMap(memento, key, value, tx) {
    const current = memento.get();
    if (current.get(key) === value) {
      return;
    }
    const next = new Map(current);
    next.set(key, value);
    memento.set(next, tx);
  }
  _deleteFromMap(memento, key, tx) {
    const current = memento.get();
    if (!current.has(key)) {
      return;
    }
    const next = new Map(current);
    next.delete(key);
    memento.set(next, tx);
  }
};
EnablementModel = __decorateClass([
  __decorateParam(1, IStorageService)
], EnablementModel);
class CollisionEnablementModel {
  constructor(_base, _collisionGroups) {
    this._base = _base;
    this._collisionGroups = _collisionGroups;
  }
  readEnabled(key, reader) {
    const baseState = this._base.readEnabled(key, reader);
    if (!isContributionEnabled(baseState)) {
      return baseState;
    }
    const group = this._collisionGroups.read(reader).get(key);
    if (!group) {
      return baseState;
    }
    for (const otherId of group) {
      if (otherId === key) {
        return baseState;
      }
      if (isContributionEnabled(this._base.readEnabled(otherId, reader))) {
        return 0 /* DisabledProfile */;
      }
    }
    return baseState;
  }
  setEnabled(key, state, tx) {
    const isEnabling = state === 2 /* EnabledProfile */ || state === 3 /* EnabledWorkspace */;
    const group = isEnabling ? this._collisionGroups.get().get(key) : void 0;
    if (!group) {
      this._base.setEnabled(key, state, tx);
      return;
    }
    const updateGroup = (innerTx) => {
      this._base.setEnabled(key, state, innerTx);
      for (const otherId of group) {
        if (otherId !== key) {
          this._base.setEnabled(otherId, 1 /* DisabledWorkspace */, innerTx);
        }
      }
    };
    if (tx) {
      updateGroup(tx);
    } else {
      transaction((innerTx) => updateGroup(innerTx));
    }
  }
  remove(key) {
    this._base.remove(key);
  }
}
export {
  CollisionEnablementModel,
  ContributionEnablementState,
  EnablementModel,
  isContributionDisabled,
  isContributionEnabled
};
