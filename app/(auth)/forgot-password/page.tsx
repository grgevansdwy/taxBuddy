'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { AuthPanel } from '@/components/auth-panel'
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

  const backToSignIn = (
    <Link href="/login" className="font-medium text-primary hover:underline">
      ← Back to sign in
    </Link>
  )

  if (sent) {
    return (
      <AuthPanel
        icon="📬"
        title="Check your email"
        description={
          <>
            We sent a password reset link to <strong>{email}</strong>
          </>
        }
        footer={backToSignIn}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to reset your password. It may take a minute to arrive.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Try a different email
          </Button>
        </div>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel
      title="Forgot your password?"
      description="No worries — we'll send you a reset link"
      footer={backToSignIn}
    >
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
    </AuthPanel>
  )
}
