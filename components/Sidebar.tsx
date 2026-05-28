'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { FileText, Home, LogOut, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SidebarProps {
  user: { id: string; email: string }
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const navLinks = [{ href: '/dashboard', label: 'Dashboard', icon: Home }]

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 h-full">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
        <FileText className="h-5 w-5" />
        InsightPDF AI
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {pathname === href && <ChevronRight className="ml-auto h-3 w-3" />}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* User */}
      <div className="px-3 py-3 flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs bg-zinc-200 dark:bg-zinc-700">
            {user.email.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-zinc-900 dark:text-zinc-100">
            {user.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}
