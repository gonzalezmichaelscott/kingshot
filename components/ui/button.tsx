import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-amber-500 hover:bg-amber-600 text-slate-900': variant === 'primary',
            'bg-slate-700 hover:bg-slate-600 text-slate-100': variant === 'secondary',
            'hover:bg-slate-800 text-slate-300 hover:text-slate-100': variant === 'ghost',
            'bg-red-600 hover:bg-red-700 text-white': variant === 'danger',
          },
          {
            'text-sm px-3 h-8': size === 'sm',
            'text-sm px-4 h-10': size === 'md',
            'text-base px-6 h-12': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
export { Button }
