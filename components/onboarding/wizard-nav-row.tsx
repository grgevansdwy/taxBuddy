import Link from "next/link";
import { Button } from "@/components/ui/button";
import { previousRouteForStep } from "@/lib/config/onboarding";

export function WizardNavRow({
  step,
  onContinue,
  continueLabel,
  disabled,
}: {
  step: number;
  onContinue: () => void;
  continueLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Link href={previousRouteForStep(step)} className="flex-1">
        <Button type="button" variant="outline" className="w-full">
          ← Back
        </Button>
      </Link>
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
