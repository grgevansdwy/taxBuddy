// Stages that actually have a built route. lib/types.ts's Stage type also
// lists "review"/"file" for later, but nothing routes there yet.
export const ONBOARDING_STEPS = [
  { stage: "eligibility", route: "/onboarding/eligibility", label: "Eligibility" },
  { stage: "profile", route: "/onboarding/profile", label: "Profile" },
  { stage: "interview", route: "/onboarding/interview", label: "Interview" },
  { stage: "documents", route: "/onboarding/documents", label: "Documents" },
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
