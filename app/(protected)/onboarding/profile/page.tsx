"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { WizardNavRow } from "@/components/onboarding/wizard-nav-row";
import { CURRENT_SUPPORTED_TAX_YEAR } from "@/lib/config/taxYear";
import { US_STATES } from "@/lib/config/usStates";
import { COUNTRIES } from "@/lib/config/countries";
import { fetchFiling } from "@/lib/client/fetchFiling";
import {
  clearSessionFormDraft,
  readSessionFormDraft,
  useSessionFormDraft,
} from "@/lib/client/useSessionFormDraft";
import type { Address, FilingStatus, ForeignAddress } from "@/lib/types";

const PROFILE_DRAFT_KEY = `onboarding:profile:${CURRENT_SUPPORTED_TAX_YEAR}`;

type YesNo = "yes" | "no";
// "" = not yet answered; we no longer pre-select a default so the user has to
// choose each answer themselves.
type YesNoUnset = YesNo | "";
type PriorReturnFormChoice = "1040" | "1040-NR" | "other";

type FieldErrors = Partial<
  Record<
    | "legalName"
    | "dob"
    | "citizenship"
    | "usLine1"
    | "usCity"
    | "usState"
    | "usPostalCode"
    | "foreignLine1"
    | "foreignCountry"
    | "foreignPostalCode"
    | "hasSSN"
    | "hasOrAppliedItin"
    | "ssnOrItin"
    | "priorReturnFiled"
    | "priorReturnYear"
    | "priorReturnFormOther",
    string
  >
>;

const US_ZIP_RE = /^\d{5}(-\d{4})?$/;
const SSN_RE = /^\d{3}-?\d{2}-?\d{4}$/;
const ITIN_RE = /^9\d{2}-?\d{2}-?\d{4}$/;

// Auto-inserts dashes as the user types raw digits, for both SSN and ITIN —
// they share the same xxx-xx-xxxx shape.
function formatSsnOrItin(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)].filter(Boolean).join("-");
}

