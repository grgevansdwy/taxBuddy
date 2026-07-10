import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function WizardShell({
  step,
  totalSteps,
  title,
  description,
  children,
}: {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-bold text-primary">TaxBuddy</span>
        <span className="text-sm text-muted-foreground">
          Step {step} of {totalSteps}
        </span>
      </header>

      <main className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-xl space-y-6">
          <Progress value={(step / totalSteps) * 100} />
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6">{children}</CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
