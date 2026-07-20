import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/config/admin";

// Admin-only segment. It already sits inside (protected), so an unauthenticated
// user is bounced to /login upstream; here we additionally require the admin
// account and send everyone else back to their own dashboard.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user?.email)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
