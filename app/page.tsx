import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-xl font-bold text-primary tracking-tight">TaxBuddy</span>
        <Link href="/login">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-xl space-y-6">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="size-1.5 rounded-full bg-accent-foreground" />
            Free for students
          </span>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Your tax refund<br />
            <span className="text-primary">is waiting.</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Most students miss out on hundreds in tax credits.<br className="hidden sm:block" />
            TaxBuddy finds what you're owed and files it — in minutes.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto px-8">
                Get started free →
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
                Sign in
              </Button>
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> Takes 5 minutes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> 100% free for students
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> Bank-level security
            </span>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TaxBuddy
      </footer>
    </div>
  );
}
