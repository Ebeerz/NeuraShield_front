# NeuraShield Front

Standalone React frontend for the NeuraShield web experience.

## What it does now

- upload one image in the browser;
- preview it instantly on the page;
- download the exact same file back unchanged;
- stay fully static so it can be published on GitHub Pages.

## Stack

- React
- Vite
- gh-pages

## Local run

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

The Vite config uses a relative `base`, so the build output is suitable for static hosting on `gh-pages`.
