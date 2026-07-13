import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import type { F1042SData, F1098TData, F1099BData, F1099DIVData, F1099INTData } from "@/lib/types";

// Confirmed-income persistence: the client extracts a document (via one of
// the routes under /api/documents/extract/*) and calls this route with the
// full replacement value for that field — no user review step, see the
// income-docs components. Arrays (multiple payers/documents) are replaced
// wholesale — the client owns array state (add/remove a row) and just
// re-PUTs the full list each time.
type IncomeField = "f1098t" | "f1042s" | "f1099ints" | "f1099divs" | "f1099bs";

interface IncomeRequestBody {
  field: IncomeField;
  value: F1098TData | null | F1042SData[] | F1099INTData[] | F1099DIVData[] | F1099BData[];
}

const COLUMN_BY_FIELD: Record<IncomeField, string> = {
  f1098t: "f1098t",
  f1042s: "f1042s",
  f1099ints: "f1099ints",
  f1099divs: "f1099divs",
  f1099bs: "f1099bs",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as IncomeRequestBody;
  const column = COLUMN_BY_FIELD[body.field];
  if (!column) {
    return NextResponse.json({ error: `Unknown field "${body.field}".` }, { status: 400 });
  }

  const value = body.field === "f1099bs" ? withRealizedGainLoss(body.value as F1099BData[]) : body.value;

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: CURRENT_SUPPORTED_TAX_YEAR,
      [column]: value,
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// realizedGainLoss is arithmetic (proceeds - costBasis), never AI-extracted or
// client-supplied, so it can't diverge from the two numbers it summarizes.
function withRealizedGainLoss(f1099bs: F1099BData[]): F1099BData[] {
  return f1099bs.map((doc) => ({
    ...doc,
    transactions: doc.transactions.map((tx) => ({
      ...tx,
      realizedGainLoss: tx.proceeds - tx.costBasis,
    })),
  }));
}
