# mybusinesswork.com (Astro + GitHub Pages)

Amazon affiliate review site. Paste a product link → generate a locked-format review → publish static pages.

## Locked review format

Every product page uses the same arc (do not invent a new structure):

1. **Hook** — real-life situation headline + support (`time` | `convenience` | `incident`)
2. **Why it helps** — 3–4 concrete everyday points (`whyHelps`)
3. **Details** — Quick verdict → What it does → Who it’s for → The good parts → Honest limits → FAQ → Bottom line
4. **Buy it if / Skip it if** and a 3-row compare table — template-owned, filled from each review
5. **CTA** — Amazon orange “Check Price on Amazon” (template-owned, tagged affiliate URL)

Copy is plain (about a grade 5–6 reading level). Attribute facts with “the listing says” or “buyers say.” Do not claim you tried the product, and do not add “this page did not test” lines.

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

1. First `generate` run may create `data/products/<ASIN>.json` — fill `title` and `features`. Optional images:
   - `siteStripe` / `siteStripeImage`: Amazon-hosted image from SiteStripe or the Product Advertising API. Do not download it.
   - `ownImage`: a photo you took, `/images/reviews/<asin>/own.jpg`.
   - `imageUrl` / `showcases`: an on-site lifestyle creative you already made. Do not point these at `source.jpg` or a file saved from Amazon.
2. Review Markdown is written to `src/content/reviews/` in the locked format.
3. Preview: `npm run dev`
4. Publish: `git add . && git commit -m "Add review" && git push` (GitHub Actions deploys `master`).

Overwrite an existing review: `npm run generate -- "https://www.amazon.com/dp/ASIN" --force`

## 3. Deploy / custom domain

Brand on the site and on pins: **mybusinesswork.com**. `public/CNAME` points at that domain (also set `site` in `astro.config.mjs` if the domain changes).

GitHub Pages: **Settings → Pages → Source: GitHub Actions**.

DNS (apex + www) uses GitHub Pages A/CNAME records as documented in GitHub’s Pages custom-domain guide.

## Compliance

- Disclosure: “As an Amazon Associate I earn from qualifying purchases.”
- Privacy: `/privacy/` ([live](https://mybusinesswork.com/privacy/)).
- No prices on-site (must stay current on Amazon).
- Affiliate links use `?tag=` from `AMAZON_ASSOCIATE_TAG` and `rel="sponsored nofollow"`.
- **Required:** do not re-host Amazon product photos. Do not commit `source.jpg` or any file downloaded from Amazon. An Amazon product image on the site must be an image URL that stays on Amazon’s servers (`siteStripeImage`, from SiteStripe or the Product Advertising API).
- **Separate choice:** lifestyle creatives already in `public/images/reviews/` (not Amazon downloads) may stay on review pages. The text card is only the fallback when a review has no allowed image. Removing those creatives is optional and should wait until a SiteStripe URL or your own photo is ready to replace them.
- `ownImage` (`/images/reviews/<asin>/own.jpg`) is an original image you supply: a photo you took, or an original lifestyle stand-in that was not copied from an Amazon listing. New Pinterest pins still default to a text graphic and do not build scenes from Amazon photos.

## 4. Pinterest (internal, compliant publisher)

CLI-only tooling for **your** MyBusinessWorks account. Official Pins API only. Each pin requires typing `publish` — no silent batch auto-post.

### Register the developer app

1. Create/connect an app at [developers.pinterest.com](https://developers.pinterest.com/).
2. Redirect URI (register exactly): `https://mybusinesswork.com/oauth/pinterest/`  
   That page lives on this site and hands the auth code to your local CLI (`127.0.0.1:8787`). Set the same value in `.env` as `PINTEREST_REDIRECT_URI`.
3. Request scopes: `boards:read`, `boards:write`, `pins:read`, `pins:write`.
4. For app review, link privacy policy `https://mybusinesswork.com/privacy/` and describe an **internal content tool** that drafts pins from mybusinesswork.com reviews and publishes only after you confirm each pin.
5. Put `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, and `PINTEREST_BOARD_ID` in `.env`.
6. **Trial vs Standard:** new apps start on **Trial**. Trial cannot create Pins on production (`api.pinterest.com`) — you’ll get HTTP 403. For real Pins on your public boards, open the app → **Upgrade to Standard access**, link `https://mybusinesswork.com/privacy/`, and upload a short screen recording of `pinterest:oauth` + one confirmed `pinterest:publish`. Until approved, either test against the sandbox (`PINTEREST_USE_SANDBOX=1`) **or** publish via **Zernio** (temporary bypass): set `ZERNIO_API_KEY` + `ZERNIO_PINTEREST_ACCOUNT_ID` from [zernio.com](https://zernio.com), run `npm run zernio:profiles`, then `pinterest:publish` still requires typing `publish`. Force native API with `PINTEREST_PUBLISH_VIA=pinterest`.

### Auth → draft → publish

```bash
# Deploy the site first so /oauth/pinterest/ is live, then:
npm run pinterest:oauth
# (opens browser → Pinterest → mybusinesswork.com/oauth/pinterest/ → local CLI)
# If handoff fails, the page shows the code:
# npm run pinterest:oauth -- --code PASTE_CODE_HERE

# One-time, for pin graphics only (not required to build the site):
# npm install sharp

# Build draft + a 1000×1500 text graphic (does not publish)
# Graphic: hook, benefit lines, and brand colors. No Amazon product photo.
# Description: starts with the same hook and ends with the Associate disclosure
npm run pinterest:draft
npm run pinterest:draft -- hellobaby-hb6550-no-wifi-baby-monitor-review-b09gm8jzm9

# Optional: put YOUR photo (not an Amazon download) on the graphic
# save public/images/reviews/<asin>/own.jpg
npm run pinterest:draft -- hellobaby-hb6550-no-wifi-baby-monitor-review-b09gm8jzm9 --own-photo

# Gemini scenes stay off. They only run for own.jpg, and only when you opt in:
# PIN_ALLOW_AI_SCENE=1 npm run pinterest:draft -- <slug> --ai-scene

# Deploy so /images/reviews/<asin>/pinterest-pin.jpg is live, then:
# Publish ONE draft after typing "publish" to confirm
npm run pinterest:publish -- data/pinterest/drafts/<file>.json
```

**Before publish, every Pin must have:**
1. A **Pinterest image** at **1000×1500 (2:3)** with the **hook text on the image** (`public/images/reviews/<asin>/pinterest-pin.jpg`). New images are text graphics. Do not build them from Amazon product photos.
2. The **same hook in the Pin description**, plus “As an Amazon Associate I earn from qualifying purchases.”

`pinterest:publish` refuses drafts that skip those. Drafts live in `data/pinterest/drafts/`. Publish receipts (pin id + timestamp only) go to `data/pinterest/published/`. We do not scrape the Pinterest UI or store other users’ Pins.
