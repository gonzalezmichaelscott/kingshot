import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-slate-400 mb-5 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />}
          {item.href ? (
            <Link
              href={item.href}
              className="text-amber-500 hover:text-amber-400 transition-colors truncate max-w-[100px] sm:max-w-[160px]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[200px]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
