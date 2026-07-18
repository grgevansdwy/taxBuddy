import { NextResponse } from "next/server";
import { computeIncomeEngine } from "@/lib/rules/income";
import { computeF1040NR } from "@/lib/rules/forms/f1040nr";
import { PROVENANCE_1040NR } from "@/lib/audit/provenance1040nr";
import {
  engineArgs as sampleArgs,
  profile as sampleProfile,
  residency as sampleResidency,
} from "@/lib/audit/fixtures/indonesiaStudent";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { withRealizedGainLoss } from "@/lib/rules/capitalGains";
import type {
  EligibilityPageData,
  F1042SData,
  F1099BData,
  F1099DAData,
  F1099DIVData,
  F1099INTData,
  FilerProfile,
  InterviewAnswers,
  ResidencyResult,
  W2Data,
} from "@/lib/types";

// Internal-only backend for the Logic Viz audit tool
// (app/(protected)/dev/logic-viz). Runs the REAL, unmodified rules engine and
// returns everything the page needs to render an auditable 1040-NR. Three
// sources, all producing the identical response shape so the page renders them
// the same way:
//   - sample  (default): a fixed synthetic filer (Indonesian non-scholarship
//              F-1 student) — needs no auth, can't drift, always available.
//   - mine    (GET ?source=mine): the logged-in user's own case file — the same
//              profile/residency/income that /api/documents/generate/* would use.
//   - upload  (POST): income documents the caller extracted client-side via the
//              existing /api/documents/extract/* routes, run through a real
//              filer/residency container (the caller's own filing if it has an
//              eligibility step done, else the sample filer). Nothing persisted.
//
// The response carries, for every source:
//   - lines:      computeF1040NR output (semantic key → formatted string).
//   - income:     the full IncomeEngineResult (live intermediate engine fields).
//   - provenance: the authored per-line source map (annotation; never computed).
//   - trace:      the engine's own step-by-step audit trail.
//
// Recomputed on every request, so the numbers can never drift from the engine.
export const dynamic = "force-dynamic";

const EMPTY_INCOME = {
  w2s: [] as W2Data[],
  f1042s: [] as F1042SData[],
  f1099ints: [] as F1099INTData[],
  f1099divs: [] as F1099DIVData[],
  f1099bs: [] as F1099BData[],
  f1099das: [] as F1099DAData[],
};

type IncomeArrays = typeof EMPTY_INCOME;

// The one place the engine + form + provenance are stitched into the page's
// response. Every source funnels through here so they stay byte-for-byte
// comparable in the UI.
function buildViz(args: {
  taxYear: number;
  profile: Partial<FilerProfile>;
  residency: ResidencyResult;
  income: IncomeArrays;
  charitableContributions: number;
  visa: string;
  caption: string;
}) {
  const income = computeIncomeEngine({
    taxYear: args.taxYear,
    profile: args.profile,
    residency: args.residency,
    ...args.income,
    charitableContributions: args.charitableContributions,
  });
  const lines = computeF1040NR({ profile: args.profile, income });

  return {
    filer: {
      name: args.profile.legalName?.value ?? "",
      citizenship: args.profile.citizenship?.value ?? "",
      visa: args.visa,
      taxYear: args.taxYear,
      caption: args.caption,
    },
    lines,
    income,
    provenance: PROVENANCE_1040NR,
    trace: income.trace,
    findings: income.findings,
  };
}

// The fixed synthetic filer — the default, and the fallback container for
// uploaded documents when the caller has no eligibility step of their own.
function sampleViz() {
  return buildViz({
    taxYear: sampleArgs.taxYear,
    profile: sampleProfile,
    residency: sampleResidency,
    income: {
      w2s: sampleArgs.w2s,
      f1042s: sampleArgs.f1042s,
      f1099ints: sampleArgs.f1099ints,
      f1099divs: sampleArgs.f1099divs,
      f1099bs: sampleArgs.f1099bs,
      f1099das: sampleArgs.f1099das,
    },
    charitableContributions: sampleArgs.charitableContributions,
    visa: "F-1",
    caption: "Indonesian, non-scholarship F-1 student (synthetic sample)",
  });
}

