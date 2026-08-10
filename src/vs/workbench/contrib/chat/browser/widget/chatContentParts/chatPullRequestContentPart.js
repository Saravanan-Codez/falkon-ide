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
import "./media/chatPullRequestContent.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { addDisposableListener } from "../../../../../../base/browser/dom.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
let ChatPullRequestContentPart = class extends Disposable {
  constructor(pullRequestContent, commandService) {
    super();
    this.pullRequestContent = pullRequestContent;
    this.commandService = commandService;
    this.domNode = dom.$(".chat-pull-request-content-part");
    const container = dom.append(this.domNode, dom.$(".container"));
    const contentContainer = dom.append(container, dom.$(".content-container"));
    const titleContainer = dom.append(contentContainer, dom.$(".title-container"));
    const icon = dom.append(titleContainer, dom.$(".icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.gitPullRequest));
    const titleLink = dom.append(titleContainer, dom.$("a.title"));
    titleLink.textContent = `${this.pullRequestContent.title} - ${this.pullRequestContent.author}`;
    if (this.pullRequestContent.uri) {
      titleLink.href = this.pullRequestContent.uri?.toString();
    }
    this._register(addDisposableListener(titleLink, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.commandService.executeCommand(this.pullRequestContent.command.id, ...this.pullRequestContent.command.arguments ?? []);
    }));
  }
  hasSameContent(other, followingContent, element) {
    return other.kind === "pullRequest";
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatPullRequestContentPart = __decorateClass([
  __decorateParam(1, ICommandService)
], ChatPullRequestContentPart);
export {
  ChatPullRequestContentPart
};
