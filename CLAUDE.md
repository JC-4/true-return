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

## Admin gating

Admin pages and write routes check `session.user.email === ADMIN_USERNAME`,
redirecting to `/login?callbackUrl=…` or returning 401/403. Follow the existing
pattern in `app/(main)/admin/projects/[slug]/edit`.