export default function ProfilePage() {
  const router = useRouter();
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Not extractable from the I-94 today (that schema only covers visa/entry
  // data), so these are collected directly — needed for Form 8843's name/TIN
  // header and citizenship line, and for treaty lookup later.
  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [citizenship, setCitizenship] = useState("");

  const [usLine1, setUsLine1] = useState("");
  const [usCity, setUsCity] = useState("");
  const [usState, setUsState] = useState("");
  const [usPostalCode, setUsPostalCode] = useState("");

  const [foreignLine1, setForeignLine1] = useState("");
  const [foreignPostalCode, setForeignPostalCode] = useState("");
  const [foreignCountry, setForeignCountry] = useState("");
  const [foreignState, setForeignState] = useState("");

  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");

  const [hasSSN, setHasSSN] = useState<YesNoUnset>("");
  const [hasOrAppliedItin, setHasOrAppliedItin] = useState<YesNoUnset>("");
  const [ssnOrItin, setSsnOrItin] = useState("");

  // Not pre-filled — the user answers whether they've filed before, and only
  // then do the year/form fields appear (both start blank). A saved answer
  // overrides these once hydration finishes.
  const [priorReturnFiled, setPriorReturnFiled] = useState<YesNoUnset>("");
  const [priorReturnYear, setPriorReturnYear] = useState("");
  const [priorReturnFormChoice, setPriorReturnFormChoice] = useState<PriorReturnFormChoice | "">("");
  const [priorReturnFormOther, setPriorReturnFormOther] = useState("");

  const needsW7 = hasSSN === "no" && hasOrAppliedItin === "no";

  // Persist typed input to sessionStorage so back-navigation restores it. SSN/
  // ITIN stay client-side (never written to the server until Continue).
  const draft = {
    legalName,
    dob,
    citizenship,
    usLine1,
    usCity,
    usState,
    usPostalCode,
    foreignLine1,
    foreignPostalCode,
    foreignCountry,
    foreignState,
    filingStatus,
    hasSSN,
    hasOrAppliedItin,
    ssnOrItin,
    priorReturnFiled,
    priorReturnYear,
    priorReturnFormChoice,
    priorReturnFormOther,
  };
  type ProfileDraft = typeof draft;
  useSessionFormDraft(PROFILE_DRAFT_KEY, draft, !isHydrating);

  function applyDraft(d: Partial<ProfileDraft>) {
    if (d.legalName !== undefined) setLegalName(d.legalName);
    if (d.dob !== undefined) setDob(d.dob);
    if (d.citizenship !== undefined) setCitizenship(d.citizenship);
    if (d.usLine1 !== undefined) setUsLine1(d.usLine1);
    if (d.usCity !== undefined) setUsCity(d.usCity);
    if (d.usState !== undefined) setUsState(d.usState);
    if (d.usPostalCode !== undefined) setUsPostalCode(d.usPostalCode);
    if (d.foreignLine1 !== undefined) setForeignLine1(d.foreignLine1);
    if (d.foreignPostalCode !== undefined) setForeignPostalCode(d.foreignPostalCode);
    if (d.foreignCountry !== undefined) setForeignCountry(d.foreignCountry);
    if (d.foreignState !== undefined) setForeignState(d.foreignState);
    if (d.filingStatus !== undefined) setFilingStatus(d.filingStatus);
    if (d.hasSSN !== undefined) setHasSSN(d.hasSSN);
    if (d.hasOrAppliedItin !== undefined) setHasOrAppliedItin(d.hasOrAppliedItin);
    if (d.ssnOrItin !== undefined) setSsnOrItin(d.ssnOrItin);
    if (d.priorReturnFiled !== undefined) setPriorReturnFiled(d.priorReturnFiled);
    if (d.priorReturnYear !== undefined) setPriorReturnYear(d.priorReturnYear);
    if (d.priorReturnFormChoice !== undefined) setPriorReturnFormChoice(d.priorReturnFormChoice);
    if (d.priorReturnFormOther !== undefined) setPriorReturnFormOther(d.priorReturnFormOther);
  }

  // Rehydrate from Supabase on mount so back-navigation from a later step
  // doesn't show empty fields for work the user already did.
  useEffect(() => {
    let cancelled = false;

    // legalName/dob/citizenship come from the I-94/I-20 read on the previous
    // step, which may still be finishing when this page opens. `prev || value`
    // never clobbers what the user has already typed or an earlier fill.
    type IdentityShape = { legalName?: unknown; dob?: unknown; citizenship?: unknown };
    const identityValue = (field: unknown) =>
      (field as { value?: string } | undefined)?.value ?? "";
    const applyIdentity = (profile: IdentityShape) => {
      setLegalName((prev) => prev || identityValue(profile.legalName));
      setDob((prev) => prev || identityValue(profile.dob));
      setCitizenship((prev) => prev || identityValue(profile.citizenship));
    };
    const identityMissing = (profile: IdentityShape | null | undefined) =>
      !profile ||
      !identityValue(profile.legalName) ||
      !identityValue(profile.dob) ||
      !identityValue(profile.citizenship);

    fetchFiling()
      .then((data) => {
        if (cancelled) return;
        const profile = data.profile;
        if (profile) {
          applyIdentity(profile);

          const usAddress = profile.usAddress as Address | undefined;
          if (usAddress) {
            setUsLine1(usAddress.line1 ?? "");
            setUsCity(usAddress.city ?? "");
            setUsState(usAddress.state ?? "");
            setUsPostalCode(usAddress.postalCode ?? "");
          }

          const foreignAddress = profile.foreignAddress as ForeignAddress | undefined;
          if (foreignAddress) {
            setForeignLine1(foreignAddress.line1 ?? "");
            setForeignPostalCode(foreignAddress.postalCode ?? "");
            setForeignCountry(foreignAddress.country ?? "");
            setForeignState(foreignAddress.state ?? "");
          }

          if (profile.filingStatus) setFilingStatus(profile.filingStatus);

          if (profile.ssnOrItin) {
            setSsnOrItin(profile.ssnOrItin);
            setHasSSN(/^9/.test(profile.ssnOrItin.trim()) ? "no" : "yes");
            if (/^9/.test(profile.ssnOrItin.trim())) setHasOrAppliedItin("yes");
          }

          if (profile.priorReturn) {
            setPriorReturnFiled(profile.priorReturn.filed ? "yes" : "no");
            setPriorReturnYear(profile.priorReturn.year ? String(profile.priorReturn.year) : "");
            const savedForm = profile.priorReturn.form ?? "";
            if (savedForm === "1040" || savedForm === "1040-NR") {
              setPriorReturnFormChoice(savedForm);
            } else if (savedForm) {
              setPriorReturnFormChoice("other");
              setPriorReturnFormOther(savedForm);
            }
          }
        }
        // Overlay any unsaved draft from this tab so back-navigation restores
        // what the user typed (takes precedence over backend values).
        const savedDraft = readSessionFormDraft<Partial<ProfileDraft>>(PROFILE_DRAFT_KEY);
        if (savedDraft) applyDraft(savedDraft);

        setIsHydrating(false);

        // If identity isn't saved yet (documents still reading), poll a few
        // times to fill it in — without blocking the rest of the form.
        if (identityMissing(data.profile)) {
          let attempts = 0;
          const pollIdentity = () => {
            if (cancelled || attempts >= 8) return;
            attempts += 1;
            setTimeout(() => {
              fetchFiling()
                .then((again) => {
                  if (cancelled) return;
                  if (again.profile) applyIdentity(again.profile);
                  if (identityMissing(again.profile)) pollIdentity();
                })
                .catch(() => {});
            }, 1500);
          };
          pollIdentity();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setIsHydrating(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!legalName.trim()) errors.legalName = "Full legal name is required.";
    if (!dob) errors.dob = "Date of birth is required.";
    if (!citizenship) errors.citizenship = "Citizenship is required.";

    if (!usLine1.trim()) errors.usLine1 = "Street address is required.";
    if (!usCity.trim()) errors.usCity = "City is required.";
    if (!usState) errors.usState = "State is required.";
    if (!US_ZIP_RE.test(usPostalCode.trim())) {
      errors.usPostalCode = "Enter a valid ZIP code (e.g. 98105 or 98105-1234).";
    }

    if (!foreignLine1.trim()) errors.foreignLine1 = "Street address is required.";
    if (!foreignCountry) errors.foreignCountry = "Country is required.";
    if (!foreignPostalCode.trim()) errors.foreignPostalCode = "Postal code is required.";

    if (hasSSN === "") {
      errors.hasSSN = "Please tell us whether you have an SSN.";
    } else if (hasSSN === "yes") {
      if (!SSN_RE.test(ssnOrItin.trim())) {
        errors.ssnOrItin = "Enter a valid SSN (e.g. 123-45-6789).";
      }
    } else {
      if (hasOrAppliedItin === "") {
        errors.hasOrAppliedItin = "Please tell us whether you have or applied for an ITIN.";
      } else if (hasOrAppliedItin === "yes" && !ITIN_RE.test(ssnOrItin.trim())) {
        errors.ssnOrItin = "Enter a valid ITIN — it starts with 9 (e.g. 912-34-5678).";
      }
    }

    if (priorReturnFiled === "") {
      errors.priorReturnFiled = "Please tell us whether you've filed a US tax return before.";
    } else if (priorReturnFiled === "yes") {
      const year = Number(priorReturnYear);
      if (!/^\d{4}$/.test(priorReturnYear.trim()) || year < 2000 || year >= CURRENT_SUPPORTED_TAX_YEAR) {
        errors.priorReturnYear = `Enter a year between 2000 and ${CURRENT_SUPPORTED_TAX_YEAR - 1}.`;
      }
      if (priorReturnFormChoice === "") {
        errors.priorReturnFormOther = "Select which form you filed.";
      } else if (priorReturnFormChoice === "other" && !priorReturnFormOther.trim()) {
        errors.priorReturnFormOther = "Enter which form you filed.";
      }
    }

    return errors;
  }

  async function handleSubmit() {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYear: CURRENT_SUPPORTED_TAX_YEAR,
          legalName,
          dob,
          citizenship,
          usAddress: {
            line1: usLine1,
            city: usCity,
            state: usState,
            postalCode: usPostalCode,
            country: "United States",
          },
          foreignAddress: {
            line1: foreignLine1,
            postalCode: foreignPostalCode,
            country: foreignCountry,
            state: foreignState || undefined,
          },
          filingStatus,
          ssnOrItin,
          priorReturn: {
            filed: priorReturnFiled === "yes",
            year: priorReturnFiled === "yes" ? Number(priorReturnYear) : undefined,
            form:
              priorReturnFiled === "yes"
                ? priorReturnFormChoice === "other"
                  ? priorReturnFormOther.trim()
                  : priorReturnFormChoice
                : undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      // Submitted → the backend is now the source of truth; drop the local draft.
      clearSessionFormDraft(PROFILE_DRAFT_KEY);
      router.push("/onboarding/confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isHydrating) {
    return (
      <WizardShell step={2} totalSteps={4} title="Tell us about yourself">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </WizardShell>
    );
  }

  return (
    <WizardShell step={2} totalSteps={4} title="Tell us about yourself">
      <div className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="legalName">Full legal name</Label>
          <Input
            id="legalName"
            placeholder="As it appears on your passport"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
          {fieldErrors.legalName && <p className="text-xs text-destructive">{fieldErrors.legalName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            {fieldErrors.dob && <p className="text-xs text-destructive">{fieldErrors.dob}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="citizenship">Citizenship</Label>
            <Select value={citizenship} onValueChange={(v) => setCitizenship(v ?? "")}>
              <SelectTrigger id="citizenship" className="w-full">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.citizenship && <p className="text-xs text-destructive">{fieldErrors.citizenship}</p>}
          </div>
        </div>

        <div className="space-y-3">
          <Label>US address</Label>
          <div className="space-y-1">
            <Input placeholder="Street address" value={usLine1} onChange={(e) => setUsLine1(e.target.value)} />
            {fieldErrors.usLine1 && <p className="text-xs text-destructive">{fieldErrors.usLine1}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Input placeholder="City" value={usCity} onChange={(e) => setUsCity(e.target.value)} />
              {fieldErrors.usCity && <p className="text-xs text-destructive">{fieldErrors.usCity}</p>}
            </div>
            <div className="space-y-1">
              <Select value={usState} onValueChange={(v) => setUsState(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.usState && <p className="text-xs text-destructive">{fieldErrors.usState}</p>}
            </div>
            <div className="space-y-1">
              <Input placeholder="ZIP" value={usPostalCode} onChange={(e) => setUsPostalCode(e.target.value)} />
              {fieldErrors.usPostalCode && <p className="text-xs text-destructive">{fieldErrors.usPostalCode}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Foreign (home country) address</Label>
          <div className="space-y-1">
            <Input
              placeholder="Street address"
              value={foreignLine1}
              onChange={(e) => setForeignLine1(e.target.value)}
            />
            {fieldErrors.foreignLine1 && <p className="text-xs text-destructive">{fieldErrors.foreignLine1}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="State/province (optional)"
              value={foreignState}
              onChange={(e) => setForeignState(e.target.value)}
            />
            <div className="space-y-1">
              <Input
                placeholder="Postal code"
                value={foreignPostalCode}
                onChange={(e) => setForeignPostalCode(e.target.value)}
              />
              {fieldErrors.foreignPostalCode && (
                <p className="text-xs text-destructive">{fieldErrors.foreignPostalCode}</p>
              )}
            </div>
            <div className="space-y-1">
              <Select value={foreignCountry} onValueChange={(v) => setForeignCountry(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.foreignCountry && <p className="text-xs text-destructive">{fieldErrors.foreignCountry}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filingStatus">Filing status</Label>
          <Select value={filingStatus} onValueChange={(v) => setFilingStatus(v as FilingStatus)}>
            <SelectTrigger id="filingStatus" className="w-full">
              <SelectValue placeholder="Select filing status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married_nra" disabled>
                Married (nonresident alien) — coming soon
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Do you have a Social Security Number (SSN)?</Label>
          <RadioGroup value={hasSSN} onValueChange={(v) => setHasSSN(v as YesNo)} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
          {fieldErrors.hasSSN && <p className="text-xs text-destructive">{fieldErrors.hasSSN}</p>}
        </div>

        {hasSSN === "yes" && (
          <div className="space-y-1.5">
            <Label htmlFor="ssn">Social Security Number</Label>
            <Input
              id="ssn"
              placeholder="123-45-6789"
              value={ssnOrItin}
              onChange={(e) => setSsnOrItin(formatSsnOrItin(e.target.value))}
            />
            {fieldErrors.ssnOrItin && <p className="text-xs text-destructive">{fieldErrors.ssnOrItin}</p>}
          </div>
        )}

        {hasSSN === "no" && (
          <div className="space-y-2">
            <Label>Have you ever had or applied for an ITIN?</Label>
            <RadioGroup
              value={hasOrAppliedItin}
              onValueChange={(v) => setHasOrAppliedItin(v as YesNo)}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="yes" /> Yes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="no" /> No
              </label>
            </RadioGroup>
            {fieldErrors.hasOrAppliedItin && (
              <p className="text-xs text-destructive">{fieldErrors.hasOrAppliedItin}</p>
            )}
          </div>
        )}

        {hasSSN === "no" && hasOrAppliedItin === "yes" && (
          <div className="space-y-1.5">
            <Label htmlFor="itin">ITIN</Label>
            <Input
              id="itin"
              placeholder="912-34-5678"
              value={ssnOrItin}
              onChange={(e) => setSsnOrItin(formatSsnOrItin(e.target.value))}
            />
            {fieldErrors.ssnOrItin && <p className="text-xs text-destructive">{fieldErrors.ssnOrItin}</p>}
          </div>
        )}

        {needsW7 && (
          <p className="text-sm text-muted-foreground">
            You&apos;ll need to apply for an ITIN (Form W-7) before filing. That application flow isn&apos;t
            available yet — you can continue and add your ITIN once you have it.
          </p>
        )}

        <div className="space-y-2">
          <Label>Have you filed a US tax return before?</Label>
          <RadioGroup
            value={priorReturnFiled}
            onValueChange={(v) => {
              const value = v as YesNo;
              setPriorReturnFiled(value);
              // Prefill the prior tax year (2024) on "yes" — but NOT the form
              // type, which the user must still choose themselves.
              if (value === "yes") {
                setPriorReturnYear((prev) => prev || String(CURRENT_SUPPORTED_TAX_YEAR - 1));
              }
            }}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
          {fieldErrors.priorReturnFiled && (
            <p className="text-xs text-destructive">{fieldErrors.priorReturnFiled}</p>
          )}
        </div>

        {priorReturnFiled === "yes" && (
          <div className="space-y-1.5">
            <Label htmlFor="priorYear">Year</Label>
            <Input
              id="priorYear"
              type="number"
              value={priorReturnYear}
              onChange={(e) => setPriorReturnYear(e.target.value)}
            />
            {fieldErrors.priorReturnYear && <p className="text-xs text-destructive">{fieldErrors.priorReturnYear}</p>}
          </div>
        )}

        {priorReturnFiled === "yes" && (
          <div className="space-y-2">
            <Label>Which form did you file?</Label>
            <RadioGroup
              value={priorReturnFormChoice}
              onValueChange={(v) => setPriorReturnFormChoice(v as PriorReturnFormChoice)}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="1040" /> 1040
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="1040-NR" /> 1040-NR
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="other" /> Other
              </label>
            </RadioGroup>
            {priorReturnFormChoice === "other" && (
              <div className="space-y-1.5">
                <Input
                  id="priorReturnFormOther"
                  placeholder="Which form?"
                  value={priorReturnFormOther}
                  onChange={(e) => setPriorReturnFormOther(e.target.value)}
                />
                {fieldErrors.priorReturnFormOther && (
                  <p className="text-xs text-destructive">{fieldErrors.priorReturnFormOther}</p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <WizardNavRow
          step={2}
          onContinue={handleSubmit}
          continueLabel={isSubmitting ? "Saving..." : "Continue"}
          disabled={isSubmitting}
        />
      </div>
    </WizardShell>
  );
}
