# SootyEdge

A precision trading framework landing page built with React + Vite.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run locally
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Then connect your domain at vercel.com → Project → Settings → Domains.

## DNS Setup (at your registrar)

| Type  | Name | Value                  |
|-------|------|------------------------|
| A     | @    | 76.76.21.21            |
| CNAME | www  | cname.vercel-dns.com   |

## Project Structure

```
sootyedge/
├── index.html          # HTML entry point
├── vite.config.js      # Vite config
├── package.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx        # React root
    └── App.jsx         # Full site (all components + CSS)
```
