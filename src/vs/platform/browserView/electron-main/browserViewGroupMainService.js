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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { Event } from "../../../base/common/event.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { BrowserViewGroup } from "./browserViewGroup.js";
const IBrowserViewGroupMainService = createDecorator("browserViewGroupMainService");
let BrowserViewGroupMainService = class extends Disposable {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.groups = this._register(new DisposableMap());
  }
  async createGroup(owner) {
    const id = generateUuid();
    const group = this.instantiationService.createInstance(BrowserViewGroup, id, owner);
    this.groups.set(id, group);
    Event.once(group.onDidDestroy)(() => {
      this.groups.deleteAndLeak(id);
    });
    return id;
  }
  async destroyGroup(groupId) {
    this.groups.deleteAndDispose(groupId);
  }
  async addViewToGroup(groupId, viewId) {
    return this._getGroup(groupId).addView(viewId);
  }
  async removeViewFromGroup(groupId, viewId) {
    return this._getGroup(groupId).removeView(viewId);
  }
  async sendCDPMessage(groupId, message) {
    return this._getGroup(groupId).debugger.sendMessage(message);
  }
  onDynamicDidAddView(groupId) {
    return this._getGroup(groupId).onDidAddView;
  }
  onDynamicDidRemoveView(groupId) {
    return this._getGroup(groupId).onDidRemoveView;
  }
  onDynamicDidDestroy(groupId) {
    return this._getGroup(groupId).onDidDestroy;
  }
  onDynamicCDPMessage(groupId) {
    return this._getGroup(groupId).debugger.onMessage;
  }
  /**
   * Get a group or throw if not found.
   */
  _getGroup(groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Browser view group ${groupId} not found`);
    }
    return group;
  }
};
BrowserViewGroupMainService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], BrowserViewGroupMainService);
export {
  BrowserViewGroupMainService,
  IBrowserViewGroupMainService
};
