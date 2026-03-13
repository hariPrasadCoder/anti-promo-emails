'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, PlusCircle, History, LayoutTemplate, Settings } from 'lucide-react'

const navItems = [
  { href: '/', label: 'New Run', icon: PlusCircle },
  { href: '/history', label: 'History', icon: History },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Inbox className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm leading-tight truncate">Anti-Promo</p>
          <p className="text-gray-500 text-xs truncate">Email Optimizer</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs">v2.0 · APEO</p>
      </div>
    </aside>
  )
}
