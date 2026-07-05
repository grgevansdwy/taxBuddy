import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function VerifyPage() {
  return (
    <div className="w-full max-w-sm">
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent text-3xl">
            ✉️
          </div>
          <CardTitle className="text-xl">Check your inbox</CardTitle>
          <CardDescription>
            We sent you a verification link to confirm your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="rounded-xl bg-accent/60 px-4 py-3 text-sm text-accent-foreground space-y-1">
            <p className="font-medium">What to do next:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm opacity-90">
              <li>Open the email from TaxBuddy</li>
              <li>Click the verification link</li>
              <li>You&apos;ll be taken straight to your dashboard</li>
            </ol>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Can&apos;t find it? Check your spam folder.
          </p>

          <Link href="/login">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
