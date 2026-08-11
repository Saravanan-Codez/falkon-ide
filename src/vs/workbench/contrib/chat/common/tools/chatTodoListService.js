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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { Memento } from "../../../../common/memento.js";
import { chatSessionResourceToId } from "../model/chatUri.js";
const IChatTodoListService = createDecorator("chatTodoListService");
let ChatTodoListStorage = class {
  constructor(storageService) {
    this.memento = new Memento("chat-todo-list", storageService);
  }
  getSessionData(sessionResource) {
    const storage = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    return storage[this.toKey(sessionResource)] || [];
  }
  setSessionData(sessionResource, todoList) {
    const storage = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    storage[this.toKey(sessionResource)] = todoList;
    this.memento.saveMemento();
  }
  getTodoList(sessionResource) {
    return this.getSessionData(sessionResource);
  }
  setTodoList(sessionResource, todoList) {
    this.setSessionData(sessionResource, todoList);
  }
  migrateTodoList(oldSessionResource, newSessionResource) {
    const todos = this.getSessionData(oldSessionResource);
    if (todos.length > 0) {
      this.setSessionData(newSessionResource, todos);
      const storage = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
      delete storage[this.toKey(oldSessionResource)];
      this.memento.saveMemento();
    }
  }
  toKey(sessionResource) {
    return chatSessionResourceToId(sessionResource);
  }
};
ChatTodoListStorage = __decorateClass([
  __decorateParam(0, IStorageService)
], ChatTodoListStorage);
let ChatTodoListService = class extends Disposable {
  constructor(storageService) {
    super();
    this._onDidUpdateTodos = this._register(new Emitter());
    this.onDidUpdateTodos = this._onDidUpdateTodos.event;
    this.todoListStorage = new ChatTodoListStorage(storageService);
  }
  getTodos(sessionResource) {
    return this.todoListStorage.getTodoList(sessionResource);
  }
  setTodos(sessionResource, todos) {
    this.todoListStorage.setTodoList(sessionResource, todos);
    this._onDidUpdateTodos.fire(sessionResource);
  }
  migrateTodos(oldSessionResource, newSessionResource) {
    this.todoListStorage.migrateTodoList(oldSessionResource, newSessionResource);
    this._onDidUpdateTodos.fire(newSessionResource);
  }
};
ChatTodoListService = __decorateClass([
  __decorateParam(0, IStorageService)
], ChatTodoListService);
export {
  ChatTodoListService,
  ChatTodoListStorage,
  IChatTodoListService
};
