import { cn } from '@/lib/cn';
import { withBasePath } from '@/lib/shared';

// We1ssBoard logo (media/brand, built by tools/brand/build.mjs); theme-aware via
// `dark:`. Pass a height class (e.g. `h-6`); width follows the 5:1 artwork.
export function Logo({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBasePath('/logo-light.svg')}
        alt="We1ssBoard"
        className={cn('w-auto dark:hidden', className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBasePath('/logo-dark.svg')}
        alt="We1ssBoard"
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
      <img
        src={withBasePath('/mark.svg')}
        alt=""
        aria-hidden
        className={cn('w-auto dark:hidden', className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBasePath('/mark-dark.svg')}
        alt=""
        aria-hidden
        className={cn('hidden w-auto dark:block', className)}
      />
    </>
  );
}
