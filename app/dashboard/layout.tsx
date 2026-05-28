import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar: hidden on mobile, visible from md upward */}
      <div className="hidden md:flex">
        <Sidebar user={{ id: user.id, email: user.email ?? '' }} />
      </div>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
