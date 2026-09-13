# TrueReturn

## Git

**Commit directly to `main` and push. Do not create branches.**

Single maintainer, no review step, and Vercel deploys from `main`. Work left on
a branch silently does not go live, which is worse than the risk branching
guards against. This overrides any default preference for feature branches.

## Local development

**Port 3000 is Jackson's dev server.** Never start a server on it and never
kill a process on it, whatever the process looks like. An orphaned
`next-server` on 3000 is not yours to clean up. Previews go on **3100**.

**The launch config lives outside this repo**, at
`Websites/.claude/launch.json` in the parent directory. There is deliberately
no `.claude/launch.json` here: when both existed the parent won, so edits to the
repo-level file did nothing and gave no sign of it. A clone of this repo has no
launch config at all and one has to be created in the parent.

The port comes from passing `-- -p 3100` through to the `dev` script, not from
the config's `port` field, which only tells the tool what to expect. `npm run
dev` on its own stays on 3000 for Jackson. The parent config currently reads:

```json
{
  "name": "true-return",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev", "--", "-p", "3100"],
  "cwd": "…/Websites/true-return",
  "port": 3100,
  "autoPort": false
}
```

Note that `NEXTAUTH_URL` in `.env.local` is `http://localhost:3000`. Sign-in on
a 3100 preview will therefore redirect to 3000, so the authenticated layout
cannot be exercised on a preview without changing that variable, which would
break the 3000 server it belongs to. Verify authenticated views another way.

**Never run `npm run build` while a dev server is running.** The build
overwrites `.next`, and the running dev server then fails on every request with
`Cannot find module './NNNN.js'` (or `./vendor-chunks/*.js`). It looks like a
broken import and it is not. The build has pulled the chunks out from under
the running server. Recovery: stop the server, `rm -rf .next`, start it again.

Stop the preview before building, and start it again afterwards.

## Database

Schema lives only in the hosted Supabase project — there is **no migrations
directory in this repo**. Schema changes are applied directly against Supabase
and are not represented in git, so a checkout does not describe the schema it
expects. Check the live schema before assuming a column exists.

`projects.status` is a CHECK constraint: `launching_soon`,
`limited_availability`, `off_plan`, or **null**. Null is the default and the
correct value when the state is unknown — it renders no badge at all, on both
the project hero and ProjectCard.

It is mirrored in three places that must be changed together: `STATUS_LABELS`
in `lib/format.ts`, the admin edit `<select>`, and the `/projects` filter
`<select>`. An unmapped status falls through to its raw slug in the UI rather
than erroring, so a drift here is silent.

Status also drives the hero CTA: `ctaLabel` in `ProjectDetail.tsx` returns
"Register your interest" for `launching_soon` and "Get prices and availability"
for everything else including null. A new status value needs a decision there
too, not just a label.

## Rendering

`/developers` and `/developers/[slug]` are public, indexable and statically
rendered with `revalidate = 60`. Two things keep them that way:

- **Never call `getServerSession` in these pages.** Reading cookies opts the
  route out of the full route cache entirely.
- `/developers/[slug]` needs `generateStaticParams`. `revalidate` alone does
  not cache a dynamic segment — without a params list Next renders on demand
  and skips the route cache.

**An empty `generateStaticParams` fails the build on purpose.** Next treats an
empty param list as success: the route prerenders nothing, silently falls back
to on-demand rendering, and `next build` exits 0. Nothing in the output says
the route cache is gone, and `revalidate` never re-runs `generateStaticParams`,
so it stays gone until the next deploy. This has happened — a transient
`ECONNRESET` to Supabase mid-build took the old `if (error) return []` path and
shipped a build with no prerendered slugs.

Both list queries now go through `requireStaticParams` in `lib/static-params.ts`,
which throws during a production build on either a query error or an empty
result, and only logs in dev. Don't reintroduce a bare `return []`.

Admin-only affordances on these pages resolve client-side via
`components/AdminEditLink.tsx`, which reads an `isAdmin` flag set on the
session in `lib/auth.ts`. `ADMIN_USERNAME` is server-only and must stay that
way.

Note that props passed to a client component are serialised into the RSC
payload of a public page even when the component renders nothing — don't pass
admin URLs or non-public values into one.

## The project page layout split

`/projects/[slug]` renders one of two layouts, and **`insight` is the switch**:

```ts
const insight = insightProp ?? fetchedInsight ?? undefined
const isAuth  = !!insight
```

The client-side fetch of `/api/projects/[slug]/insight` in `ProjectDetail.tsx`
is **not** an enhancement to one tab — it decides which layout renders at all.
Remove it and every signed-in visitor collapses onto the public layout, losing
the Return Analysis tab, My Take, the documents viewer, the `AdminEditLink` in
the tab row, and the `calcInitialValues` seeding from `insight.defaultParams`.
It has to stay client-side: reading the session on the server would opt the
route out of the route cache (see **Rendering**).

`/projects/[slug]/insight/[id]` renders the same component with
`insight={insight ?? {}}`. **`{}` is truthy and that is load-bearing** — the
share route always gets the authenticated layout, even for a project with no
analysis written yet. The same is true of the API, which returns `{}` rather
than 404 for that case. Don't "tidy" either into a nullish value.

`/s/[token]` does **not** use `ProjectDetail`. It composes
`ReturnAnalysisPanel` and `BrochureTab` directly and reads documents from its
own token-scoped endpoint, so it is unaffected by any of the above.

### The public layout has no tab bar

The public layout is overview-only; its Return Analysis and Brochure tabs were
removed, and a bar with one item is just a heading. The authenticated layout
keeps its own three-tab bar.

Because of that, `scroll-padding-top` is conditional:

```ts
html { scroll-padding-top: ${isAuth ? 116 : 64}px; }
```

64px is the sticky site nav; the authenticated layout adds a 52px sticky tab
bar on top of it. Hardcoding 116px again would drop every in-page anchor 52px
short of its target on the public page.

### Deliberately unreachable code — do not delete

Removing the public tabs orphaned code that is **kept on purpose**, for the
brochure CTA section and the client-facing analysis view:

- `BrochureForm` and `BrochureWhatsappLink` in `ProjectDetail.tsx` (and with
  them that file's `whatsappLinkProps` import — `lib/whatsapp.ts` itself is
  still live via `LeadFormShared`).
- `LockedAnalysisPanel` in `ProjectDetail.tsx`, which was already unrendered
  before the tabs came out.
- The whole `showFullAnalysis={false}` branch of `ReturnAnalysisPanel` — the
  `locked:` pill flags, the `blur-sm select-none` treatments and the
  `showFullAnalysis ? … : …` split. Every remaining caller passes `true`, so
  the prop is currently a constant. Don't collapse it.

`noUnusedLocals` is off and there is no eslintrc, so none of this fails a
build while it waits.

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
