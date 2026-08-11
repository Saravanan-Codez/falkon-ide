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
import { DeferredPromise, disposableTimeout, RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore, toDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ByteSize, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { DefaultQuickAccessFilterValue } from "../../../../platform/quickinput/common/quickAccess.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { IChatAttachmentResolveService } from "../../chat/browser/attachments/chatAttachmentResolveService.js";
import { IMcpService, isMcpResourceTemplate, McpCapability, McpConnectionState, McpResourceURI } from "../common/mcpTypes.js";
import { McpIcons } from "../common/mcpIcons.js";
import { openPanelChatAndGetWidget } from "./openPanelChatAndGetWidget.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { asArray } from "../../../../base/common/arrays.js";
let McpResourcePickHelper = class extends Disposable {
  constructor(_mcpService, _fileService, _quickInputService, _notificationService, _chatAttachmentResolveService) {
    super();
    this._mcpService = _mcpService;
    this._fileService = _fileService;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._chatAttachmentResolveService = _chatAttachmentResolveService;
    this._resources = observableValue(this, { picks: /* @__PURE__ */ new Map(), isBusy: true });
    this._pickItemsStack = new LinkedList();
    this._inDirectory = observableValue(this, void 0);
    this.hasServersWithResources = derived((reader) => {
      let enabled = false;
      for (const server of this._mcpService.servers.read(reader)) {
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
    this.checkIfNestedResources = () => !this._pickItemsStack.isEmpty();
  }
  static sep(server) {
    return {
      id: server.definition.id,
      type: "separator",
      label: server.definition.label
    };
  }
  addCurrentMCPQuickPickItemLevel(server, resources) {
    let isValidPush = false;
    isValidPush = this._pickItemsStack.isEmpty();
    if (!isValidPush) {
      const stackedItem = this._pickItemsStack.peek();
      if (stackedItem?.server === server && stackedItem.resources === resources) {
        isValidPush = false;
      } else {
        isValidPush = true;
      }
    }
    if (isValidPush) {
      this._pickItemsStack.push({ server, resources });
    }
  }
  navigateBack() {
    const items = this._pickItemsStack.pop();
    if (items) {
      this._inDirectory.set({ server: items.server, resources: items.resources }, void 0);
      return true;
    } else {
      return false;
    }
  }
  static item(resource) {
    const iconPath = resource.icons.getUrl(22);
    if (isMcpResourceTemplate(resource)) {
      return {
        id: resource.template.template,
        label: resource.title || resource.name,
        description: resource.description,
        detail: localize("mcp.resource.template", "Resource template: {0}", resource.template.template),
        iconPath
      };
    }
    return {
      id: resource.uri.toString(),
      label: resource.title || resource.name,
      description: resource.description,
      detail: resource.mcpUri + (resource.sizeInBytes !== void 0 ? " (" + ByteSize.formatSize(resource.sizeInBytes) + ")" : ""),
      iconPath
    };
  }
  /**
   * Navigate to a resource if it's a directory.
   * Returns true if the resource is a directory with children (navigation succeeded).
   * Returns false if the resource is a leaf file (no navigation).
   * When returning true, statefully updates the picker state to display directory contents.
   */
  async navigate(resource, server) {
    if (isMcpResourceTemplate(resource)) {
      return false;
    }
    const uri = resource.uri;
    let stat = void 0;
    try {
      stat = await this._fileService.resolve(uri, { resolveMetadata: false });
    } catch (e) {
      return false;
    }
    if (stat && this._isDirectoryResource(resource) && (stat.children?.length ?? 0) > 0) {
      const currentResources = this._resources.get().picks.get(server);
      if (currentResources) {
        this.addCurrentMCPQuickPickItemLevel(server, currentResources);
      }
      const childResources = stat.children.map((child) => {
        const mcpUri = McpResourceURI.fromServer(server.definition, child.resource.toString());
        return {
          uri: mcpUri,
          mcpUri: child.resource.path,
          name: child.name,
          title: child.name,
          description: resource.description,
          mimeType: void 0,
          sizeInBytes: child.size,
          icons: McpIcons.fromParsed(void 0)
        };
      });
      this._inDirectory.set({ server, resources: childResources }, void 0);
      return true;
    }
    return false;
  }
  toAttachment(resource, server) {
    const noop = "noop";
    if (this._isDirectoryResource(resource)) {
      this.checkIfDirectoryAndPopulate(resource, server);
      return noop;
    }
    if (isMcpResourceTemplate(resource)) {
      return this._resourceTemplateToAttachment(resource).then((val) => val || noop);
    } else {
      return this._resourceToAttachment(resource).then((val) => val || noop);
    }
  }
  async checkIfDirectoryAndPopulate(resource, server) {
    try {
      return !await this.navigate(resource, server);
    } catch (error) {
      return false;
    }
  }
  async toURI(resource) {
    if (isMcpResourceTemplate(resource)) {
      const maybeUri = await this._resourceTemplateToURI(resource);
      return maybeUri && await this._verifyUriIfNeeded(maybeUri);
    } else {
      return resource.uri;
    }
  }
  async _resourceToAttachment(resource) {
    const asImage = await this._chatAttachmentResolveService.resolveImageEditorAttachContext(resource.uri, void 0, resource.mimeType);
    if (asImage) {
      return asImage;
    }
    return {
      id: resource.uri.toString(),
      kind: "file",
      name: resource.name,
      value: resource.uri
    };
  }
  async _resourceTemplateToAttachment(rt) {
    const maybeUri = await this._resourceTemplateToURI(rt);
    const uri = maybeUri && await this._verifyUriIfNeeded(maybeUri);
    return uri && this._resourceToAttachment({
      uri,
      name: rt.name,
      mimeType: rt.mimeType
    });
  }
  async _verifyUriIfNeeded({ uri, needsVerification }) {
    if (!needsVerification) {
      return uri;
    }
    const exists = await this._fileService.exists(uri);
    if (exists) {
      return uri;
    }
    this._notificationService.warn(localize("mcp.resource.template.notFound", "The resource {0} was not found.", McpResourceURI.toServer(uri).resourceURL.toString()));
    return void 0;
  }
  async _resourceTemplateToURI(rt) {
    const todo = rt.template.components.flatMap((c) => typeof c === "object" ? c.variables : []);
    const quickInput = this._quickInputService.createQuickPick();
    const cts = new CancellationTokenSource();
    const vars = {};
    quickInput.totalSteps = todo.length;
    quickInput.ignoreFocusOut = true;
    let needsVerification = false;
    try {
      for (let i = 0; i < todo.length; i++) {
        const variable = todo[i];
        const resolved = await this._promptForTemplateValue(quickInput, variable, vars, rt);
        if (resolved === void 0) {
          return void 0;
        }
        needsVerification ||= !resolved.completed;
        vars[todo[i].name] = variable.repeatable ? resolved.value.split("/") : resolved.value;
      }
      return { uri: rt.resolveURI(vars), needsVerification };
    } finally {
      cts.dispose(true);
      quickInput.dispose();
    }
  }
  _promptForTemplateValue(input, variable, variablesSoFar, rt) {
    const store = new DisposableStore();
    const completions = /* @__PURE__ */ new Map([]);
    const variablesWithPlaceholders = { ...variablesSoFar };
    for (const variable2 of rt.template.components.flatMap((c) => typeof c === "object" ? c.variables : [])) {
      if (!variablesWithPlaceholders.hasOwnProperty(variable2.name)) {
        variablesWithPlaceholders[variable2.name] = `$${variable2.name.toUpperCase()}`;
      }
    }
    let placeholder = localize("mcp.resource.template.placeholder", "Value for ${0} in {1}", variable.name.toUpperCase(), rt.template.resolve(variablesWithPlaceholders).replaceAll("%24", "$"));
    if (variable.optional) {
      placeholder += " (" + localize("mcp.resource.template.optional", "Optional") + ")";
    }
    input.placeholder = placeholder;
    input.value = "";
    input.items = [];
    input.show();
    const currentID = generateUuid();
    const setItems = (value, completed = []) => {
      const items = completed.filter((c) => c !== value).map((c) => ({ id: c, label: c }));
      if (value) {
        items.unshift({ id: currentID, label: value });
      } else if (variable.optional) {
        items.unshift({ id: currentID, label: localize("mcp.resource.template.empty", "<Empty>") });
      }
      input.items = items;
    };
    let changeCancellation = new CancellationTokenSource();
    store.add(toDisposable(() => changeCancellation.dispose(true)));
    const getCompletionItems = () => {
      const inputValue = input.value;
      let promise = completions.get(inputValue);
      if (!promise) {
        promise = rt.complete(variable.name, inputValue, variablesSoFar, changeCancellation.token);
        completions.set(inputValue, promise);
      }
      promise.then((values) => {
        if (!changeCancellation.token.isCancellationRequested) {
          setItems(inputValue, values);
        }
      }).catch(() => {
        completions.delete(inputValue);
      }).finally(() => {
        if (!changeCancellation.token.isCancellationRequested) {
          input.busy = false;
        }
      });
    };
    const getCompletionItemsScheduler = store.add(new RunOnceScheduler(getCompletionItems, 300));
    return new Promise((resolve) => {
      store.add(input.onDidHide(() => resolve(void 0)));
      store.add(input.onDidAccept(() => {
        const item = input.selectedItems[0];
        if (item.id === currentID) {
          resolve({ value: input.value, completed: false });
        } else if (variable.explodable && item.label.endsWith("/") && item.label !== input.value) {
          input.value = item.label;
        } else {
          resolve({ value: item.label, completed: true });
        }
      }));
      store.add(input.onDidChangeValue((value) => {
        input.busy = true;
        changeCancellation.dispose(true);
        changeCancellation = new CancellationTokenSource();
        getCompletionItemsScheduler.cancel();
        setItems(value);
        if (completions.has(input.value)) {
          getCompletionItems();
        } else {
          getCompletionItemsScheduler.schedule();
        }
      }));
      getCompletionItems();
    }).finally(() => store.dispose());
  }
  _isDirectoryResource(resource) {
    if (resource.mimeType && resource.mimeType === "inode/directory") {
      return true;
    } else if (isMcpResourceTemplate(resource)) {
      return resource.template.template.endsWith("/");
    } else {
      return resource.uri.path.endsWith("/");
    }
  }
  getPicks(token) {
    const cts = new CancellationTokenSource(token);
    let isBusyLoadingPicks = true;
    this._register(toDisposable(() => cts.dispose(true)));
    let showInSequence = true;
    this._register(disposableTimeout(() => {
      showInSequence = false;
      publish();
    }, 5e3));
    const publish = () => {
      const output = /* @__PURE__ */ new Map();
      for (const [server, rec] of servers) {
        const r = [];
        output.set(server, r);
        if (rec.templates.isResolved) {
          r.push(...rec.templates.value);
        } else if (showInSequence) {
          break;
        }
        r.push(...rec.resourcesSoFar);
        if (!rec.resources.isSettled && showInSequence) {
          break;
        }
      }
      this._resources.set({ picks: output, isBusy: isBusyLoadingPicks }, void 0);
    };
    const servers = /* @__PURE__ */ new Map();
    Promise.all((this.explicitServers || this._mcpService.servers.get()).map(async (server) => {
      let cap = server.capabilities.get();
      const rec = {
        templates: new DeferredPromise(),
        resourcesSoFar: [],
        resources: new DeferredPromise()
      };
      servers.set(server, rec);
      if (cap === void 0) {
        cap = await new Promise((resolve) => {
          server.start().then((state) => {
            if (state.state === McpConnectionState.Kind.Error || state.state === McpConnectionState.Kind.Stopped) {
              resolve(void 0);
            }
          });
          this._register(cts.token.onCancellationRequested(() => resolve(void 0)));
          this._register(autorun((reader) => {
            const cap2 = server.capabilities.read(reader);
            if (cap2 !== void 0) {
              resolve(cap2);
            }
          }));
        });
      }
      if (cap && cap & McpCapability.Resources) {
        await Promise.all([
          rec.templates.settleWith(server.resourceTemplates(cts.token).catch(() => [])).finally(publish),
          rec.resources.settleWith((async () => {
            for await (const page of server.resources(cts.token)) {
              rec.resourcesSoFar = rec.resourcesSoFar.concat(page);
              publish();
            }
          })())
        ]);
      } else {
        rec.templates.complete([]);
        rec.resources.complete([]);
      }
    })).finally(() => {
      isBusyLoadingPicks = false;
      publish();
    });
    return derived(this, (reader) => {
      const directoryResource = this._inDirectory.read(reader);
      return directoryResource ? { picks: /* @__PURE__ */ new Map([[directoryResource.server, directoryResource.resources]]), isBusy: false } : this._resources.read(reader);
    });
  }
};
McpResourcePickHelper = __decorateClass([
  __decorateParam(0, IMcpService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IChatAttachmentResolveService)
], McpResourcePickHelper);
let AbstractMcpResourceAccessPick = class {
  constructor(_scopeTo, _instantiationService, _editorService, _chatWidgetService, _viewsService) {
    this._scopeTo = _scopeTo;
    this._instantiationService = _instantiationService;
    this._editorService = _editorService;
    this._chatWidgetService = _chatWidgetService;
    this._viewsService = _viewsService;
  }
  applyToPick(picker, token, runOptions) {
    picker.canAcceptInBackground = true;
    picker.busy = true;
    picker.keepScrollPosition = true;
    const store = new DisposableStore();
    const goBackId = "_goback_";
    const attachButton = localize("mcp.quickaccess.attach", "Attach to chat");
    const helper = store.add(this._instantiationService.createInstance(McpResourcePickHelper));
    if (this._scopeTo) {
      helper.explicitServers = [this._scopeTo];
    }
    const picksObservable = helper.getPicks(token);
    store.add(autorun((reader) => {
      const pickItems = picksObservable.read(reader);
      const isBusy = pickItems.isBusy;
      const items = [];
      for (const [server, resources] of pickItems.picks) {
        items.push(McpResourcePickHelper.sep(server));
        for (const resource of resources) {
          const pickItem = McpResourcePickHelper.item(resource);
          pickItem.buttons = [{ iconClass: ThemeIcon.asClassName(Codicon.attach), tooltip: attachButton }];
          items.push({ ...pickItem, resource, server });
        }
      }
      if (helper.checkIfNestedResources()) {
        const goBackItem = {
          id: goBackId,
          label: localize("goBack", "Go back \u21A9"),
          alwaysShow: true
        };
        items.push(goBackItem);
      }
      picker.items = items;
      picker.busy = isBusy;
    }));
    store.add(picker.onDidTriggerItemButton((event) => {
      if (event.button.tooltip === attachButton) {
        picker.busy = true;
        const resourceItem = event.item;
        const attachment = helper.toAttachment(resourceItem.resource, resourceItem.server);
        if (attachment instanceof Promise) {
          attachment.then(async (a) => {
            if (a !== "noop") {
              const widget = await openPanelChatAndGetWidget(this._viewsService, this._chatWidgetService);
              widget?.attachmentModel.addContext(...asArray(a));
            }
            picker.hide();
          });
        }
      }
    }));
    store.add(picker.onDidHide(() => {
      helper.dispose();
    }));
    store.add(picker.onDidAccept(async (event) => {
      try {
        picker.busy = true;
        const [item] = picker.selectedItems;
        if (item.id === goBackId) {
          helper.navigateBack();
          picker.busy = false;
          return;
        }
        const resourceItem = item;
        const resource = resourceItem.resource;
        const isNested = await helper.navigate(resource, resourceItem.server);
        if (!isNested) {
          const uri = await helper.toURI(resource);
          if (uri) {
            picker.hide();
            this._editorService.openEditor({ resource: uri, options: { preserveFocus: event.inBackground } });
          }
        }
      } finally {
        picker.busy = false;
      }
    }));
    return store;
  }
};
AbstractMcpResourceAccessPick = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, IViewsService)
], AbstractMcpResourceAccessPick);
let McpResourceQuickPick = class extends AbstractMcpResourceAccessPick {
  constructor(scopeTo, instantiationService, editorService, chatWidgetService, viewsService, _quickInputService) {
    super(scopeTo, instantiationService, editorService, chatWidgetService, viewsService);
    this._quickInputService = _quickInputService;
  }
  async pick(token = CancellationToken.None) {
    const store = new DisposableStore();
    const qp = store.add(this._quickInputService.createQuickPick({ useSeparators: true }));
    qp.placeholder = localize("mcp.quickaccess.placeholder", "Search for resources");
    store.add(this.applyToPick(qp, token));
    store.add(qp.onDidHide(() => store.dispose()));
    qp.show();
    await Event.toPromise(qp.onDidHide);
  }
};
McpResourceQuickPick = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, IViewsService),
  __decorateParam(5, IQuickInputService)
], McpResourceQuickPick);
let McpResourceQuickAccess = class extends AbstractMcpResourceAccessPick {
  constructor(instantiationService, editorService, chatWidgetService, viewsService) {
    super(void 0, instantiationService, editorService, chatWidgetService, viewsService);
    this.defaultFilterValue = DefaultQuickAccessFilterValue.LAST;
  }
  static {
    this.PREFIX = "mcpr ";
  }
  provide(picker, token, runOptions) {
    return this.applyToPick(picker, token, runOptions);
  }
};
McpResourceQuickAccess = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IChatWidgetService),
  __decorateParam(3, IViewsService)
], McpResourceQuickAccess);
export {
  AbstractMcpResourceAccessPick,
  McpResourcePickHelper,
  McpResourceQuickAccess,
  McpResourceQuickPick
};
