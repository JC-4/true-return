# TrueReturn

## Git

**Commit directly to `main` and push. Do not create branches.**

Single maintainer, no review step, and Vercel deploys from `main`. Work left on
a branch silently does not go live, which is worse than the risk branching
guards against. This overrides any default preference for feature branches.

## Database

Schema lives only in the hosted Supabase project — there is **no migrations
directory in this repo**. Schema changes are applied directly against Supabase
and are not represented in git, so a checkout does not describe the schema it
expects. Check the live schema before assuming a column exists.

## Rendering

`/developers` and `/developers/[slug]` are public, indexable and statically
rendered with `revalidate = 60`. Two things keep them that way:

- **Never call `getServerSession` in these pages.** Reading cookies opts the
  route out of the full route cache entirely.
- `/developers/[slug]` needs `generateStaticParams`. `revalidate` alone does
  not cache a dynamic segment — without a params list Next renders on demand
  and skips the route cache.

Admin-only affordances on these pages resolve client-side via
`components/AdminEditLink.tsx`, which reads an `isAdmin` flag set on the
session in `lib/auth.ts`. `ADMIN_USERNAME` is server-only and must stay that
way.

Note that props passed to a client component are serialised into the RSC
payload of a public page even when the component renders nothing — don't pass
admin URLs or non-public values into one.

## Images

Uploads go through per-resource routes (`/api/projects/[slug]/images`,
`/api/developers/[slug]/images`) into the shared `project-images` bucket,
namespaced by path prefix. Compression is client-side via
`browser-image-compression`.

**Never pass `fileType` to `imageCompression`.** It white-fills the canvas when
the output type matches `/jpe?g/`, and output defaults to the input's type.
Forcing JPEG flattens transparent PNG logos onto a white box.

## Logo tiles

Developer logos are transparent PNGs, so whatever sits behind them shows
through. **The tile background matches whatever surface it sits on** — there is
no single correct colour:

- Inside a card (developer page header, `/developers` index cards) →
  `bg-brand-raise`, the same token the card itself uses. On `/admin/developers`,
  which is not themed, that is still literal `bg-white`.
- Directly on the page background (the developer block under "About this
  project" on the project page) → **no background at all**.

Write the two branches separately rather than one element with a conditional
class. A wrapper carrying a background for both branches is what put a
transparent logo on black in the first place.

The initial-letter fallback is a different thing and keeps its own tinted chip,
square and at its own size. Only the logo branch follows the surface rule.
Logo tiles are wide (roughly 2:1) so wide logos aren't squeezed into a square.

## Colour

Colours go through the semantic `--c-*` tokens in `app/globals.css`, surfaced as
Tailwind `brand-*` utilities. There are two themes under one set of token names:

- `:root` holds the **legacy** cream/bronze values, still used by `/admin`,
  `/deals`, `/compare`, `/calculators` and `/s/[token]`.
- `.theme-os` holds the **Offplan Source** palette, and is applied at the root of
  each rebranded public route and on the shared nav.

A shared component (`ReturnAnalysisPanel`, `ProjectCard`, `LeadGenForm`) renders
in whichever theme its subtree sits in, so **never reintroduce a colour literal
in a component** — it would pin that component to one theme.

Only `brand-ink`, `brand-paper`, `brand-tl` and `brand-td` accept an alpha
modifier (`bg-brand-ink/70`); they are backed by RGB triplets. Every other token
is a `color-mix()` result, which cannot carry `<alpha-value>` — an opacity
modifier on one fails **silently**. Use the dedicated token instead
(`bg-brand-accent-hover`, `bg-brand-pos-soft`).

## Admin gating

Admin pages and write routes check `session.user.email === ADMIN_USERNAME`,
redirecting to `/login?callbackUrl=…` or returning 401/403. Follow the existing
pattern in `app/(main)/admin/projects/[slug]/edit`.
