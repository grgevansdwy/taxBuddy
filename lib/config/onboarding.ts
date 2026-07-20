// Stages that actually have a built route. lib/types.ts's Stage type also
// lists "review"/"file" for later, but nothing routes there yet.
export const ONBOARDING_STEPS = [
  // Documents + the eligibility questions that don't depend on them.
  { stage: "eligibility", route: "/onboarding/eligibility", label: "Eligibility" },
  { stage: "profile", route: "/onboarding/profile", label: "Profile" },
  // The document-derived confirmation (visa/entry/passport) + the actual
  // eligibility decision — placed after profile so the uploads finish reading
  // while the independent questions and profile are being filled in.
  { stage: "confirm", route: "/onboarding/confirm", label: "Confirm" },
  // Last step: income questions, income-doc uploads, and filing itself. There's
  // no separate documents/review step — everything is uploaded inline by here.
  { stage: "interview", route: "/onboarding/interview", label: "Interview" },
] as const;

export type OnboardingStage = (typeof ONBOARDING_STEPS)[number]["stage"];

export function routeForStage(stage: string): string {
  return ONBOARDING_STEPS.find((step) => step.stage === stage)?.route ?? ONBOARDING_STEPS[0].route;
}

// step is 1-indexed (matches WizardShell's `step` prop). Step 1 has no
// previous onboarding page, so it goes back to the dashboard instead.
export function previousRouteForStep(step: number): string {
  return step > 1 ? ONBOARDING_STEPS[step - 2].route : "/dashboard";
}
