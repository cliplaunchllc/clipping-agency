import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary: solid red fill with inset top highlight
        default:
          "rounded-md border-transparent bg-accent-solid text-text-on-accent hover:bg-accent-solid-hover focus-visible:ring-accent",
        // Secondary: surface bg, border, inset highlight
        outline:
          "rounded-md border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover hover:border-border-strong focus-visible:ring-accent",
        secondary:
          "rounded-md border-border-subtle bg-bg-surface text-text-primary hover:bg-bg-hover focus-visible:ring-accent",
        // Ghost: no bg, hover fills
        ghost:
          "rounded-md border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:ring-accent",
        // Destructive: ghost red style (outline, not fill)
        destructive:
          "rounded-md border-danger/40 bg-danger-bg text-danger hover:bg-danger/20 focus-visible:ring-danger",
        link: "border-transparent text-accent underline-offset-4 hover:underline focus-visible:ring-accent",
      },
      size: {
        default: "h-8 gap-1.5 px-3 rounded-md",
        xs:      "h-6 gap-1 px-2 text-xs rounded",
        sm:      "h-7 gap-1.5 px-2.5 text-[0.8rem] rounded",
        lg:      "h-10 gap-2 px-4 rounded-md",
        icon:    "size-8 rounded-md",
        "icon-xs": "size-6 rounded",
        "icon-sm": "size-7 rounded",
        "icon-lg": "size-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
