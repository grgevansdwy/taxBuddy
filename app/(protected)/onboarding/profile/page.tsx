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
import type { Address, FilingStatus, ForeignAddress } from "@/lib/types";
import type { FilingResponse } from "@/app/api/filing/route";

type YesNo = "yes" | "no";

type FieldErrors = Partial<
  Record<
    | "legalName"
    | "dob"
    | "citizenship"
    | "usLine1"
    | "usCity"
    | "usState"
    | "usPostalCode"
    | "foreignCountry"
    | "foreignPostalCode"
    | "ssnOrItin"
    | "priorReturnYear",
    string
  >
>;

const US_ZIP_RE = /^\d{5}(-\d{4})?$/;
const SSN_RE = /^\d{3}-?\d{2}-?\d{4}$/;
const ITIN_RE = /^9\d{2}-?\d{2}-?\d{4}$/;

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

  const [foreignPostalCode, setForeignPostalCode] = useState("");
  const [foreignCountry, setForeignCountry] = useState("");
  const [foreignState, setForeignState] = useState("");

  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");

  const [hasSSN, setHasSSN] = useState<YesNo>("yes");
  const [hasOrAppliedItin, setHasOrAppliedItin] = useState<YesNo>("no");
  const [ssnOrItin, setSsnOrItin] = useState("");

  const [digitalAssets, setDigitalAssets] = useState<YesNo>("no");

  // Defaults assume the common case for a year-2+ F-1 filer; overridden below
  // by a saved answer, if one exists, once hydration finishes.
  const [priorReturnFiled, setPriorReturnFiled] = useState<YesNo>("yes");
  const [priorReturnYear, setPriorReturnYear] = useState(String(CURRENT_SUPPORTED_TAX_YEAR - 1));

  const needsW7 = hasSSN === "no" && hasOrAppliedItin === "no";

  // Rehydrate from Supabase on mount so back-navigation from a later step
  // doesn't show empty fields for work the user already did.
  useEffect(() => {
    fetch("/api/filing")
      .then((res) => res.json())
      .then((data: FilingResponse) => {
        const profile = data.profile;
        if (!profile) return;

        setLegalName((profile.legalName as { value?: string } | undefined)?.value ?? "");
        setDob((profile.dob as { value?: string } | undefined)?.value ?? "");
        setCitizenship((profile.citizenship as { value?: string } | undefined)?.value ?? "");

        const usAddress = profile.usAddress as Address | undefined;
        if (usAddress) {
          setUsLine1(usAddress.line1 ?? "");
          setUsCity(usAddress.city ?? "");
          setUsState(usAddress.state ?? "");
          setUsPostalCode(usAddress.postalCode ?? "");
        }

        const foreignAddress = profile.foreignAddress as ForeignAddress | undefined;
        if (foreignAddress) {
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

        if (typeof profile.digitalAssets === "boolean") {
          setDigitalAssets(profile.digitalAssets ? "yes" : "no");
        }

        if (profile.priorReturn) {
          setPriorReturnFiled(profile.priorReturn.filed ? "yes" : "no");
          setPriorReturnYear(profile.priorReturn.year ? String(profile.priorReturn.year) : "");
        }
      })
      .finally(() => setIsHydrating(false));
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

    if (!foreignCountry) errors.foreignCountry = "Country is required.";
    if (!foreignPostalCode.trim()) errors.foreignPostalCode = "Postal code is required.";

    if (hasSSN === "yes") {
      if (!SSN_RE.test(ssnOrItin.trim())) {
        errors.ssnOrItin = "Enter a valid SSN (e.g. 123-45-6789).";
      }
    } else if (hasOrAppliedItin === "yes") {
      if (!ITIN_RE.test(ssnOrItin.trim())) {
        errors.ssnOrItin = "Enter a valid ITIN — it starts with 9 (e.g. 912-34-5678).";
      }
    }

    if (priorReturnFiled === "yes") {
      const year = Number(priorReturnYear);
      if (!/^\d{4}$/.test(priorReturnYear.trim()) || year < 2000 || year >= CURRENT_SUPPORTED_TAX_YEAR) {
        errors.priorReturnYear = `Enter a year between 2000 and ${CURRENT_SUPPORTED_TAX_YEAR - 1}.`;
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
            postalCode: foreignPostalCode,
            country: foreignCountry,
            state: foreignState || undefined,
          },
          filingStatus,
          ssnOrItin,
          digitalAssets: digitalAssets === "yes",
          priorReturn: {
            filed: priorReturnFiled === "yes",
            year: priorReturnFiled === "yes" ? Number(priorReturnYear) : undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      router.push("/onboarding/interview");
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
        </div>

        {hasSSN === "yes" && (
          <div className="space-y-1.5">
            <Label htmlFor="ssn">Social Security Number</Label>
            <Input id="ssn" placeholder="123-45-6789" value={ssnOrItin} onChange={(e) => setSsnOrItin(e.target.value)} />
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
          </div>
        )}

        {hasSSN === "no" && hasOrAppliedItin === "yes" && (
          <div className="space-y-1.5">
            <Label htmlFor="itin">ITIN</Label>
            <Input id="itin" placeholder="912-34-5678" value={ssnOrItin} onChange={(e) => setSsnOrItin(e.target.value)} />
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
          <Label>Did you receive, sell, or exchange any digital assets (crypto) this year?</Label>
          <p className="text-xs text-muted-foreground">
            Required on every return regardless of amount — includes receiving, selling, trading, or being paid in
            crypto. This is different from selling investments for a gain, which we&apos;ll ask about next.
          </p>
          <RadioGroup value={digitalAssets} onValueChange={(v) => setDigitalAssets(v as YesNo)} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Have you filed a US tax return before?</Label>
          <RadioGroup
            value={priorReturnFiled}
            onValueChange={(v) => setPriorReturnFiled(v as YesNo)}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
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
