import { cn } from '@/lib/cn';

// FullBoard logo (media/brand, built by tools/brand/build.py); theme-aware via
// `dark:`. Pass a height class (e.g. `h-6`); width follows the 17:4 artwork.
export function Logo({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-light.svg" alt="FullBoard" className={cn('w-auto dark:hidden', className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dark.svg"
        alt="FullBoard"
        className={cn('hidden w-auto dark:block', className)}
      />
    </>
  );
}

// Square mark alone, for places that already print the product name.
export function Mark({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mark.svg" alt="" aria-hidden className={cn('w-auto dark:hidden', className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mark-dark.svg"
        alt=""
        aria-hidden
        className={cn('hidden w-auto dark:block', className)}
      />
    </>
  );
}
