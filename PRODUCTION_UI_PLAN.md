# TeachEd - production UI plan

This is the release-oriented UI backlog for `teached.tech`. The current
baseline is a healthy VPS/API, versioned static assets and a clean web-root
sync. Items below are ordered by user impact and release risk.

## P0 - release gates

- **Session recovery:** intercept API `401` responses in the shared client,
  show “Session expired”, preserve the current draft, and offer a single
  re-login action. Acceptance: no authenticated page becomes an unexplained
  empty state after token expiry.
- **Mobile layout:** run the main flows at 360, 390 and 768 px widths - home,
  board editor, lesson builder, teacher tools, profile and gradebook.
  Acceptance: no horizontal scroll, clipped primary actions or unreachable
  dialogs; keyboard focus remains visible.
- **Publish feedback:** every save, publish, clone and delete action needs a
  disabled/loading state, success confirmation and an actionable error. Never
  silently fall back after a failed API write.
- **Offline/PWA safety:** verify the service worker updates after a release
  and that an old cached HTML shell cannot point at removed assets.

## P1 - core teacher workflows

- **Home → next action:** surface the most recently updated board/lesson first,
  with a persistent primary CTA (“Open”, “Continue” or “Read full lesson”).
  Empty state must link directly to the builder.
- **Board editor:** keep selection, undo/redo and save status visible while
  scrolling; make duplicate, hide/show, delete and publish controls available
  from the selected-card toolbar with confirmation for destructive actions.
- **Lesson builder:** keep “Save lesson”, “Add to board” and “Publish” in one
  stable action row on desktop and a sticky bottom action bar on mobile.
- **Teacher tools:** show the local fallback mode explicitly when provider keys
  are not configured; generated content must be previewed before insertion.
- **Auth and billing:** show plan state, limits and provider availability in
  plain language; a disabled Stripe integration must not look like a broken
  checkout.

## P2 - polish and performance

- Split the heaviest board/editor code behind lazy routes; target a materially
  smaller first load without changing the card schema.
- Reduce hover-only interactions on touch devices and add reduced-motion
  support to the shared motion tokens.
- Keep typography, spacing, button states, empty states and toasts on the
  shared design tokens instead of per-page overrides.
- Add visual regression screenshots for the six P0 flows at the three mobile
  widths plus desktop.

## Release checklist

```text
[ ] npm/static checks pass locally
[ ] API health and unauthenticated route matrix pass
[ ] production config audit reports required keys ready
[ ] mobile smoke pass at 360/390/768 px
[ ] service-worker/version check pass
[ ] private paths remain 4xx (/.env, /.git, /backend, /ops)
[ ] deploy marker matches origin/main
```

Provider credentials (AI, Stripe, email and image search) are deliberately not
part of the UI code change. They must be supplied as fresh VPS environment
values and verified with `ops/check-prod-config.mjs` before enabling those
flows for real users.