// Load the logged-in user's own filer context (profile + residency + how much
// they gave to charity). Returns null when they haven't finished eligibility —
// callers decide whether that's fatal (source=mine) or a fallback (upload).
async function loadFilerContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("filings")
    .select(
      "profile_page, eligibility_page, interview_page, w2s, f1042s, f1099ints, f1099divs, f1099bs, f1099das"
    )
    .eq("user_id", userId)
    .eq("tax_year", CURRENT_SUPPORTED_TAX_YEAR)
    .maybeSingle();

  if (!data?.eligibility_page) return null;

  const profile = (data.profile_page as Partial<FilerProfile>) ?? {};
  const residency = (data.eligibility_page as EligibilityPageData).residency;
  const charitableContributions =
    (data.interview_page as Partial<InterviewAnswers> | null)?.charitableContributions ?? 0;

  const income: IncomeArrays = {
    w2s: (data.w2s as W2Data[] | undefined) ?? [],
    f1042s: (data.f1042s as F1042SData[] | undefined) ?? [],
    f1099ints: (data.f1099ints as F1099INTData[] | undefined) ?? [],
    f1099divs: (data.f1099divs as F1099DIVData[] | undefined) ?? [],
    f1099bs: (data.f1099bs as F1099BData[] | undefined) ?? [],
    f1099das: (data.f1099das as F1099DAData[] | undefined) ?? [],
  };

  return { profile, residency, charitableContributions, income };
}

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("source") ?? "sample";

  if (source !== "mine") {
    return NextResponse.json(sampleViz());
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = await loadFilerContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json(
      { error: "Finish the eligibility and profile steps before auditing your own documents." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    buildViz({
      taxYear: CURRENT_SUPPORTED_TAX_YEAR,
      profile: ctx.profile,
      residency: ctx.residency,
      income: ctx.income,
      charitableContributions: ctx.charitableContributions,
      visa: (ctx.profile as { visaClass?: string }).visaClass ?? "—",
      caption: `Your case file — live from the documents on your account`,
    })
  );
}

// The client extracts each uploaded document via the existing
// /api/documents/extract/* routes (reusing all that LlamaParse + GPT infra)
// and POSTs the collected structured arrays here. We run the real engine on
// them inside a valid filer/residency container. Nothing is persisted.
interface UploadBody {
  income?: Partial<IncomeArrays>;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as UploadBody;
  const uploaded = body.income ?? {};

  // Gain/loss on securities is derived, never trusted from extraction — mirror
  // exactly what /api/documents/income does before the engine sees it.
  const income: IncomeArrays = {
    w2s: uploaded.w2s ?? [],
    f1042s: uploaded.f1042s ?? [],
    f1099ints: uploaded.f1099ints ?? [],
    f1099divs: uploaded.f1099divs ?? [],
    f1099bs: withRealizedGainLoss(uploaded.f1099bs ?? []),
    f1099das: withRealizedGainLoss(uploaded.f1099das ?? []),
  };

  // Container: the caller's own residency/profile when their filing has an
  // eligibility step, otherwise the sample filer's Indonesian F-1 context.
  const ctx = await loadFilerContext(supabase, user.id);
  const usingOwn = ctx !== null;
  const profile = ctx?.profile ?? sampleProfile;
  const residency = ctx?.residency ?? sampleResidency;

  const container = usingOwn
    ? `${profile.citizenship?.value ?? "your"} residency/treaty context (from your case file)`
    : `the sample filer's Indonesian F-1 residency/treaty context`;

  return NextResponse.json(
    buildViz({
      taxYear: CURRENT_SUPPORTED_TAX_YEAR,
      profile,
      residency,
      income,
      charitableContributions: ctx?.charitableContributions ?? 0,
      visa: (profile as { visaClass?: string }).visaClass ?? "F-1",
      caption: `Uploaded documents, traced through ${container}`,
    })
  );
}
