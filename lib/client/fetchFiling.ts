import type { FilingResponse } from "@/app/api/filing/route";

// Every onboarding page hydrates from this on mount. Fixes a real bug: the
// old inline `fetch("/api/filing").then(res => res.json())` never checked
// res.ok, so an expired session (401) silently rendered as an empty
// FilingResponse — every field looked wiped instead of erroring. Now a
// failed session hard-redirects to /login instead of pretending the case
// file is empty.
export async function fetchFiling(): Promise<FilingResponse> {
  const res = await fetch("/api/filing");
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Your session expired — redirecting to login.");
  }
  if (!res.ok) {
    throw new Error("Couldn't load your saved progress. Try refreshing the page.");
  }
  return res.json();
}
