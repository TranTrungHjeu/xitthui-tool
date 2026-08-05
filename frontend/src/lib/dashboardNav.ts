/**
 * Dashboard public-tool URL helpers.
 *
 * Split out from `app/dashboard/layout.tsx` because Next.js App Router
 * disallows arbitrary named exports from layout/page/loading/error files —
 * only `default` plus a small allowlist (`config`, `generateStaticParams`,
 * `generateMetadata`, etc.) is permitted. Exporting helpers from those files
 * trips the build's `checkFields<Diff<...>>` constraint check.
 *
 * Kept under `@/lib/` so any route (page, tool sub-route, sidebar item) can
 * import without depending on the layout module.
 */

import type { PublicToolEntry } from "./access";
import { PUBLIC_TOOLS } from "./access";

/**
 * Build the URL a public tool renders at inside the dashboard shell.
 * All tools share the `/dashboard` shell and switch via
 * `/dashboard/tools/<key>`.
 */
export function toolHref(toolKey: string): string {
  return `/dashboard/tools/${toolKey}`;
}

/**
 * Returns the public tool entry matching the given key, or null when the
 * key is unknown.
 */
export function findPublicTool(
  toolKey: string | null | undefined,
): PublicToolEntry | null {
  if (!toolKey) return null;
  return PUBLIC_TOOLS.find((t) => t.key === toolKey) ?? null;
}