'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarCheck, LayoutDashboard, LogOut, UserCog, Upload, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/admin/employees', label: 'Employees', Icon: Users, exact: true },
  { href: '/admin/employees/import', label: 'Import', Icon: Upload, exact: true },
  { href: '/admin/attendance', label: 'Attendance', Icon: CalendarCheck, exact: true },
  { href: '/admin/account', label: 'My Account', Icon: UserCog, exact: true },
];

export function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-navy-900/20 bg-navy-800 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo size={32} className="h-8 w-auto" />
            <span>
              <span className="block text-sm font-bold leading-tight sm:text-base">
                Admin Dashboard
              </span>
              <span className="block text-xs text-navy-200">Attendance Management System</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/admin/account"
              className="hidden max-w-[180px] truncate rounded-lg px-2 py-1 text-xs text-navy-200 transition-colors hover:bg-navy-700 hover:text-white sm:inline"
            >
              {adminName}
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-navy-100 transition-colors hover:bg-navy-700 hover:text-white"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Horizontally scrollable on phones so no tab is ever unreachable. */}
        <nav aria-label="Admin sections" className="border-t border-navy-700/60 bg-navy-900">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-6">
            {NAV.map(({ href, label, Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors ${
                      active
                        ? 'border-white text-white'
                        : 'border-transparent text-navy-200 hover:text-white'
                    }`}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
