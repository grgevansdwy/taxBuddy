import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Address, FilingStatus, ForeignAddress } from "@/lib/types";

interface ProfileRequestBody {
  taxYear: number;
  legalName: string;
  dob: string;
  citizenship: string;
  usAddress: Address;
  foreignAddress: ForeignAddress;
  filingStatus: FilingStatus;
  ssnOrItin: string;
  digitalAssets: boolean;
  priorReturn: { filed: boolean; year?: number };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProfileRequestBody;

  const { data: existing } = await supabase
    .from("filings")
    .select("profile")
    .eq("user_id", user.id)
    .eq("tax_year", body.taxYear)
    .maybeSingle();

  const { error } = await supabase.from("filings").upsert(
    {
      user_id: user.id,
      tax_year: body.taxYear,
      stage: "interview",
      profile: {
        ...(existing?.profile ?? {}),
        legalName: { value: body.legalName, confidence: 1, confirmed: true, source: "unknown" },
        dob: { value: body.dob, confidence: 1, confirmed: true, source: "unknown" },
        citizenship: { value: body.citizenship, confidence: 1, confirmed: true, source: "unknown" },
        usAddress: body.usAddress,
        foreignAddress: body.foreignAddress,
        filingStatus: body.filingStatus,
        ssnOrItin: body.ssnOrItin,
        digitalAssets: body.digitalAssets,
        priorReturn: body.priorReturn,
      },
    },
    { onConflict: "user_id,tax_year" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
