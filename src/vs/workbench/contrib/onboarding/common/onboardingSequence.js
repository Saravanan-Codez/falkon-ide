const ONBOARDING_SEQUENCE_PRESENTATION_KIND = "sequence";
class OnboardingSequenceStepPresentationRegistry {
  constructor() {
    this._presentations = /* @__PURE__ */ new Map();
  }
  register(presentation) {
    if (this._presentations.has(presentation.kind)) {
      throw new Error(`An onboarding sequence step presentation with kind '${presentation.kind}' is already registered.`);
    }
    this._presentations.set(presentation.kind, presentation);
    return {
      dispose: () => {
        if (this._presentations.get(presentation.kind) === presentation) {
          this._presentations.delete(presentation.kind);
        }
      }
    };
  }
  get(kind) {
    return this._presentations.get(kind);
  }
}
const onboardingSequenceStepPresentationRegistry = new OnboardingSequenceStepPresentationRegistry();
export {
  ONBOARDING_SEQUENCE_PRESENTATION_KIND,
  onboardingSequenceStepPresentationRegistry
};
