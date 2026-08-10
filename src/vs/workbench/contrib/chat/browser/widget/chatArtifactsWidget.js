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
import * as dom from "../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { toAction } from "../../../../../base/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchObjectTree } from "../../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { ChatConfiguration } from "../../common/constants.js";
import { ChatMemoryFileResource } from "../../common/chatArtifactExtraction.js";
import { IChatArtifactsService } from "../../common/tools/chatArtifactsService.js";
import { IChatImageCarouselService } from "../chatImageCarouselService.js";
import { getEditorOverrideForChatResource } from "./chatEditorAssociations.js";
const ARTIFACT_TYPE_ICONS = {
  devServer: Codicon.globe,
  screenshot: Codicon.file,
  plan: Codicon.book
};
function isGroupNode(element) {
  return element.kind === "group";
}
function isLeafNode(element) {
  return element.kind === "leaf";
}
let ChatArtifactsWidget = class extends Disposable {
  constructor(_chatArtifactsService, _instantiationService, _openerService, _configurationService, _commandService, _fileService, _fileDialogService, _chatImageCarouselService) {
    super();
    this._chatArtifactsService = _chatArtifactsService;
    this._instantiationService = _instantiationService;
    this._openerService = _openerService;
    this._configurationService = _configurationService;
    this._commandService = _commandService;
    this._fileService = _fileService;
    this._fileDialogService = _fileDialogService;
    this._chatImageCarouselService = _chatImageCarouselService;
    this._sessionResource = observableValue(this, void 0);
    this._isCollapsed = observableValue(this, false);
    this._currentArtifacts = derived(this, (reader) => {
      const sr = this._sessionResource.read(reader);
      return sr ? this._chatArtifactsService.getArtifacts(sr) : void 0;
    });
    this._treeData = derived(this, (reader) => {
      const artifacts = this._currentArtifacts.read(reader);
      if (!artifacts) {
        return void 0;
      }
      const groups = artifacts.artifactGroups.read(reader);
      const totalCount = groups.reduce((sum, g) => sum + g.artifacts.length, 0);
      if (totalCount === 0) {
        return void 0;
      }
      const multiSource = groups.length > 1;
      const treeElements = buildTreeElementsFromGroups(groups, multiSource, (source) => this._clearSource(source));
      const visibleCount = countVisibleRows(treeElements);
      const itemsShown = Math.min(visibleCount, ChatArtifactsWidget.MAX_ITEMS_SHOWN);
      return {
        totalCount,
        treeElements,
        treeHeight: itemsShown * ChatArtifactsWidget.ELEMENT_HEIGHT
      };
    });
    this.domNode = dom.$(".chat-artifacts-widget");
    this.domNode.style.display = "none";
    this._register(autorun((reader) => {
      const artifacts = this._currentArtifacts.read(reader);
      dom.clearNode(this.domNode);
      if (!artifacts) {
        this.domNode.style.display = "none";
        return;
      }
      const store = reader.store;
      const expandoContainer = dom.$(".chat-artifacts-expand");
      const headerButton = store.add(new Button(expandoContainer, { supportIcons: true }));
      const titleSection = dom.$(".chat-artifacts-title-section");
      const expandIcon = dom.$(".expand-icon.codicon");
      expandIcon.setAttribute("aria-hidden", "true");
      const titleElement = dom.$(".chat-artifacts-title");
      titleSection.appendChild(expandIcon);
      titleSection.appendChild(titleElement);
      headerButton.element.appendChild(titleSection);
      this.domNode.appendChild(expandoContainer);
      const listContainer = dom.$(".chat-artifacts-list");
      this.domNode.appendChild(listContainer);
      const tree = store.add(this._instantiationService.createInstance(
        WorkbenchObjectTree,
        "ChatArtifactsTree",
        listContainer,
        new ChatArtifactsTreeDelegate(),
        [
          new ChatArtifactGroupRenderer(),
          new ChatArtifactLeafRenderer((artifact) => this._saveArtifact(artifact))
        ],
        {
          alwaysConsumeMouseWheel: false,
          accessibilityProvider: new ChatArtifactsAccessibilityProvider()
        }
      ));
      store.add(tree.onDidOpen((e) => {
        if (!e.element) {
          return;
        }
        if (isGroupNode(e.element)) {
          if (e.element.onlyShowGroup) {
            this._openGroupInCarousel(e.element);
          }
        } else if (isLeafNode(e.element)) {
          this._openLeafArtifact(e.element.artifact);
        }
      }));
      store.add(headerButton.onDidClick(() => {
        this._isCollapsed.set(!this._isCollapsed.read(void 0), void 0);
      }));
      store.add(autorun((reader2) => {
        const collapsed = this._isCollapsed.read(reader2);
        expandIcon.classList.toggle("codicon-chevron-down", !collapsed);
        expandIcon.classList.toggle("codicon-chevron-right", collapsed);
        headerButton.element.setAttribute("aria-expanded", String(!collapsed));
        listContainer.style.display = collapsed ? "none" : "block";
      }));
      store.add(autorun((reader2) => {
        const data = this._treeData.read(reader2);
        if (!data) {
          this.domNode.style.display = "none";
          return;
        }
        this.domNode.style.display = "";
        titleElement.textContent = data.totalCount === 1 ? localize("chat.artifacts.one", "1 Artifact") : localize("chat.artifacts.count", "{0} Artifacts", data.totalCount);
        tree.layout(data.treeHeight);
        tree.getHTMLElement().style.height = `${data.treeHeight}px`;
        tree.setChildren(null, data.treeElements);
      }));
    }));
  }
  static {
    this.ELEMENT_HEIGHT = 22;
  }
  static {
    this.MAX_ITEMS_SHOWN = 6;
  }
  setSessionResource(sessionResource) {
    this._sessionResource.set(sessionResource, void 0);
  }
  async _openGroupInCarousel(group) {
    const first = group.artifacts[0];
    if (first?.uri) {
      await this._chatImageCarouselService.openCarouselAtResource(URI.parse(first.uri));
    }
  }
  _openLeafArtifact(artifact) {
    if (artifact.type === "screenshot" && this._configurationService.getValue(ChatConfiguration.ImageCarouselEnabled)) {
      this._openScreenshotInCarousel(artifact);
    } else if (artifact.uri) {
      const uri = URI.parse(artifact.uri);
      if (ChatMemoryFileResource.isChatMemoryFileUri(uri)) {
        this._openMemoryFileArtifact(uri);
      } else {
        const editorOverride = getEditorOverrideForChatResource(uri, this._configurationService);
        this._openerService.open(uri, {
          fromUserGesture: true,
          editorOptions: { override: editorOverride }
        });
      }
    }
  }
  async _openScreenshotInCarousel(clicked) {
    if (clicked.uri) {
      await this._chatImageCarouselService.openCarouselAtResource(URI.parse(clicked.uri));
    }
  }
  async _openMemoryFileArtifact(uri) {
    const { memoryPath, sessionResource } = ChatMemoryFileResource.parse(uri);
    const resolvedUriStr = await this._commandService.executeCommand(
      "github.copilot.chat.tools.memory.resolveMemoryFileUri",
      memoryPath,
      sessionResource
    );
    if (resolvedUriStr) {
      const resolvedUri = URI.parse(resolvedUriStr);
      const editorOverride = getEditorOverrideForChatResource(resolvedUri, this._configurationService);
      this._openerService.open(resolvedUri, {
        fromUserGesture: true,
        editorOptions: { override: editorOverride }
      });
    }
  }
  _clearSource(source) {
    const artifacts = this._currentArtifacts.get();
    if (!artifacts) {
      return;
    }
    switch (source.kind) {
      case "agent":
        artifacts.clearAgentArtifacts();
        break;
      case "subagent":
        artifacts.clearSubagentArtifacts(source.invocationId);
        break;
    }
  }
  async _saveArtifact(artifact) {
    const sourceUri = URI.parse(artifact.uri);
    const defaultFileName = sourceUri.path.split("/").pop() ?? artifact.label;
    const defaultPath = await this._fileDialogService.defaultFilePath();
    const defaultUri = URI.joinPath(defaultPath, defaultFileName);
    const targetUri = await this._fileDialogService.showSaveDialog({
      defaultUri,
      title: localize("chat.artifacts.saveDialog.title", "Save Artifact")
    });
    if (targetUri) {
      const content = await this._fileService.readFile(sourceUri);
      await this._fileService.writeFile(targetUri, content.value);
    }
  }
};
ChatArtifactsWidget = __decorateClass([
  __decorateParam(0, IChatArtifactsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IFileDialogService),
  __decorateParam(7, IChatImageCarouselService)
], ChatArtifactsWidget);
function sourceDisplayName(source) {
  switch (source.kind) {
    case "rules":
      return localize("chat.artifacts.source.rules", "Rules");
    case "agent":
      return localize("chat.artifacts.source.agent", "Agent");
    case "subagent":
      return source.name ?? localize("chat.artifacts.source.subagent", "Subagent");
  }
}
function buildTreeElementsFromGroups(sourceGroups, multiSource, onClearSource) {
  const elements = [];
  for (const sourceGroup of sourceGroups) {
    const prefix = multiSource ? sourceDisplayName(sourceGroup.source) : void 0;
    const clearable = sourceGroup.source.kind !== "rules";
    const onClear = clearable ? () => onClearSource(sourceGroup.source) : void 0;
    const groups = /* @__PURE__ */ new Map();
    const ungrouped = [];
    for (const artifact of sourceGroup.artifacts) {
      if (artifact.groupName) {
        let group = groups.get(artifact.groupName);
        if (!group) {
          group = { config: { groupName: artifact.groupName, onlyShowGroup: artifact.onlyShowGroup ?? false }, artifacts: [] };
          groups.set(artifact.groupName, group);
        }
        group.artifacts.push(artifact);
      } else {
        ungrouped.push(artifact);
      }
    }
    for (const [, group] of groups) {
      const displayName = prefix ? `${prefix}: ${group.config.groupName}` : group.config.groupName;
      if (group.artifacts.length === 1 && !group.config.onlyShowGroup) {
        elements.push({ element: { kind: "leaf", artifact: group.artifacts[0], description: displayName, onClear } });
        continue;
      }
      const groupNode = {
        kind: "group",
        groupName: displayName,
        artifacts: group.artifacts,
        onlyShowGroup: group.config.onlyShowGroup,
        onClear
      };
      if (group.config.onlyShowGroup) {
        elements.push({ element: groupNode, collapsible: false, collapsed: false });
      } else {
        elements.push({
          element: groupNode,
          collapsible: true,
          collapsed: false,
          children: group.artifacts.map((a) => ({ element: { kind: "leaf", artifact: a } }))
        });
      }
    }
    if (ungrouped.length > 0 && prefix) {
      if (ungrouped.length === 1) {
        elements.push({ element: { kind: "leaf", artifact: ungrouped[0], description: prefix, onClear } });
      } else {
        const groupNode = {
          kind: "group",
          groupName: prefix,
          artifacts: ungrouped,
          onlyShowGroup: false,
          onClear
        };
        elements.push({
          element: groupNode,
          collapsible: true,
          collapsed: false,
          children: ungrouped.map((a) => ({ element: { kind: "leaf", artifact: a } }))
        });
      }
    } else {
      for (const artifact of ungrouped) {
        elements.push({ element: { kind: "leaf", artifact, onClear } });
      }
    }
  }
  return elements;
}
function countVisibleRows(elements) {
  let count = 0;
  for (const el of elements) {
    count++;
    if (el.children && !el.collapsed) {
      count += countVisibleRows([...el.children]);
    }
  }
  return count;
}
class ChatArtifactsTreeDelegate {
  getHeight() {
    return ChatArtifactsWidget.ELEMENT_HEIGHT;
  }
  getTemplateId(element) {
    return isGroupNode(element) ? ChatArtifactGroupRenderer.TEMPLATE_ID : ChatArtifactLeafRenderer.TEMPLATE_ID;
  }
}
class ChatArtifactsAccessibilityProvider {
  getAriaLabel(element) {
    if (isGroupNode(element)) {
      return localize("chat.artifacts.group.aria", "{0} ({1} items)", element.groupName, element.artifacts.length);
    }
    return element.artifact.label;
  }
  getWidgetAriaLabel() {
    return localize("chat.artifacts.widget.aria", "Chat Artifacts");
  }
}
class ChatArtifactGroupRenderer {
  constructor() {
    this.templateId = ChatArtifactGroupRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "chatArtifactGroupRenderer";
  }
  renderTemplate(container) {
    const row = dom.append(container, dom.$(".chat-artifacts-list-row"));
    const iconElement = dom.append(row, dom.$(".chat-artifacts-list-icon"));
    const labelElement = dom.append(row, dom.$(".chat-artifacts-list-label"));
    const actionsContainer = dom.append(row, dom.$(".chat-artifacts-list-actions"));
    const elementDisposables = new DisposableStore();
    const actionBar = new ActionBar(actionsContainer);
    return { container: row, iconElement, labelElement, actionBar, elementDisposables };
  }
  renderElement(node, _index, templateData) {
    const group = node.element;
    if (!isGroupNode(group)) {
      return;
    }
    templateData.elementDisposables.clear();
    const firstType = group.artifacts[0]?.type;
    const icon = firstType && ARTIFACT_TYPE_ICONS[firstType] || Codicon.archive;
    templateData.iconElement.className = "chat-artifacts-list-icon " + ThemeIcon.asClassName(icon);
    templateData.labelElement.textContent = `${group.groupName} (${group.artifacts.length})`;
    templateData.container.title = group.groupName;
    templateData.actionBar.clear();
    if (group.onClear) {
      const clearFn = group.onClear;
      templateData.actionBar.push(toAction({
        id: "chatArtifacts.clearSource",
        label: localize("chat.artifacts.clearSource", "Clear"),
        class: ThemeIcon.asClassName(Codicon.close),
        run: () => clearFn()
      }), { icon: true, label: false });
    }
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.actionBar.dispose();
  }
}
class ChatArtifactLeafRenderer {
  constructor(_onSave) {
    this._onSave = _onSave;
    this.templateId = ChatArtifactLeafRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "chatArtifactLeafRenderer";
  }
  renderTemplate(container) {
    const row = dom.append(container, dom.$(".chat-artifacts-list-row"));
    const iconElement = dom.append(row, dom.$(".chat-artifacts-list-icon"));
    const labelElement = dom.append(row, dom.$(".chat-artifacts-list-label"));
    const descriptionElement = dom.append(row, dom.$(".chat-artifacts-list-description"));
    const actionsContainer = dom.append(row, dom.$(".chat-artifacts-list-actions"));
    const elementDisposables = new DisposableStore();
    const actionBar = new ActionBar(actionsContainer);
    return { container: row, iconElement, labelElement, descriptionElement, actionBar, elementDisposables };
  }
  renderElement(node, _index, templateData) {
    if (!isLeafNode(node.element)) {
      return;
    }
    templateData.elementDisposables.clear();
    const { artifact, description, onClear } = node.element;
    const icon = artifact.type && ARTIFACT_TYPE_ICONS[artifact.type] || Codicon.archive;
    templateData.iconElement.className = "chat-artifacts-list-icon " + ThemeIcon.asClassName(icon);
    templateData.labelElement.textContent = artifact.label;
    templateData.descriptionElement.textContent = description ?? "";
    templateData.descriptionElement.style.display = description ? "" : "none";
    templateData.container.title = artifact.uri;
    templateData.actionBar.clear();
    const actions = [];
    if (onClear) {
      const clearFn = onClear;
      actions.push(toAction({
        id: "chatArtifacts.clearSource",
        label: localize("chat.artifacts.clearSource", "Clear"),
        class: ThemeIcon.asClassName(Codicon.close),
        run: () => clearFn()
      }));
    }
    actions.push(toAction({
      id: "chatArtifacts.save",
      label: localize("chat.artifacts.save", "Save artifact"),
      class: ThemeIcon.asClassName(Codicon.save),
      run: () => this._onSave(artifact)
    }));
    templateData.actionBar.push(actions, { icon: true, label: false });
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
    templateData.actionBar.dispose();
  }
}
export {
  ChatArtifactsWidget
};
