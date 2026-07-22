import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { activeModelLabel } from "@/lib/ai/bedrockConfig";

// The AI provider/model badge is read from server env at request time, so this
// must not be prerendered at build (which would bake in the build-time value).
export const dynamic = "force-dynamic";

// Server-component shell — gating happens in ./layout.tsx. All data loads
// client-side from /api/admin/* so the range selector can refetch live.
export default function AdminPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">TaxBuddy</span>
          <span className="text-sm font-medium text-muted-foreground">Admin</span>
          {/* Which model is actually serving extraction in this environment. */}
          <Badge variant="outline" className="font-normal">
            {activeModelLabel()}
          </Badge>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </nav>
      </header>
      <main className="flex-1 px-6 py-8">
        <AdminDashboard />
      </main>
    </div>
  );
}
