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
import * as dom from "../../../../../../base/browser/dom.js";
import { trackFocus } from "../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { IconLabel } from "../../../../../../base/browser/ui/iconLabel/iconLabel.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable, DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { localize } from "../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchList } from "../../../../../../platform/list/browser/listService.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { IChatTodoListService } from "../../../common/tools/chatTodoListService.js";
class TodoListDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    return TodoListRenderer.TEMPLATE_ID;
  }
}
class TodoListRenderer {
  constructor() {
    this.templateId = TodoListRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "todoListRenderer";
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const todoElement = dom.append(container, dom.$("li.todo-item"));
    todoElement.setAttribute("role", "listitem");
    const statusIcon = dom.append(todoElement, dom.$(".todo-status-icon.codicon"));
    statusIcon.setAttribute("aria-hidden", "true");
    const todoContent = dom.append(todoElement, dom.$(".todo-content"));
    const iconLabel = templateDisposables.add(new IconLabel(todoContent, { supportIcons: false }));
    return { templateDisposables, todoElement, statusIcon, iconLabel };
  }
  renderElement(todo, index, templateData) {
    const { todoElement, statusIcon, iconLabel } = templateData;
    statusIcon.className = `todo-status-icon codicon ${this.getStatusIconClass(todo.status)}`;
    statusIcon.style.color = this.getStatusIconColor(todo.status);
    iconLabel.setLabel(todo.title);
    const statusText = this.getStatusText(todo.status);
    const ariaLabel = localize("chat.todoList.item", "{0}, {1}", todo.title, statusText);
    todoElement.setAttribute("aria-label", ariaLabel);
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  getStatusText(status) {
    switch (status) {
      case "completed":
        return localize("chat.todoList.status.completed", "completed");
      case "in-progress":
        return localize("chat.todoList.status.inProgress", "in progress");
      case "not-started":
      default:
        return localize("chat.todoList.status.notStarted", "not started");
    }
  }
  getStatusIconClass(status) {
    switch (status) {
      case "completed":
        return "codicon-pass";
      case "in-progress":
        return "codicon-record";
      case "not-started":
      default:
        return "codicon-circle-outline";
    }
  }
  getStatusIconColor(status) {
    switch (status) {
      case "completed":
        return "var(--vscode-charts-green)";
      case "in-progress":
        return "var(--vscode-charts-blue)";
      case "not-started":
      default:
        return "var(--vscode-foreground)";
    }
  }
}
let ChatTodoListWidget = class extends Disposable {
  constructor(chatTodoListService, instantiationService, contextKeyService, telemetryService) {
    super();
    this.chatTodoListService = chatTodoListService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.telemetryService = telemetryService;
    this._isExpanded = false;
    this._userManuallyExpanded = false;
    this._inChatTodoListContextKey = ChatContextKeys.inChatTodoList.bindTo(contextKeyService);
    this.domNode = this.createChatTodoWidget();
    const focusTracker = this._register(trackFocus(this.domNode));
    this._register(focusTracker.onDidFocus(() => this._inChatTodoListContextKey.set(true)));
    this._register(focusTracker.onDidBlur(() => this._inChatTodoListContextKey.set(false)));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(/* @__PURE__ */ new Set([ChatContextKeys.requestInProgress.key]))) {
        this.updateClearButtonState();
      }
    }));
  }
  get height() {
    return this.domNode.style.display === "none" ? 0 : this.domNode.offsetHeight;
  }
  hideWidget() {
    this.domNode.style.display = "none";
  }
  createChatTodoWidget() {
    const container = dom.$(".chat-todo-list-widget");
    container.style.display = "none";
    const expandoContainer = dom.$(".todo-list-expand");
    this.expandoButton = this._register(new Button(expandoContainer, {
      supportIcons: true
    }));
    this.expandoButton.element.setAttribute("aria-expanded", String(this._isExpanded));
    this.expandoButton.element.setAttribute("aria-controls", "todo-list-container");
    const titleSection = dom.$(".todo-list-title-section");
    this.expandIcon = dom.$(".expand-icon.codicon");
    this.expandIcon.classList.add(this._isExpanded ? "codicon-chevron-down" : "codicon-chevron-right");
    this.expandIcon.setAttribute("aria-hidden", "true");
    this.titleElement = dom.$(".todo-list-title");
    this.titleElement.id = "todo-list-title";
    this.titleElement.textContent = localize("chat.todoList.title", "Todos");
    this.clearButtonContainer = dom.$(".todo-clear-button-container");
    this.createClearButton();
    titleSection.appendChild(this.expandIcon);
    titleSection.appendChild(this.titleElement);
    this.expandoButton.element.appendChild(titleSection);
    this.expandoButton.element.appendChild(this.clearButtonContainer);
    this.todoListContainer = dom.$(".todo-list-container");
    this.todoListContainer.style.display = this._isExpanded ? "block" : "none";
    this.todoListContainer.id = "todo-list-container";
    this.todoListContainer.setAttribute("role", "list");
    this.todoListContainer.setAttribute("aria-labelledby", "todo-list-title");
    container.appendChild(expandoContainer);
    container.appendChild(this.todoListContainer);
    this._register(this.expandoButton.onDidClick(() => {
      this.toggleExpanded();
    }));
    return container;
  }
  createClearButton() {
    this.clearButton = new Button(this.clearButtonContainer, {
      supportIcons: true,
      ariaLabel: localize("chat.todoList.clearButton", "Clear all todos")
    });
    this.clearButton.element.tabIndex = 0;
    this.clearButton.icon = Codicon.clearAll;
    this._register(this.clearButton);
    this._register(this.clearButton.onDidClick(() => {
      const todoCount = this._currentSessionResource ? this.chatTodoListService.getTodos(this._currentSessionResource).length : 0;
      this.telemetryService.publicLog2(
        "chatTodoListWidget",
        {
          action: "clear",
          todoCount
        }
      );
      this.clearAllTodos();
    }));
  }
  render(sessionResource) {
    if (!sessionResource) {
      this.hideWidget();
      return;
    }
    if (!isEqual(this._currentSessionResource, sessionResource)) {
      this._userManuallyExpanded = false;
      this._currentSessionResource = sessionResource;
      this.hideWidget();
    }
    this.updateTodoDisplay();
  }
  clear(sessionResource, force = false) {
    if (!sessionResource || this.domNode.style.display === "none") {
      return;
    }
    const currentTodos = this.chatTodoListService.getTodos(sessionResource);
    const shouldClear = force || currentTodos.length > 0 && !currentTodos.some((todo) => todo.status !== "completed");
    if (shouldClear) {
      this.clearAllTodos();
    }
  }
  hasTodos() {
    return this.domNode.classList.contains("has-todos") && !!this._todoList && this._todoList.length > 0;
  }
  hasFocus() {
    return dom.isAncestorOfActiveElement(this.todoListContainer);
  }
  focus() {
    if (!this.hasTodos()) {
      return false;
    }
    if (!this._isExpanded) {
      this.toggleExpanded();
    }
    this._todoList?.domFocus();
    return this.hasFocus();
  }
  updateTodoDisplay() {
    if (!this._currentSessionResource) {
      return;
    }
    const todoList = this.chatTodoListService.getTodos(this._currentSessionResource);
    const shouldShow = todoList.length > 0;
    if (!shouldShow) {
      this.domNode.classList.remove("has-todos");
      this.hideWidget();
      return;
    }
    this.domNode.classList.add("has-todos");
    this.renderTodoList(todoList);
    this.domNode.style.display = "block";
  }
  renderTodoList(todoList) {
    this.updateTitleElement(this.titleElement, todoList);
    const allIncomplete = todoList.every((todo) => todo.status === "not-started");
    if (allIncomplete) {
      this._userManuallyExpanded = false;
    }
    if (!this._todoList) {
      this._todoList = this._register(this.instantiationService.createInstance(
        WorkbenchList,
        "ChatTodoListRenderer",
        this.todoListContainer,
        new TodoListDelegate(),
        [new TodoListRenderer()],
        {
          alwaysConsumeMouseWheel: false,
          accessibilityProvider: {
            getAriaLabel: (todo) => {
              const statusText = this.getStatusText(todo.status);
              return localize("chat.todoList.item", "{0}, {1}", todo.title, statusText);
            },
            getWidgetAriaLabel: () => localize("chatTodoList", "Chat Todo List")
          }
        }
      ));
    }
    const maxItemsShown = 6;
    const itemsShown = Math.min(todoList.length, maxItemsShown);
    const height = itemsShown * 22;
    this._todoList.layout(height);
    this._todoList.getHTMLElement().style.height = `${height}px`;
    this._todoList.splice(0, this._todoList.length, todoList);
    const hasInProgressTask = todoList.some((todo) => todo.status === "in-progress");
    const hasCompletedTask = todoList.some((todo) => todo.status === "completed");
    this.updateClearButtonState();
    if ((hasInProgressTask || hasCompletedTask) && this._isExpanded && !this._userManuallyExpanded) {
      this._isExpanded = false;
      this.expandoButton.element.setAttribute("aria-expanded", "false");
      this.todoListContainer.style.display = "none";
      this.expandIcon.classList.remove("codicon-chevron-down");
      this.expandIcon.classList.add("codicon-chevron-right");
      this.updateTitleElement(this.titleElement, todoList);
    }
  }
  toggleExpanded() {
    this._isExpanded = !this._isExpanded;
    this._userManuallyExpanded = true;
    this.expandIcon.classList.toggle("codicon-chevron-down", this._isExpanded);
    this.expandIcon.classList.toggle("codicon-chevron-right", !this._isExpanded);
    this.todoListContainer.style.display = this._isExpanded ? "block" : "none";
    const todoCount = this._currentSessionResource ? this.chatTodoListService.getTodos(this._currentSessionResource).length : 0;
    this.telemetryService.publicLog2(
      "chatTodoListWidget",
      {
        action: this._isExpanded ? "expand" : "collapse",
        todoCount
      }
    );
    if (this._currentSessionResource) {
      const todoList = this.chatTodoListService.getTodos(this._currentSessionResource);
      this.updateTitleElement(this.titleElement, todoList);
    }
  }
  clearAllTodos() {
    if (!this._currentSessionResource) {
      return;
    }
    this.chatTodoListService.setTodos(this._currentSessionResource, []);
    this.hideWidget();
  }
  updateClearButtonState() {
    if (!this._currentSessionResource) {
      return;
    }
    const todoList = this.chatTodoListService.getTodos(this._currentSessionResource);
    const hasInProgressTask = todoList.some((todo) => todo.status === "in-progress");
    const isRequestInProgress = ChatContextKeys.requestInProgress.getValue(this.contextKeyService) ?? false;
    const shouldDisable = isRequestInProgress && hasInProgressTask;
    this.clearButton.enabled = !shouldDisable;
    if (shouldDisable) {
      this.clearButton.setTitle(localize("chat.todoList.clearButton.disabled", "Cannot clear todos while a task is in progress"));
    } else {
      this.clearButton.setTitle(localize("chat.todoList.clearButton", "Clear all todos"));
    }
  }
  updateTitleElement(titleElement, todoList) {
    titleElement.textContent = "";
    const completedCount = todoList.filter((todo) => todo.status === "completed").length;
    const totalCount = todoList.length;
    const inProgressTodos = todoList.filter((todo) => todo.status === "in-progress");
    const firstInProgressTodo = inProgressTodos.length > 0 ? inProgressTodos[0] : void 0;
    const notStartedTodos = todoList.filter((todo) => todo.status === "not-started");
    const firstNotStartedTodo = notStartedTodos.length > 0 ? notStartedTodos[0] : void 0;
    const currentTaskNumber = inProgressTodos.length > 0 ? completedCount + 1 : Math.max(1, completedCount);
    const expandButtonLabel = this._isExpanded ? localize("chat.todoList.collapseButton", "Collapse Todos") : localize("chat.todoList.expandButton", "Expand Todos");
    this.expandoButton.element.setAttribute("aria-label", expandButtonLabel);
    this.expandoButton.element.setAttribute("aria-expanded", this._isExpanded ? "true" : "false");
    if (this._isExpanded) {
      const titleText = dom.$("span");
      titleText.textContent = totalCount > 0 ? localize("chat.todoList.titleWithCount", "Todos ({0}/{1})", currentTaskNumber, totalCount) : localize("chat.todoList.title", "Todos");
      titleElement.appendChild(titleText);
    } else {
      const todoToShow = firstInProgressTodo || firstNotStartedTodo;
      if (todoToShow) {
        const icon = dom.$(".codicon");
        if (todoToShow === firstInProgressTodo) {
          icon.classList.add("codicon-record");
          icon.style.color = "var(--vscode-charts-blue)";
        } else {
          icon.classList.add("codicon-circle-outline");
          icon.style.color = "var(--vscode-foreground)";
        }
        icon.style.marginRight = "4px";
        icon.style.verticalAlign = "middle";
        titleElement.appendChild(icon);
        const todoText = dom.$("span");
        todoText.textContent = localize("chat.todoList.currentTask", "{0} ({1}/{2})", todoToShow.title, currentTaskNumber, totalCount);
        todoText.style.verticalAlign = "middle";
        todoText.style.overflow = "hidden";
        todoText.style.textOverflow = "ellipsis";
        todoText.style.whiteSpace = "nowrap";
        todoText.style.minWidth = "0";
        titleElement.appendChild(todoText);
      } else if (completedCount > 0 && completedCount === totalCount) {
        const doneText = dom.$("span");
        doneText.textContent = localize("chat.todoList.titleWithCount", "Todos ({0}/{1})", totalCount, totalCount);
        doneText.style.verticalAlign = "middle";
        titleElement.appendChild(doneText);
      }
    }
  }
  getStatusText(status) {
    switch (status) {
      case "completed":
        return localize("chat.todoList.status.completed", "completed");
      case "in-progress":
        return localize("chat.todoList.status.inProgress", "in progress");
      case "not-started":
      default:
        return localize("chat.todoList.status.notStarted", "not started");
    }
  }
};
ChatTodoListWidget = __decorateClass([
  __decorateParam(0, IChatTodoListService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ITelemetryService)
], ChatTodoListWidget);
export {
  ChatTodoListWidget
};
