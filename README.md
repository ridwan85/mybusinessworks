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
- Privacy: `/privacy/` ([live](https://mybusinesswork.com/privacy/)).
- No prices on-site (must stay current on Amazon).
- Affiliate links use `?tag=` from `AMAZON_ASSOCIATE_TAG` and `rel="sponsored nofollow"`.

## 4. Pinterest (internal, compliant publisher)

CLI-only tooling for **your** MyBusinessWorks account. Official Pins API only. Each pin requires typing `publish` — no silent batch auto-post.

### Register the developer app

1. Create/connect an app at [developers.pinterest.com](https://developers.pinterest.com/).
2. Redirect URI (register exactly): `https://mybusinesswork.com/oauth/pinterest/`  
   That page lives on this site and hands the auth code to your local CLI (`127.0.0.1:8787`). Set the same value in `.env` as `PINTEREST_REDIRECT_URI`.
3. Request scopes: `boards:read`, `pins:read`, `pins:write`.
4. For app review, link privacy policy `https://mybusinesswork.com/privacy/` and describe an **internal content tool** that drafts pins from Daily Viral Deals reviews and publishes only after you confirm each pin.
5. Put `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, and `PINTEREST_BOARD_ID` in `.env`.

### Auth → draft → publish

```bash
# Deploy the site first so /oauth/pinterest/ is live, then:
npm run pinterest:oauth
# (opens browser → Pinterest → mybusinesswork.com/oauth/pinterest/ → local CLI)
# If handoff fails, the page shows the code:
# npm run pinterest:oauth -- --code PASTE_CODE_HERE

# Build draft + generate a dedicated Pinterest Pin image (does not publish)
# Image: 1000×1500 (2:3) with the review HOOK on the image
# Description: starts with the same HOOK
npm run pinterest:draft
npm run pinterest:draft -- hellobaby-hb6550-no-wifi-baby-monitor-review-b09gm8jzm9

# Deploy so /images/reviews/<asin>/pinterest-pin.jpg is live, then:
# Publish ONE draft after typing "publish" to confirm
npm run pinterest:publish -- data/pinterest/drafts/<file>.json
```

**Before publish, every Pin must have:**
1. A generated **Pinterest image** at **1000×1500 (2:3)** with the **hook text on the image** (`public/images/reviews/<asin>/pinterest-pin.jpg`)
2. The **same hook in the Pin description** (title also uses the hook)

`pinterest:publish` refuses drafts that skip those. Drafts live in `data/pinterest/drafts/`. Publish receipts (pin id + timestamp only) go to `data/pinterest/published/`. We do not scrape the Pinterest UI or store other users’ Pins.
