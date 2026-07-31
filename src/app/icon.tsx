import { ImageResponse } from "next/og";

// Browser-tab mark — FORCOM red rounded square with a white "F",
// matching the sidebar logo in `src/components/layout/sidebar.tsx` and
// the red of the wordmark on forcom.tech. Next.js renders this at
// build time and auto-injects <link rel="icon"> into <head>.
//
// This route takes precedence over src/app/favicon.ico, which is the
// Next.js default and can stay on disk harmlessly (or be removed).

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#E8231A", // --primary — FORCOM brand red
          borderRadius: 6,
          color: "#ffffff",
          fontSize: 23,
          fontWeight: 700,
          lineHeight: 1,
          // The glyph's optical centre sits a hair below the box's
          // geometric centre at 32px; nudge it back up.
          paddingBottom: 2,
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
