import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side — the block is centered in the pane; "Back home" sits just
          above the form rather than pinned to the top corner. */}
      <div className="flex flex-col items-center justify-center bg-background px-8 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back home
          </Link>
          {children}
        </div>
      </div>

      {/* Marketing side — background photo + copy + a TaxBuddy-style mockup.
          Hidden on small screens so the form gets the full width. */}
      <div className="relative hidden overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img-1.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/65 to-black/55" />

        <div className="relative flex h-full flex-col justify-between p-12 text-white lg:pl-24">
          <div className="max-w-md space-y-4 pt-12">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight whitespace-nowrap">
              Built for international students.
            </h2>
            <p className="text-base leading-relaxed text-white/85">
              Send it to the IRS with zero tax knowledge needed.
            </p>
          </div>

          {/* Real product screenshot of a completed return. IMPORTANT: this
              login page is public, so public/dashboard-preview.png MUST have all
              PII (name, SSN, address, dollar amounts) redacted in the file
              itself — a CSS blur wouldn't hide the underlying pixels. Cropped to
              the top so it shows the "You're all set" header + preview. */}
          <div className="mb-12 w-full max-w-2xl overflow-hidden rounded-sm border border-white/20 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dashboard-preview.png"
              alt="A completed TaxBuddy return, ready to download"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
