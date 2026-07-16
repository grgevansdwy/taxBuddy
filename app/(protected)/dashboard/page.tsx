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
import { loadEngineContext } from '@/lib/server/engineContext'
import type { DocType, EligibilityPageData, ResidencyResult } from '@/lib/types'

interface FilingRow {
  stage: string
  eligibility_page: EligibilityPageData | null
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
  // "file" isn't one of the wizard steps (it's the terminal state after
  // them), so every step reads as done rather than falling through to
  // "pending" because findIndex returns -1 for it.
  const currentIndex = stage === 'file' ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.findIndex((step) => step.stage === stage)
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

const FORM_DOWNLOADS: { id: string; label: string; route: string }[] = [
  { id: '1040nr', label: 'Form 1040-NR', route: '/api/documents/generate/1040nr' },
  { id: 'schedOI', label: 'Schedule OI', route: '/api/documents/generate/schedOI' },
  { id: 'f8843', label: 'Form 8843', route: '/api/documents/generate/f8843' },
  { id: 'schedNEC', label: 'Schedule NEC', route: '/api/documents/generate/schedNEC' },
  { id: 'schedA', label: 'Schedule A', route: '/api/documents/generate/schedA' },
  { id: 'f8833', label: 'Form 8833', route: '/api/documents/generate/f8833' },
  // The Schedule NEC line-16 continuation statement is listed last, matching
  // its position at the bottom of the combined packet.
  { id: 'schedNEC-attachment', label: 'Schedule NEC — Line 16 Attachment', route: '/api/documents/generate/schedNEC-attachment' },
]

async function ReadyToFileCard() {
  const result = await loadEngineContext()
  // Form 8843 (and the identity/residency forms) never depend on income data,
  // so they're always offered even if the income engine can't run yet.
  const applicable = new Set(['1040nr', 'schedOI', 'f8843'])
  if (result.ok) {
    const { income } = result.context
    if (income.dividendsGross > 0 || income.capitalGainsTaxable) applicable.add('schedNEC')
    // Line 16 fits only the first 5 lots; the rest go on the overflow statement
    // (see app/api/documents/generate/schedNEC-attachment/route.ts). Only offer
    // it when there's actually overflow to print.
    if (income.capitalGainsTaxable && income.capitalGainsTransactions.length > 5)
      applicable.add('schedNEC-attachment')
    if (!income.usesStandardDeduction && income.charitableContributions > 0) applicable.add('schedA')
    if (income.needsForm8833) applicable.add('f8833')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your tax return is ready</CardTitle>
        <CardDescription>Download each form below and mail them together, or use the instructions provided.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <a href="/api/documents/generate/packet" className="block">
          <Button className="w-full justify-between">
            Download entire return (all forms)
            <span aria-hidden>↓</span>
          </Button>
        </a>
        <p className="text-sm text-muted-foreground pt-1">Or download each form individually:</p>
        {FORM_DOWNLOADS.filter((form) => applicable.has(form.id)).map((form) => (
          <a key={form.id} href={form.route} className="block">
            <Button variant="outline" className="w-full justify-between">
              {form.label}
              <span aria-hidden>↓</span>
            </Button>
          </a>
        ))}
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: filing } = await supabase
    .from('filings')
    .select('stage, eligibility_page, documents_needed')
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

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl space-y-6">
          {stage === 'blocked' ? (
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
          ) : stage === 'eligibility' ? (
            <div className="space-y-5 text-center">
              <p className="text-4xl font-semibold tracking-tight text-foreground">Let&apos;s find your refund</p>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Welcome, {user.email}. Most F-1 students overpay. Start with your I-94 and travel history — it takes
                about 15 minutes end to end.
              </p>
              <Link href="/onboarding/eligibility">
                <Button size="lg" className="mt-4">
                  Start your filing →
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Tax year {CURRENT_SUPPORTED_TAX_YEAR}</p>
                <p className="text-2xl font-semibold text-foreground">{stage === 'file' ? "You're all set" : 'Welcome back'}</p>
              </div>

              <StageTracker stage={stage} />

              {stage === 'file' ? (
                <ReadyToFileCard />
              ) : (
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
              )}

              {filing?.eligibility_page?.residency && (
                <ResidencySnapshot residency={filing.eligibility_page.residency} />
              )}

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
