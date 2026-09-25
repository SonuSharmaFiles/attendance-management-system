import Link from 'next/link';
import { Logo } from '@/components/Logo';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Rendered at the right-hand end — sign-out buttons, nav, etc. */
  action?: React.ReactNode;
  href?: string;
}

export function Header({ title, subtitle, action, href = '/' }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-navy-900/20 bg-navy-800 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href={href} className="flex min-w-0 items-center gap-3">
          <Logo size={36} className="h-9 w-9 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight sm:text-base">
              {title}
            </span>
            {subtitle ? (
              <span className="block truncate text-xs text-navy-200">{subtitle}</span>
            ) : null}
          </span>
        </Link>
        {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
