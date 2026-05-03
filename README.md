# NeuraShield Front

Standalone React frontend for the NeuraShield web experience.

## What it does now

- upload one image in the browser;
- send it to the backend API via `multipart/form-data`;
- show the processed image returned by the server;
- download the protected result blob instead of the original file.

## Stack

- React
- Vite
- gh-pages

## Environment

Create a local `.env` file or export the variable before launch:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Local run

```bash
npm install
npm run dev
```

Frontend will be available on `http://localhost:5173`.

## Production build

```bash
npm run build
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

The Vite config uses a relative `base`, so the build output is suitable for static hosting on `gh-pages`.
