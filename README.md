# Daily Viral Deals (Astro + GitHub Pages)

Amazon affiliate review site. Paste a product link → generate a locked-format review → publish static pages.

## Locked review format

Every product page uses the same arc (do not invent a new structure):

1. **Hook** — real-life situation headline + support (`time` | `convenience` | `incident`)
2. **Why it helps** — 3–4 concrete everyday points (`whyHelps`)
3. **Details** — Quick Verdict → Key Features → Who It’s For → Pros → Things to Consider → FAQ → Final Verdict
4. **CTA** — Amazon orange “Check Price on Amazon” (template-owned, tagged affiliate URL)

Image captions must describe what the photo shows/does in real life — never prompt-style words like “showcase”, “lifestyle shot”, or “marble look”.

`npm run generate` enforces this via `scripts/lib/review-format.mjs`. Astro schema also requires `hook`, `hookSupport`, `whyHelps`, and `angle`.

## 1. Setup

Requires Node.js 20.6+ (`node -v`).

```bash
npm install
cp .env.example .env     # add API keys + AMAZON_ASSOCIATE_TAG (never commit .env)
```

## 2. Add a product review

```bash
# Option A: bookmarklet copy → import
# open tools/bookmarklet.html, copy product on Amazon, then:
npm run import

# Option B: generate (creates data/products/<ASIN>.json on first run)
npm run generate -- "https://www.amazon.com/dp/B0XXXXXXXX"
# or short links: https://link.amazon/... / amzn.to/...
```

1. First `generate` run may create `data/products/<ASIN>.json` — fill `title`, `features`, optional `imageUrl` / `showcases` / SiteStripe, then run again.
2. Review Markdown is written to `src/content/reviews/` in the locked format.
3. Preview: `npm run dev`
4. Publish: `git add . && git commit -m "Add review" && git push` (GitHub Actions deploys `master`).

Overwrite an existing review: `npm run generate -- "https://www.amazon.com/dp/ASIN" --force`

## 3. Deploy / custom domain

Brand: **Daily Viral Deals**. `public/CNAME` currently points at `mybusinesswork.com` (also set `site` in `astro.config.mjs` if the domain changes).

GitHub Pages: **Settings → Pages → Source: GitHub Actions**.

DNS (apex + www) uses GitHub Pages A/CNAME records as documented in GitHub’s Pages custom-domain guide.

## Compliance

- Disclosure: “As an Amazon Associate I earn from qualifying purchases.”
- No prices on-site (must stay current on Amazon).
- Affiliate links use `?tag=` from `AMAZON_ASSOCIATE_TAG` and `rel="sponsored nofollow"`.
