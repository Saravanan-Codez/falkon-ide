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
import "./media/surveyEditorPane.css";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { shuffle } from "../../../../base/common/arrays.js";
import { $, addDisposableListener, append, clearNode } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { SurveyQuestionType } from "./surveyQuestions.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
let SurveyEditorPane = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, editorService) {
    super(SurveyEditorPane.ID, group, telemetryService, themeService, storageService);
    this.editorService = editorService;
    this.inputDisposables = this._register(new DisposableStore());
    this.answers = /* @__PURE__ */ new Map();
    this.renderNonce = 0;
  }
  static {
    this.ID = "workbench.editor.survey";
  }
  createEditor(parent) {
    this.container = append(parent, $("div.survey-editor-pane"));
    this.container.setAttribute("role", "form");
    this.container.setAttribute("aria-label", localize("survey.pane.ariaLabel", "Survey"));
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (token.isCancellationRequested || !this.container) {
      return;
    }
    this.resetState();
    this.renderForm(this.container, input.survey);
  }
  clearInput() {
    this.resetState();
    super.clearInput();
  }
  resetState() {
    this.inputDisposables.clear();
    this.answers.clear();
    this.firstInput = void 0;
    this.renderNonce++;
    if (this.container) {
      clearNode(this.container);
    }
  }
  renderForm(container, survey) {
    const form = append(container, $("div.survey-form"));
    const title = append(form, $("div.survey-title"));
    const titleIcon = append(title, $("span.survey-title-icon"));
    titleIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.sparkle));
    titleIcon.setAttribute("aria-hidden", "true");
    const titleText = append(title, $("span"));
    titleText.textContent = survey.title;
    const description = append(form, $("div.survey-description"));
    description.textContent = survey.description;
    for (const question of survey.questions) {
      this.renderQuestion(form, question);
    }
    const submitRow = append(form, $("div.survey-submit-row"));
    const submitButton = this.inputDisposables.add(new Button(submitRow, { ...defaultButtonStyles }));
    submitButton.label = localize("survey.submitFeedback", "Submit feedback");
    submitButton.enabled = false;
    const hintId = `survey-hint-${this.renderNonce}`;
    const hint = append(submitRow, $("div.survey-submit-hint"));
    hint.id = hintId;
    hint.textContent = localize("survey.submitHint", "Answer the required question to submit");
    submitButton.element.setAttribute("aria-describedby", hintId);
    const requiredQuestionIds = survey.questions.filter((q) => q.required).map((q) => q.id);
    const updateSubmitState = () => {
      const allRequiredAnswered = requiredQuestionIds.every((id) => {
        const answer = this.answers.get(id);
        return answer && answer.length > 0;
      });
      submitButton.enabled = allRequiredAnswered;
      hint.style.display = allRequiredAnswered ? "none" : "";
    };
    this.inputDisposables.add(submitButton.onDidClick(() => {
      submitButton.enabled = false;
      this.handleSubmit(container, survey);
    }));
    this.inputDisposables.add(addDisposableListener(form, "change", () => {
      updateSubmitState();
    }));
  }
  renderQuestion(parent, question) {
    const questionEl = append(parent, $("div.survey-question"));
    const labelId = `survey-q-${this.renderNonce}-${question.id}`;
    const label = append(questionEl, $("div.survey-question-label"));
    label.id = labelId;
    label.textContent = question.required ? question.label : localize("survey.questionOptional", "{0} (optional)", question.label);
    const namePrefix = `${this.renderNonce}-${question.id}`;
    switch (question.type) {
      case SurveyQuestionType.Segment:
        this.renderSegmentQuestion(questionEl, question, labelId, namePrefix);
        break;
      case SurveyQuestionType.Radio:
        this.renderListQuestion(questionEl, question, labelId, namePrefix);
        break;
    }
  }
  renderSegmentQuestion(parent, question, labelId, namePrefix) {
    const group = append(parent, $("div.survey-segment-group"));
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", labelId);
    if (question.required) {
      group.setAttribute("aria-required", "true");
    }
    for (let i = 0; i < question.options.length; i++) {
      const option = question.options[i];
      const radio = append(group, $("input.survey-segment-input"));
      radio.type = "radio";
      radio.name = namePrefix;
      radio.value = option.id;
      radio.id = `survey-seg-${namePrefix}-${i}`;
      if (!this.firstInput) {
        this.firstInput = radio;
      }
      const optionLabel = append(group, $("label.survey-segment-label"));
      optionLabel.htmlFor = radio.id;
      optionLabel.textContent = option.label;
      this.inputDisposables.add(addDisposableListener(radio, "change", () => {
        if (radio.checked) {
          this.answers.set(question.id, [option.id]);
        }
      }));
    }
  }
  renderListQuestion(parent, question, labelId, namePrefix) {
    const group = append(parent, $("div.survey-list-group"));
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", labelId);
    if (question.required) {
      group.setAttribute("aria-required", "true");
    }
    if (question.columns === 2) {
      group.classList.add("columns-2");
    }
    const options = question.shuffleOptions ? shuffleOptionsExceptLast(question.options) : question.options;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const optionLabel = append(group, $("label.survey-list-option"));
      const radio = append(optionLabel, $("input.survey-list-input"));
      radio.type = "radio";
      radio.name = namePrefix;
      radio.value = option.id;
      if (!this.firstInput) {
        this.firstInput = radio;
      }
      const text = append(optionLabel, $("span"));
      text.textContent = option.label;
      this.inputDisposables.add(addDisposableListener(radio, "change", () => {
        if (radio.checked) {
          this.answers.set(question.id, [option.id]);
        }
      }));
    }
  }
  handleSubmit(container, survey) {
    const answersSnapshot = {};
    for (const [key, value] of this.answers) {
      answersSnapshot[key] = [...value];
    }
    let score = -1;
    let primaryBenefit = "";
    let primaryFriction = "";
    let programmingExperience = -1;
    for (const question of survey.questions) {
      if (!question.telemetryKey) {
        continue;
      }
      const answer = answersSnapshot[question.id]?.[0] ?? "";
      if (question.asMeasurement) {
        const index = answer ? question.options.findIndex((o) => o.id === answer) : -1;
        switch (question.telemetryKey) {
          case "score":
            score = index;
            break;
          case "programmingExperience":
            programmingExperience = index;
            break;
        }
      } else {
        switch (question.telemetryKey) {
          case "primaryBenefit":
            primaryBenefit = answer;
            break;
          case "primaryFriction":
            primaryFriction = answer;
            break;
        }
      }
    }
    const source = this.input?.source ?? "";
    this.telemetryService.publicLog2("survey/submit", {
      surveyId: survey.id,
      source,
      score,
      primaryBenefit,
      primaryFriction,
      programmingExperience
    });
    const submittedInput = this.input;
    this.showSuccess(container, submittedInput);
  }
  showSuccess(container, submittedInput) {
    clearNode(container);
    const success = append(container, $("div.survey-success"));
    success.setAttribute("role", "status");
    success.setAttribute("aria-live", "polite");
    const icon = append(success, $("div.survey-success-icon"));
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.checkAll));
    icon.setAttribute("aria-hidden", "true");
    const successMessage = localize("survey.success.message", "Response sent");
    const message = append(success, $("div.survey-success-message"));
    message.textContent = successMessage;
    const detail = append(success, $("div.survey-success-detail"));
    detail.textContent = localize("survey.success.detail", "Your answer helps us understand who needs this most. Thank you.");
    status(successMessage);
    success.tabIndex = -1;
    success.focus();
    const timeout = setTimeout(() => {
      if (submittedInput) {
        this.editorService.closeEditor({ editor: submittedInput, groupId: this.group.id }).catch(onUnexpectedError);
      }
    }, 5e3);
    this.inputDisposables.add({ dispose: () => clearTimeout(timeout) });
  }
  focus() {
    super.focus();
    this.firstInput?.focus();
  }
  layout() {
  }
};
SurveyEditorPane = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IEditorService)
], SurveyEditorPane);
function shuffleOptionsExceptLast(options) {
  if (options.length < 2) {
    return options;
  }
  const shuffledOptions = options.slice(0, -1);
  shuffle(shuffledOptions);
  return [...shuffledOptions, options[options.length - 1]];
}
export {
  SurveyEditorPane
};
