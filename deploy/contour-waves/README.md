# contour-waves — static deploy target

`index.html` is the contour-wave canvas animation, byte-for-byte as supplied
(md5 `68abf82ff143961a51268e2e3c586b30`). Nothing in it was edited: the fixed
340×431 box, the viewport meta and the overflow rules are untouched.

This folder is a complete static site with no build step and no dependencies.
Point any static host at it and `index.html` is served at `/`.

## Vercel, from a local terminal

```
npx vercel deploy --prod
```

Run it inside a copy of this folder. First run asks to link a project; accept
the defaults and answer "Other" for the framework, empty for build and output.
The `--prod` URL it prints is permanent.

## Vercel, from the dashboard (no local terminal)

Add New → Project → import `anikamalyarenko/dance-finder-warsaw`, then:

- **Root Directory**: `deploy/contour-waves` — without this Vercel finds the
  Vite app at the repo root and builds that instead.
- **Framework Preset**: Other. Leave Build Command and Output Directory empty.
- **Settings → Git → Production Branch**: the branch this folder lives on.
  Vercel only gives a stable domain to production deployments; every other
  branch gets a per-commit preview URL that changes on each push.
