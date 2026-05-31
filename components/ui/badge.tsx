import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'amber' | 'green' | 'red' | 'blue' | 'purple'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-slate-800 text-slate-300': variant === 'default',
          'bg-amber-500/20 text-amber-400': variant === 'amber',
          'bg-green-500/20 text-green-400': variant === 'green',
          'bg-red-500/20 text-red-400': variant === 'red',
          'bg-blue-500/20 text-blue-400': variant === 'blue',
          'bg-purple-500/20 text-purple-400': variant === 'purple',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
