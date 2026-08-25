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
import "./media/agentFeedbackAttachment.css";
import * as dom from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as event from "../../../../base/common/event.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { AgentFeedbackHover } from "./agentFeedbackHover.js";
let AgentFeedbackAttachmentWidget = class extends Disposable {
  constructor(_attachment, options, container, _instantiationService) {
    super();
    this._attachment = _attachment;
    this._instantiationService = _instantiationService;
    this._onDidDelete = this._store.add(new event.Emitter());
    this.onDidDelete = this._onDidDelete.event;
    this._onDidOpen = this._store.add(new event.Emitter());
    this.onDidOpen = this._onDidOpen.event;
    this.element = dom.append(container, dom.$(".chat-attached-context-attachment.agent-feedback-attachment"));
    this.element.tabIndex = 0;
    this.element.role = "button";
    const iconSpan = dom.$("span");
    iconSpan.classList.add(...ThemeIcon.asClassNameArray(Codicon.comment));
    const pillIcon = dom.$("div.chat-attached-context-pill", {}, iconSpan);
    this.element.appendChild(pillIcon);
    const label = dom.$("span.chat-attached-context-custom-text", {}, this._attachment.name);
    this.element.appendChild(label);
    const deletionCurrentlyNotSupported = true;
    if (options.supportsDeletion && !deletionCurrentlyNotSupported) {
      const clearBtn = dom.append(this.element, dom.$(".chat-attached-context-clear-button"));
      const clearIcon = dom.$("span");
      clearIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.closeCompact));
      clearBtn.appendChild(clearIcon);
      clearBtn.title = localize("removeAttachment", "Remove");
      this._store.add(dom.addDisposableListener(clearBtn, dom.EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._onDidDelete.fire(e);
      }));
      if (options.shouldFocusClearButton) {
        clearBtn.focus();
      }
    }
    this.element.ariaLabel = localize("chat.agentFeedback", "Attached agent feedback, {0}", this._attachment.name);
    this._store.add(this._instantiationService.createInstance(AgentFeedbackHover, this.element, this._attachment, options.supportsDeletion));
  }
};
AgentFeedbackAttachmentWidget = __decorateClass([
  __decorateParam(3, IInstantiationService)
], AgentFeedbackAttachmentWidget);
export {
  AgentFeedbackAttachmentWidget
};
