import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Deeper validation after proxy
  if (!user) {
    redirect("/login");
  }

  // Record a visit for the admin monitoring dashboard — one row per protected
  // page load ("app load"). RLS's insert-own policy covers this with the user's
  // own session client; failures are swallowed so tracking never blocks the app
  // (e.g. before the account_visits migration is applied).
  void supabase
    .from("account_visits")
    .insert({ user_id: user.id })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("account_visits insert failed:", error.message);
      }
    });

  return <>{children}</>;
}
