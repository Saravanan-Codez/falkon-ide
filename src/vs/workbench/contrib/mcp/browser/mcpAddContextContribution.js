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
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IChatContextPickService } from "../../chat/browser/attachments/chatContextPickService.js";
import { IMcpService, McpCapability } from "../common/mcpTypes.js";
import { McpResourcePickHelper } from "./mcpResourceQuickAccess.js";
let McpAddContextContribution = class extends Disposable {
  constructor(_chatContextPickService, _instantiationService, mcpService) {
    super();
    this._chatContextPickService = _chatContextPickService;
    this._instantiationService = _instantiationService;
    this._addContextMenu = this._register(new MutableDisposable());
    const hasServersWithResources = derived((reader) => {
      let enabled = false;
      for (const server of mcpService.servers.read(reader)) {
        const cap = server.capabilities.read(void 0);
        if (cap === void 0) {
          enabled = true;
        } else if (cap & McpCapability.Resources) {
          enabled = true;
          break;
        }
      }
      return enabled;
    });
    this._register(autorun((reader) => {
      const enabled = hasServersWithResources.read(reader);
      if (enabled && !this._addContextMenu.value) {
        this._registerAddContextMenu();
      } else {
        this._addContextMenu.clear();
      }
    }));
  }
  _registerAddContextMenu() {
    this._addContextMenu.value = this._chatContextPickService.registerChatContextItem({
      type: "pickerPick",
      label: localize("mcp.addContext", "MCP Resources..."),
      icon: Codicon.mcp,
      isEnabled(widget) {
        return !!widget.attachmentCapabilities.supportsMCPAttachments;
      },
      asPicker: () => {
        const helper = this._instantiationService.createInstance(McpResourcePickHelper);
        return {
          placeholder: localize("mcp.addContext.placeholder", "Select MCP Resource..."),
          picks: (_query, token) => this._getResourcePicks(token, helper),
          goBack: () => {
            return helper.navigateBack();
          },
          dispose: () => {
            helper.dispose();
          }
        };
      }
    });
  }
  _getResourcePicks(token, helper) {
    const picksObservable = helper.getPicks(token);
    return derived(this, (reader) => {
      const pickItems = picksObservable.read(reader);
      const picks = [];
      for (const [server, resources] of pickItems.picks) {
        if (resources.length === 0) {
          continue;
        }
        picks.push(McpResourcePickHelper.sep(server));
        for (const resource of resources) {
          picks.push({
            ...McpResourcePickHelper.item(resource),
            asAttachment: () => helper.toAttachment(resource, server)
          });
        }
      }
      return { picks, busy: pickItems.isBusy };
    });
  }
};
McpAddContextContribution = __decorateClass([
  __decorateParam(0, IChatContextPickService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IMcpService)
], McpAddContextContribution);
export {
  McpAddContextContribution
};
