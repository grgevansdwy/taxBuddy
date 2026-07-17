import Link from 'next/link'
import { AuthPanel } from '@/components/auth-panel'
import { Button } from '@/components/ui/button'

export default function VerifyPage() {
  return (
    <AuthPanel
      icon="✉️"
      title="Check your inbox"
      description="We sent you a verification link to confirm your email address"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-accent/60 px-4 py-3 text-sm text-accent-foreground space-y-1">
          <p className="font-medium">What to do next:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm opacity-90">
            <li>Open the email from TaxBuddy</li>
            <li>Click the verification link</li>
            <li>You&apos;ll be taken straight to your dashboard</li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">Can&apos;t find it? Check your spam folder.</p>

        <Link href="/login">
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    </AuthPanel>
  )
}
