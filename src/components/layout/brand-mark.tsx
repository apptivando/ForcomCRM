/**
 * The FORCOM wordmark — "FOR" in the brand red, "COM" in the
 * foreground colour, set in Barlow Condensed (`font-heading`). Same
 * two-tone lockup as the logo on forcom.tech, but as live text rather
 * than a PNG so it stays crisp at any zoom, inherits the accent token,
 * and works in both light and dark mode without a second asset.
 *
 * The brand name is deliberately never translated. The optional `CRM`
 * suffix marks *this* product inside the brand.
 *
 * Used by the sidebar header and by every full-page auth card
 * (login / signup / forgot-password / join) so the panel is
 * recognisably FORCOM before a user is even signed in.
 */

import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: { word: "text-xl", suffix: "text-[11px]" },
  lg: { word: "text-3xl", suffix: "text-xs" },
} as const;

export function BrandMark({
  size = "sm",
  showSuffix = true,
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  /** Render the "CRM" tag after the wordmark. */
  showSuffix?: boolean;
  className?: string;
}) {
  const s = SIZE_CLASS[size];
  return (
    <span className={cn("flex items-baseline gap-1.5", className)}>
      <span
        className={cn("font-heading leading-none font-bold tracking-tight", s.word)}
      >
        <span className="text-primary">FOR</span>
        <span className="text-foreground">COM</span>
      </span>
      {showSuffix && (
        <span
          className={cn(
            "font-medium tracking-[0.18em] text-muted-foreground uppercase",
            s.suffix,
          )}
        >
          CRM
        </span>
      )}
    </span>
  );
}
