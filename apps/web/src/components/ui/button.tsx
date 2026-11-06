import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Botão do shadcn/ui com as variantes do protótipo (componente Btn). */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-onprimary hover:opacity-90',
        accent: 'bg-accent text-onprimary hover:opacity-90',
        soft: 'bg-primary/10 text-primary hover:bg-primary/15',
        asoft: 'bg-accent/10 text-accent hover:bg-accent/15',
        ghost: 'text-ink/80 hover:bg-sunk',
        line: 'border border-line bg-surface text-ink hover:bg-sunk',
        pline: 'border border-primary/40 text-primary hover:bg-primary/5',
        aline: 'border border-accent/40 text-accent hover:bg-accent/5',
        danger: 'text-red-600 hover:bg-red-500/10',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" type={asChild ? undefined : type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export { Button, buttonVariants };
