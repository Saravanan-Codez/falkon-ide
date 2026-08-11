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
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { isWeb } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import * as languages from "../../../../editor/common/languages.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { defaultExternalUriOpenerId, externalUriOpenersSettingId } from "./configuration.js";
import { testUrlMatchesGlob } from "../../../../platform/url/common/urlGlob.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
const IExternalUriOpenerService = createDecorator("externalUriOpenerService");
let ExternalUriOpenerService = class extends Disposable {
  constructor(openerService, configurationService, logService, preferencesService, quickInputService) {
    super();
    this.configurationService = configurationService;
    this.logService = logService;
    this.preferencesService = preferencesService;
    this.quickInputService = quickInputService;
    this._providers = new LinkedList();
    this._register(openerService.registerExternalOpener(this));
  }
  registerExternalOpenerProvider(provider) {
    const remove = this._providers.push(provider);
    return { dispose: remove };
  }
  async getOpeners(targetUri, allowOptional, ctx, token) {
    const allOpeners = await this.getAllOpenersForUri(targetUri);
    if (allOpeners.size === 0) {
      return [];
    }
    if (ctx.preferredOpenerId) {
      if (ctx.preferredOpenerId === defaultExternalUriOpenerId) {
        return [];
      }
      const preferredOpener = allOpeners.get(ctx.preferredOpenerId);
      if (preferredOpener) {
        return [preferredOpener];
      }
    }
    const configuredOpener = this.getConfiguredOpenerForUri(allOpeners, targetUri);
    if (configuredOpener) {
      return configuredOpener === defaultExternalUriOpenerId ? [] : [configuredOpener];
    }
    const validOpeners = [];
    await Promise.all(Array.from(allOpeners.values()).map(async (opener) => {
      let priority;
      try {
        priority = await opener.canOpen(ctx.sourceUri, token);
      } catch (e) {
        this.logService.error(e);
        return;
      }
      switch (priority) {
        case languages.ExternalUriOpenerPriority.Option:
        case languages.ExternalUriOpenerPriority.Default:
        case languages.ExternalUriOpenerPriority.Preferred:
          validOpeners.push({ opener, priority });
          break;
      }
    }));
    if (validOpeners.length === 0) {
      return [];
    }
    const preferred = validOpeners.filter((x) => x.priority === languages.ExternalUriOpenerPriority.Preferred).at(0);
    if (preferred) {
      return [preferred.opener];
    }
    if (!allowOptional && validOpeners.every((x) => x.priority === languages.ExternalUriOpenerPriority.Option)) {
      return [];
    }
    return validOpeners.map((value) => value.opener);
  }
  async openExternal(href, ctx, token) {
    const targetUri = typeof href === "string" ? URI.parse(href) : href;
    const allOpeners = await this.getOpeners(targetUri, false, ctx, token);
    if (allOpeners.length === 0) {
      return false;
    } else if (allOpeners.length === 1) {
      return allOpeners[0].openExternalUri(targetUri, ctx, token);
    }
    return this.showOpenerPrompt(allOpeners, targetUri, ctx, token);
  }
  async getOpener(targetUri, ctx, token) {
    const allOpeners = await this.getOpeners(targetUri, true, ctx, token);
    if (allOpeners.length >= 1) {
      return allOpeners[0];
    }
    return void 0;
  }
  async getAllOpenersForUri(targetUri) {
    const allOpeners = /* @__PURE__ */ new Map();
    await Promise.all(Iterable.map(this._providers, async (provider) => {
      for await (const opener of provider.getOpeners(targetUri)) {
        allOpeners.set(opener.id, opener);
      }
    }));
    return allOpeners;
  }
  getConfiguredOpenerForUri(openers, targetUri) {
    const config = this.configurationService.getValue(externalUriOpenersSettingId) || {};
    for (const [uriGlob, id] of Object.entries(config)) {
      if (testUrlMatchesGlob(targetUri, uriGlob)) {
        if (id === defaultExternalUriOpenerId) {
          return "default";
        }
        const entry = openers.get(id);
        if (entry) {
          return entry;
        }
      }
    }
    return void 0;
  }
  async showOpenerPrompt(openers, targetUri, ctx, token) {
    const items = openers.map((opener) => {
      return {
        label: opener.label,
        opener
      };
    });
    items.push(
      {
        label: isWeb ? nls.localize("selectOpenerDefaultLabel.web", "Open in new browser window") : nls.localize("selectOpenerDefaultLabel", "Open in default browser"),
        opener: void 0
      },
      { type: "separator" },
      {
        label: nls.localize("selectOpenerConfigureTitle", "Configure default opener..."),
        opener: "configureDefault"
      }
    );
    const picked = await this.quickInputService.pick(items, {
      placeHolder: nls.localize("selectOpenerPlaceHolder", "How would you like to open: {0}", targetUri.toString())
    });
    if (!picked) {
      return true;
    }
    if (typeof picked.opener === "undefined") {
      return false;
    } else if (picked.opener === "configureDefault") {
      await this.preferencesService.openUserSettings({
        jsonEditor: true,
        revealSetting: { key: externalUriOpenersSettingId, edit: true }
      });
      return true;
    } else {
      return picked.opener.openExternalUri(targetUri, ctx, token);
    }
  }
};
ExternalUriOpenerService = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IPreferencesService),
  __decorateParam(4, IQuickInputService)
], ExternalUriOpenerService);
export {
  ExternalUriOpenerService,
  IExternalUriOpenerService
};
