import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-bold text-primary">TaxBuddy</span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-2xl font-semibold text-foreground">Dashboard</p>
          <p className="text-muted-foreground">
            Welcome, {user.email}. Your dashboard is on the way — this is where you&apos;ll see your tax refund progress, uploaded documents, and estimated return.
          </p>
        </div>
      </main>
    </div>
  )
}
