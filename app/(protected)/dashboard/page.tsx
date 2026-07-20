import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { isAdmin } from "@/lib/config/admin";
import { ONBOARDING_STEPS, routeForStage } from "@/lib/config/onboarding";
import { DOC_LABELS } from "@/lib/config/docLabels";
import { formatIsoDate } from "@/lib/format";
import { PdfViewer } from "@/components/pdf-viewer";
import type {
  DocType,
  EligibilityPageData,
  ResidencyResult,
} from "@/lib/types";

interface FilingRow {
  stage: string;
  eligibility_page: EligibilityPageData | null;
  documents_needed: DocType[] | null;
}

function ResidencySnapshot({ residency }: { residency: ResidencyResult }) {
  const visaClass = residency.visaHistory[CURRENT_SUPPORTED_TAX_YEAR] ?? "—";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Residency snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between border-b border-dashed border-border pb-2">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium tabular-nums">
            {visaClass}, nonresident
          </span>
        </div>
        <div className="flex justify-between border-b border-dashed border-border pb-2">
          <span className="text-muted-foreground">First entry</span>
          <span className="font-medium tabular-nums">
            {formatIsoDate(residency.firstEntryDate, "—")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Exempt year</span>
          <span className="font-medium tabular-nums">
            {residency.exemptYearsUsed} of 5
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StageTracker({ stage }: { stage: string }) {
  // "file" isn't one of the wizard steps (it's the terminal state after
  // them), so every step reads as done rather than falling through to
  // "pending" because findIndex returns -1 for it.
  const currentIndex =
    stage === "file"
      ? ONBOARDING_STEPS.length
      : ONBOARDING_STEPS.findIndex((step) => step.stage === stage);
  return (
    <div className="grid grid-cols-4 gap-3">
      {ONBOARDING_STEPS.map((step, index) => {
        const status =
          index < currentIndex
            ? "done"
            : index === currentIndex
              ? "current"
              : "pending";
        const bar = (
          <div
            className={
              status === "done"
                ? "h-1 rounded-full bg-accent-foreground"
                : status === "current"
                  ? "h-1 rounded-full bg-primary"
                  : "h-1 rounded-full bg-muted"
            }
          />
        );
        const label = (
          <p
            className={
              status === "pending"
                ? "mt-2 text-xs font-medium text-muted-foreground"
                : "mt-2 text-xs font-medium text-foreground"
            }
          >
            {step.label}
          </p>
        );
        if (status === "done") {
          return (
            <Link
              key={step.stage}
              href={step.route}
              aria-label={`Go back to ${step.label} to review or edit your answers`}
              className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {bar}
              {label}
            </Link>
          );
        }
        return (
          <div key={step.stage}>
            {bar}
            {label}
          </div>
        );
      })}
    </div>
  );
}

// The whole return is one combined PDF now — no per-form downloads. It's shown
// inline in an embedded viewer (read without downloading) and downloadable from
// the viewer's toolbar.
function ReadyToFileCard() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-lg font-semibold text-foreground">
          Your tax return is ready
        </p>
        <p className="text-sm text-muted-foreground">
          Review the full return below, then download it and mail the pages
          together.
        </p>
      </div>
      <PdfViewer
        url="/api/documents/generate/packet?inline=1"
        downloadUrl="/api/documents/generate/packet"
      />
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: filing } = await supabase
    .from("filings")
    .select("stage, eligibility_page, documents_needed")
    .eq("user_id", user.id)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle<FilingRow>();

  const stage = filing?.stage ?? "eligibility";

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-bold text-primary">TaxBuddy</span>
        <nav className="flex items-center gap-1 sm:gap-2">
          {isAdmin(user.email) && (
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                Admin
              </Button>
            </Link>
          )}
          <Link href="/">
            <Button variant="ghost" size="sm">
              Home
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="ghost" size="sm">
              Contact Us
            </Button>
          </Link>
          <form action={signOut}>
            <Button type="submit" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </header>

      {stage === "eligibility" ? (
        <main className="relative flex flex-1 items-center overflow-hidden py-10">
          <div className="relative z-10 max-w-md space-y-6 px-6 lg:pl-16">
            <h1 className="whitespace-nowrap text-4xl font-semibold tracking-tight text-foreground xl:text-5xl 2xl:text-6xl">
              Let&apos;s find your refund
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground whitespace-nowrap">
              File in 10 minutes, with zero tax knowledge needed.
            </p>
            <Link href="/onboarding/eligibility">
              <Button size="lg">Start filing →</Button>
            </Link>
          </div>
          {/* Bleeds off the right edge (rounded on the left only), like the
              reference hero. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img-2.jpg"
            alt=""
            className="absolute right-0 top-1/2 hidden h-[80vh] w-[48vw] -translate-y-1/2 rounded-l-[2rem] border border-border object-cover shadow-sm lg:block"
          />
        </main>
      ) : (
        <main className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-xl space-y-6">
            {stage === "blocked" ? (
              <Card>
                <CardHeader>
                  <CardTitle>We can&apos;t support this yet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">
                    {filing?.eligibility_page?.residency?.reasoning ??
                      "Something about your situation isn't supported yet — check your eligibility answers."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Tax year {CURRENT_SUPPORTED_TAX_YEAR}
                  </p>
                  <p className="text-2xl font-semibold text-foreground">
                    {stage === "file" ? "You're all set" : "Welcome back"}
                  </p>
                </div>

                <StageTracker stage={stage} />

                {stage === "file" ? (
                  <ReadyToFileCard />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Pick up where you left off</CardTitle>
                      <CardDescription>
                        {ONBOARDING_STEPS.find((step) => step.stage === stage)
                          ?.label ?? "Next step"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={routeForStage(stage)}>
                        <Button className="w-full">Continue →</Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}

                {filing?.eligibility_page?.residency && (
                  <ResidencySnapshot
                    residency={filing.eligibility_page.residency}
                  />
                )}

                {stage === "documents" && filing?.documents_needed && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Documents needed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {filing.documents_needed
                          .filter((doc) => DOC_LABELS[doc])
                          .map((doc) => (
                            <Badge key={doc} variant="outline">
                              {DOC_LABELS[doc]}
                            </Badge>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
