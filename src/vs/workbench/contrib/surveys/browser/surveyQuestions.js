import { localize } from "../../../../nls.js";
var SurveyQuestionType = /* @__PURE__ */ ((SurveyQuestionType2) => {
  SurveyQuestionType2["Segment"] = "segment";
  SurveyQuestionType2["Radio"] = "radio";
  return SurveyQuestionType2;
})(SurveyQuestionType || {});
const CopilotPMFSurvey = {
  id: "copilot-pmf",
  title: localize("survey.copilotPmf.title", "Help Us Improve GitHub Copilot"),
  description: localize("survey.copilotPmf.description", "This short survey helps us understand how well Copilot fits into your workflow."),
  questions: [
    {
      type: "segment" /* Segment */,
      id: "disappointment",
      required: true,
      telemetryKey: "score",
      asMeasurement: true,
      label: localize("survey.copilotPmf.q1", "How disappointed would you be if you could no longer use Copilot?"),
      options: [
        { id: "not-at-all", label: localize("survey.copilotPmf.q1.notAtAll", "Not at all") },
        { id: "slightly", label: localize("survey.copilotPmf.q1.slightly", "Slightly") },
        { id: "somewhat", label: localize("survey.copilotPmf.q1.somewhat", "Somewhat") },
        { id: "very", label: localize("survey.copilotPmf.q1.very", "Very") },
        { id: "extremely", label: localize("survey.copilotPmf.q1.extremely", "Extremely") }
      ]
    },
    {
      type: "radio" /* Radio */,
      id: "primary-benefit",
      telemetryKey: "primaryBenefit",
      label: localize("survey.copilotPmf.q2", "What has Copilot helped you with most recently?"),
      columns: 2,
      shuffleOptions: true,
      options: [
        { id: "shipping-faster", label: localize("survey.copilotPmf.q2.shippingFaster", "Shipping changes faster") },
        { id: "getting-unstuck", label: localize("survey.copilotPmf.q2.gettingUnstuck", "Getting unstuck on bugs") },
        { id: "multi-file", label: localize("survey.copilotPmf.q2.multiFile", "Making multi-file changes") },
        { id: "automating", label: localize("survey.copilotPmf.q2.automating", "Automating repetitive work") },
        { id: "understanding", label: localize("survey.copilotPmf.q2.understanding", "Understanding the codebase") },
        { id: "planning", label: localize("survey.copilotPmf.q2.planning", "Planning an approach") },
        { id: "reviewing", label: localize("survey.copilotPmf.q2.reviewing", "Improving or reviewing code") },
        { id: "no-clear-value", label: localize("survey.copilotPmf.q2.noClearValue", "I haven't gotten clear value yet") },
        { id: "other", label: localize("survey.copilotPmf.q2.other", "None of the above") }
      ]
    },
    {
      type: "radio" /* Radio */,
      id: "primary-friction",
      telemetryKey: "primaryFriction",
      label: localize("survey.copilotPmf.q3", "What most gets in your way?"),
      columns: 2,
      shuffleOptions: true,
      options: [
        { id: "trust", label: localize("survey.copilotPmf.q3.trust", "Output is hard to trust") },
        { id: "context", label: localize("survey.copilotPmf.q3.context", "Missing repo or project context") },
        { id: "bigger-tasks", label: localize("survey.copilotPmf.q3.biggerTasks", "Struggles with bigger tasks") },
        { id: "reviewing-time", label: localize("survey.copilotPmf.q3.reviewingTime", "Too much time reviewing") },
        { id: "steering", label: localize("survey.copilotPmf.q3.steering", "Too much steering needed") },
        { id: "slow", label: localize("survey.copilotPmf.q3.slow", "Too slow / breaks flow") },
        { id: "setup", label: localize("survey.copilotPmf.q3.setup", "Setup or integrations are hard") },
        { id: "security", label: localize("survey.copilotPmf.q3.security", "Security or permissions friction") },
        { id: "cost", label: localize("survey.copilotPmf.q3.cost", "Limits, cost, or billing") },
        { id: "other", label: localize("survey.copilotPmf.q3.other", "None of the above") }
      ]
    },
    {
      type: "segment" /* Segment */,
      id: "programming-experience",
      telemetryKey: "programmingExperience",
      asMeasurement: true,
      label: localize("survey.copilotPmf.q4", "How long have you been programming?"),
      options: [
        { id: "less-than-3", label: localize("survey.copilotPmf.q4.lessThan3", "<3 yr") },
        { id: "3-to-5", label: localize("survey.copilotPmf.q4.3to5", "3-5 yr") },
        { id: "6-to-9", label: localize("survey.copilotPmf.q4.6to9", "6-9 yr") },
        { id: "10-to-19", label: localize("survey.copilotPmf.q4.10to19", "10-19 yr") },
        { id: "20-plus", label: localize("survey.copilotPmf.q4.20plus", "20+ yr") }
      ]
    }
  ]
};
export {
  CopilotPMFSurvey,
  SurveyQuestionType
};
