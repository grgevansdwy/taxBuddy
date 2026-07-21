import Link from "next/link";
import { Button } from "@/components/ui/button";
import { previousRouteForStep } from "@/lib/config/onboarding";

export function WizardNavRow({
  step,
  onContinue,
  continueLabel,
  disabled,
  onBack,
}: {
  step: number;
  onContinue: () => void;
  continueLabel: string;
  disabled?: boolean;
  // When provided, Back runs this handler instead of navigating to the previous
  // step's route — used for in-page sub-steps (e.g. eligibility questions →
  // document upload) so a user can return to fix a wrong file.
  onBack?: () => void;
}) {
  return (
    <div className="flex gap-3">
      {onBack ? (
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onBack}
        >
          ← Back
        </Button>
      ) : (
        <Link href={previousRouteForStep(step)} className="flex-1">
          <Button type="button" variant="outline" className="w-full">
            ← Back
          </Button>
        </Link>
      )}
      <Button className="flex-1" onClick={onContinue} disabled={disabled}>
        {continueLabel}
      </Button>
    </div>
  );
}

export function WizardBackOnly({ step }: { step: number }) {
  return (
    <Link href={previousRouteForStep(step)}>
      <Button type="button" variant="outline" className="w-full">
        ← Back
      </Button>
    </Link>
  );
}
