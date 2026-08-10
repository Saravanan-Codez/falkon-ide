class OnboardingPresentationRegistry {
  constructor() {
    this._presentations = /* @__PURE__ */ new Map();
  }
  register(presentation) {
    const kind = presentation.kind;
    if (this._presentations.has(kind)) {
      throw new Error(`An onboarding presentation with kind '${kind}' is already registered.`);
    }
    this._presentations.set(kind, presentation);
    return {
      dispose: () => {
        if (this._presentations.get(kind) === presentation) {
          this._presentations.delete(kind);
        }
      }
    };
  }
  get(kind) {
    return this._presentations.get(kind);
  }
}
const onboardingPresentationRegistry = new OnboardingPresentationRegistry();
export {
  onboardingPresentationRegistry
};
