import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,var(--accent),transparent)]" />
        <div className="absolute -top-32 -left-32 size-112 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 size-128 rounded-full bg-chart-3/25 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 size-104 rounded-full bg-chart-5/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)] opacity-40" />
      </div>

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-xl font-bold text-primary tracking-tight">
          TaxBuddy
        </span>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl space-y-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Most international students
            <br />
            use the <span className="text-primary">wrong</span> tax software.
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
            That's why they miss out on tax credits they're owed.
            <br className="hidden sm:block" />
            TaxBuddy is built for international students. File it right, in
            minutes.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto px-8">
                Get started free →
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto px-8"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TaxBuddy
      </footer>
    </div>
  );
}
