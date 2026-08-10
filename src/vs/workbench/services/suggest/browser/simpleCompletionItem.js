import { FuzzyScore } from "../../../../base/common/filters.js";
class SimpleCompletionItem {
  constructor(completion) {
    this.completion = completion;
    // sorting, filtering
    this.score = FuzzyScore.Default;
    // validation
    this.isInvalid = false;
    this.textLabel = typeof completion.label === "string" ? completion.label : completion.label?.label;
    this.labelLow = this.textLabel.toLowerCase();
  }
}
export {
  SimpleCompletionItem
};
