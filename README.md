# Amazon Affiliate Review Site (Astro + GitHub Pages)

Input an Amazon product link, get an SEO-optimized Markdown review with your affiliate link and the required disclosure, published as a static site.

## 1. Setup

Requires Node.js 20.6+ (check with `node -v`; install from https://nodejs.org if needed).

```bash
npm install
cp .env.example .env     # then put your OPENAI_API_KEY in .env (never commit it)
```

## 2. Add a review

```bash
npm run generate -- "https://www.amazon.com/dp/B0XXXXXXXX"
```

The first run creates `data/products/<ASIN>.json`. Fill in the title, "About this item" bullets and image URLs
(copy image links via Amazon Associates SiteStripe), then run the command again. A review is written to `src/content/reviews/`.

Preview locally: `npm run dev`

## 3. Deploy to GitHub Pages

1. Create an empty repo on GitHub (e.g. `amazon-affiliate`).
2. Push:
   ```bash
   git init && git add . && git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/amazon-affiliate.git
   git push -u origin main
   ```
3. On GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
5. After each new review: `git add . && git commit -m "Add review" && git push`.

## 4. Custom domain (mybusinesswork.com)

`public/CNAME` already contains `mybusinesswork.com`.

1. In GitHub: **Settings > Pages > Custom domain**, enter `mybusinesswork.com`, Save.
2. At your registrar's DNS settings, add:

   | Type  | Host/Name | Value                    |
   |-------|-----------|--------------------------|
   | A     | `@`       | `185.199.108.153`        |
   | A     | `@`       | `185.199.109.153`        |
   | A     | `@`       | `185.199.110.153`        |
   | A     | `@`       | `185.199.111.153`        |
   | CNAME | `www`     | `<your-username>.github.io` |

   Remove any conflicting old A/AAAA/CNAME records for `@` and `www`. If using Cloudflare, set the records to "DNS only" (grey cloud) until HTTPS is issued.
3. Wait for DNS to propagate (minutes to a few hours; check with https://dnschecker.org).
4. Back in **Settings > Pages**, tick **Enforce HTTPS** once it becomes available.

## Compliance notes

- Every page footer and every review carry: "As an Amazon Associate I earn from qualifying purchases."
- Prices are intentionally not shown (Amazon requires them to be current).
- Amazon images are hotlinked from Amazon's CDN; use only images you obtain through Associates tools.
