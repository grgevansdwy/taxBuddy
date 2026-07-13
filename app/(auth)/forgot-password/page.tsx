'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent text-2xl">
              📬
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="text-center text-sm text-muted-foreground">
              Click the link in the email to reset your password. It may take a minute to arrive.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSent(false)}
            >
              Try a different email
            </Button>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription>
            No worries — we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
