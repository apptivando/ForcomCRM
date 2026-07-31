/**
 * Single source of truth for the date-fns locale used by every
 * `format` / `formatDistanceToNow` call in the UI.
 *
 * next-intl localizes the message catalog, but date-fns has its own
 * locale registry and defaults to en-US — so without this every
 * "2 hours ago" and "Mar 3" rendered in English inside an otherwise
 * Spanish panel. Importing `DATE_LOCALE` and passing it as the
 * `locale` option keeps the two in sync.
 *
 * Driven by the same env var as `src/i18n/request.ts`; anything we
 * don't have a mapping for falls back to English, which matches the
 * message-catalog fallback.
 */

import { enUS, es, ko, type Locale } from "date-fns/locale";

const LOCALES: Record<string, Locale> = { en: enUS, es, ko };

export const DATE_LOCALE: Locale =
  LOCALES[process.env.NEXT_PUBLIC_APP_LOCALE || "es"] ?? enUS;
