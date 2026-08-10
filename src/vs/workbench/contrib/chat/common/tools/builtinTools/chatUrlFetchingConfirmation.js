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
import { Codicon } from "../../../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IQuickInputService } from "../../../../../../platform/quickinput/common/quickInput.js";
import { IPreferencesService } from "../../../../../services/preferences/common/preferences.js";
import { ToolConfirmKind } from "../../chatService/chatService.js";
import { ChatConfiguration } from "../../constants.js";
import { extractUrlPatterns, getPatternLabel, isUrlApproved } from "./chatUrlFetchingPatterns.js";
const trashButton = {
  iconClass: ThemeIcon.asClassName(Codicon.trash),
  tooltip: localize("delete", "Delete")
};
let ChatUrlFetchingConfirmationContribution = class {
  constructor(_getURLS, _configurationService, _quickInputService, _preferencesService) {
    this._getURLS = _getURLS;
    this._configurationService = _configurationService;
    this._quickInputService = _quickInputService;
    this._preferencesService = _preferencesService;
    this.canUseDefaultApprovals = false;
  }
  getPreConfirmAction(ref) {
    return this._checkApproval(ref, true);
  }
  getPostConfirmAction(ref) {
    return this._checkApproval(ref, false);
  }
  _checkApproval(ref, checkRequest) {
    const urls = this._getURLS(ref.parameters);
    if (!urls || urls.length === 0) {
      return void 0;
    }
    const approvedUrls = this._getApprovedUrls();
    const allApproved = urls.every((url) => {
      try {
        const uri = URI.parse(url);
        return isUrlApproved(uri, approvedUrls, checkRequest);
      } catch {
        return false;
      }
    });
    if (allApproved) {
      return {
        type: ToolConfirmKind.Setting,
        id: ChatConfiguration.AutoApprovedUrls
      };
    }
    return void 0;
  }
  getPreConfirmActions(ref) {
    return this._getConfirmActions(ref, true);
  }
  getPostConfirmActions(ref) {
    return this._getConfirmActions(ref, false);
  }
  _getConfirmActions(ref, forRequest) {
    const urls = this._getURLS(ref.parameters);
    if (!urls || urls.length === 0) {
      return [];
    }
    const urlsWithoutQuery = urls.map((u) => u.split("?")[0]);
    const actions = [];
    const uniqueUrls = Array.from(new Set(urlsWithoutQuery)).map((u) => URI.parse(u));
    const urlPatterns = new ResourceMap(uniqueUrls.map((u) => [u, extractUrlPatterns(u)]));
    if (urlPatterns.size === 1) {
      const uri = uniqueUrls[0];
      const patterns = urlPatterns.get(uri);
      const topPatterns = patterns.slice(0, 2);
      for (const pattern of topPatterns) {
        const patternLabel = getPatternLabel(uri, pattern);
        actions.push({
          label: forRequest ? localize("approveRequestTo", "Allow requests to {0}", patternLabel) : localize("approveResponseFrom", "Allow responses from {0}", patternLabel),
          select: async () => {
            await this._approvePattern(pattern, forRequest, !forRequest);
            return true;
          }
        });
      }
      actions.push({
        label: localize("moreOptions", "Allow requests to..."),
        select: async () => {
          const result = await this._showMoreOptions(ref, [{ uri, patterns }], forRequest);
          return result;
        }
      });
    } else {
      actions.push({
        label: localize("moreOptionsMultiple", "Configure URL Approvals..."),
        select: async () => {
          await this._showMoreOptions(ref, [...urlPatterns].map(([uri, patterns]) => ({ uri, patterns })), forRequest);
          return true;
        }
      });
    }
    return actions;
  }
  async _showMoreOptions(ref, urls, forRequest) {
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      const quickTree = disposables.add(this._quickInputService.createQuickTree());
      quickTree.ignoreFocusOut = true;
      quickTree.sortByLabel = false;
      quickTree.placeholder = localize("selectApproval", "Select URL pattern to approve");
      const treeItems = [];
      const approvedUrls = this._getApprovedUrls();
      const dedupedPatterns = /* @__PURE__ */ new Set();
      for (const { uri, patterns } of urls) {
        for (const pattern of patterns.slice().sort((a, b) => b.length - a.length)) {
          if (dedupedPatterns.has(pattern)) {
            continue;
          }
          dedupedPatterns.add(pattern);
          const settings = approvedUrls[pattern];
          const requestChecked = typeof settings === "boolean" ? settings : settings?.approveRequest ?? false;
          const responseChecked = typeof settings === "boolean" ? settings : settings?.approveResponse ?? false;
          treeItems.push({
            label: getPatternLabel(uri, pattern),
            pattern,
            checked: requestChecked && responseChecked ? true : !requestChecked && !responseChecked ? false : "mixed",
            collapsed: true,
            children: [
              {
                label: localize("allowRequestsCheckbox", "Make requests without confirmation"),
                pattern,
                approvalType: "request",
                checked: requestChecked
              },
              {
                label: localize("allowResponsesCheckbox", "Allow responses without confirmation"),
                pattern,
                approvalType: "response",
                checked: responseChecked
              }
            ]
          });
        }
      }
      quickTree.setItemTree(treeItems);
      const updateApprovals = () => {
        const current = { ...this._getApprovedUrls() };
        for (const item of quickTree.itemTree) {
          const allowPre = item.children?.find((c) => c.approvalType === "request")?.checked;
          const allowPost = item.children?.find((c) => c.approvalType === "response")?.checked;
          if (allowPost && allowPre) {
            current[item.pattern] = true;
          } else if (!allowPost && !allowPre) {
            delete current[item.pattern];
          } else {
            current[item.pattern] = {
              approveRequest: !!allowPre || void 0,
              approveResponse: !!allowPost || void 0
            };
          }
        }
        return this._configurationService.updateValue(ChatConfiguration.AutoApprovedUrls, current);
      };
      disposables.add(quickTree.onDidAccept(async () => {
        quickTree.busy = true;
        await updateApprovals();
        resolve(!!this._checkApproval(ref, forRequest));
        quickTree.hide();
      }));
      disposables.add(quickTree.onDidHide(() => {
        updateApprovals();
        disposables.dispose();
        resolve(false);
      }));
      quickTree.show();
    });
  }
  async _approvePattern(pattern, approveRequest, approveResponse) {
    const approvedUrls = { ...this._getApprovedUrls() };
    const existingSettings = approvedUrls[pattern];
    let existingRequest = false;
    let existingResponse = false;
    if (typeof existingSettings === "boolean") {
      existingRequest = existingSettings;
      existingResponse = existingSettings;
    } else if (existingSettings) {
      existingRequest = existingSettings.approveRequest ?? false;
      existingResponse = existingSettings.approveResponse ?? false;
    }
    const mergedRequest = approveRequest || existingRequest;
    const mergedResponse = approveResponse || existingResponse;
    let value;
    if (mergedRequest === mergedResponse) {
      value = mergedRequest;
    } else {
      value = { approveRequest: mergedRequest, approveResponse: mergedResponse };
    }
    approvedUrls[pattern] = value;
    await this._configurationService.updateValue(
      ChatConfiguration.AutoApprovedUrls,
      approvedUrls
    );
  }
  getManageActions() {
    const approvedUrls = { ...this._getApprovedUrls() };
    const items = [];
    for (const [pattern, settings] of Object.entries(approvedUrls)) {
      const label = pattern;
      let description;
      if (typeof settings === "boolean") {
        description = settings ? localize("approveAll", "Approve all") : localize("denyAll", "Deny all");
      } else {
        const parts = [];
        if (settings.approveRequest) {
          parts.push(localize("requests", "requests"));
        }
        if (settings.approveResponse) {
          parts.push(localize("responses", "responses"));
        }
        description = parts.length > 0 ? localize("approves", "Approves {0}", parts.join(", ")) : localize("noApprovals", "No approvals");
      }
      const item = {
        label,
        description,
        buttons: [trashButton],
        checked: true,
        onDidChangeChecked: (checked) => {
          if (checked) {
            approvedUrls[pattern] = settings;
          } else {
            delete approvedUrls[pattern];
          }
          this._configurationService.updateValue(ChatConfiguration.AutoApprovedUrls, approvedUrls);
        }
      };
      items.push(item);
    }
    items.push({
      pickable: false,
      label: localize("moreOptionsManage", "More Options..."),
      description: localize("openSettings", "Open settings"),
      onDidOpen: () => {
        this._preferencesService.openUserSettings({ query: ChatConfiguration.AutoApprovedUrls });
      }
    });
    return items;
  }
  async reset() {
    await this._configurationService.updateValue(
      ChatConfiguration.AutoApprovedUrls,
      {}
    );
  }
  _getApprovedUrls() {
    return this._configurationService.getValue(
      ChatConfiguration.AutoApprovedUrls
    ) || {};
  }
};
ChatUrlFetchingConfirmationContribution = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IPreferencesService)
], ChatUrlFetchingConfirmationContribution);
export {
  ChatUrlFetchingConfirmationContribution
};
