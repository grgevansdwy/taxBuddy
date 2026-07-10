import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CURRENT_SUPPORTED_TAX_YEAR } from '@/lib/config/taxYear'
import { ONBOARDING_STEPS, routeForStage } from '@/lib/config/onboarding'
import { DOC_LABELS } from '@/lib/config/docLabels'
import { formatIsoDate } from '@/lib/format'
import type { DocType, ResidencyResult } from '@/lib/types'

interface FilingRow {
  stage: string
  residency: ResidencyResult | null
  documents_needed: DocType[] | null
}

function ResidencySnapshot({ residency }: { residency: ResidencyResult }) {
  const visaClass = residency.visaHistory[CURRENT_SUPPORTED_TAX_YEAR] ?? '—'
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
          <span className="font-medium tabular-nums">{visaClass}, nonresident</span>
        </div>
        <div className="flex justify-between border-b border-dashed border-border pb-2">
          <span className="text-muted-foreground">First entry</span>
          <span className="font-medium tabular-nums">{formatIsoDate(residency.firstEntryDate, '—')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Exempt year</span>
          <span className="font-medium tabular-nums">{residency.exemptYearsUsed} of 5</span>
        </div>
      </CardContent>
    </Card>
  )
}

function StageTracker({ stage }: { stage: string }) {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.stage === stage)
  return (
    <div className="grid grid-cols-4 gap-3">
      {ONBOARDING_STEPS.map((step, index) => {
        const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'
        const bar = (
          <div
            className={
              status === 'done'
                ? 'h-1 rounded-full bg-accent-foreground'
                : status === 'current'
                  ? 'h-1 rounded-full bg-primary'
                  : 'h-1 rounded-full bg-muted'
            }
          />
        )
        const label = (
          <p className={status === 'pending' ? 'mt-2 text-xs font-medium text-muted-foreground' : 'mt-2 text-xs font-medium text-foreground'}>
            {step.label}
          </p>
        )
        if (status === 'done') {
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
          )
        }
        return (
          <div key={step.stage}>
            {bar}
            {label}
          </div>
        )
      })}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: filing } = await supabase
    .from('filings')
    .select('stage, residency, documents_needed')
    .eq('user_id', user.id)
    .eq('tax_year', CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle<FilingRow>()

  const stage = filing?.stage ?? 'eligibility'

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-bold text-primary">TaxBuddy</span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <main className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-xl space-y-6">
          {stage === 'blocked' ? (
            <Card>
              <CardHeader>
                <CardTitle>We can&apos;t support this yet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">
                  {filing?.residency?.reasoning ??
                    "Something about your situation isn't supported yet — check your eligibility answers."}
                </p>
              </CardContent>
            </Card>
          ) : stage === 'eligibility' ? (
            <div className="space-y-3 text-center">
              <p className="text-2xl font-semibold text-foreground">Let&apos;s find your refund</p>
              <p className="text-muted-foreground">
                Welcome, {user.email}. Most F-1 students overpay. Start with your I-94 and travel history — it takes
                about 15 minutes end to end.
              </p>
              <Link href="/onboarding/eligibility">
                <Button className="mt-2">Start your filing →</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Tax year {CURRENT_SUPPORTED_TAX_YEAR}</p>
                <p className="text-2xl font-semibold text-foreground">Welcome back</p>
              </div>

              <StageTracker stage={stage} />

              <Card>
                <CardHeader>
                  <CardTitle>Pick up where you left off</CardTitle>
                  <CardDescription>
                    {ONBOARDING_STEPS.find((step) => step.stage === stage)?.label ?? 'Next step'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={routeForStage(stage)}>
                    <Button className="w-full">Continue →</Button>
                  </Link>
                </CardContent>
              </Card>

              {filing?.residency && <ResidencySnapshot residency={filing.residency} />}

              {stage === 'documents' && filing?.documents_needed && (
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
    </div>
  )
}
