// The accounts allowed to see the admin monitoring dashboard. Gating is enforced
// server-side in three places: the /admin route-group layout, every /api/admin/*
// route handler, and the conditional Admin button on the dashboard. Add an email
// here (lowercase) to grant access.
export const ADMIN_EMAILS = [
  "jonathanbernard265@gmail.com",
  "evandaenuwy@gmail.com",
];

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
