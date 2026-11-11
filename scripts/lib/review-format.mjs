/**
 * Locked Daily Viral Deals review format.
 * Every new product review must follow Hook → Why it helps → Details → CTA.
 * The Astro template owns CTAs + disclosure UI; Markdown body is details only.
 */

export const ANGLES = ['time', 'convenience', 'incident'];

export const BODY_SECTIONS = [
    'Quick Verdict',
    'Key Features',
    'Who It\'s For',
    'Pros',
    'Things to Consider',
    'FAQ',
    'Final Verdict',
];

export const DEFAULT_CTA = 'Check Price on Amazon';

export const SYSTEM_PROMPT =
    'You are an experienced US affiliate product reviewer and conversion copywriter for Daily Viral Deals. ' +
    'Write in American English, helpful and honest. ' +
    'Use ONLY the facts supplied. Never invent specifications, prices, ratings, awards, or claim hands-on testing. ' +
    'Do not make medical or guaranteed-result claims. Do not include links, a title (H1), or any affiliate disclosure. ' +
    'Page structure is locked: Hook → Why it helps in real life → Details → Amazon CTA (template owns CTAs). ' +
    'Pick ONE primary angle: "time" (saves time), "convenience" (fewer steps / easier), or "incident" (avoids a real-life mess, waste, failure, or headache). ' +
    'Return JSON with keys: ' +
    '"title" (SEO title, max 60 chars, includes the product name), ' +
    '"description" (meta description, max 155 chars), ' +
    '"angle" (one of: time, convenience, incident), ' +
    '"hook" (max 90 chars: real-life situation headline; concrete everyday scene; do not require the product name), ' +
    '"hookSupport" (1-2 sentences, max 220 chars: connect that situation to how this product helps, using only supplied facts), ' +
    '"whyHelps" (array of 3-4 short sentences: each explains a concrete real-life benefit tied to the chosen angle; busy-shopper advice, not a feature dump), ' +
    '"ctaLabel" (short Amazon button label, usually "Check Price on Amazon"), ' +
    '"imageCaption" (one genuine caption describing what a product photo shows or does in real life; never prompt-style words like showcase, lifestyle shot, marble look, cinematic, or background), ' +
    '"imageCaptions" (optional array of 0-3 extra genuine photo captions in the same style, for additional product images if provided), ' +
    '"body" (Markdown, 900-1300 words, H2/H3 EXACTLY in this order: Quick Verdict, Key Features, Who It\'s For, Pros, Things to Consider, FAQ (3-4 questions), Final Verdict). ' +
    'Do NOT include Where to Buy, Disclosure, Hook, or Why it helps sections in body—the template owns those.';

export function normalizeReviewOutput(out, { hasImages = false } = {}) {
    const errors = [];
    if (!out?.title) errors.push('missing title');
    if (!out?.description) errors.push('missing description');
    if (!out?.hook) errors.push('missing hook');
    if (!out?.hookSupport) errors.push('missing hookSupport');
    if (!out?.body) errors.push('missing body');
    if (!ANGLES.includes(out?.angle)) errors.push('angle must be time, convenience, or incident');

    const whyHelps = Array.isArray(out?.whyHelps)
        ? out.whyHelps.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 4)
        : [];
    if (whyHelps.length < 2) errors.push('whyHelps needs at least 2 real-life points');

    let body = String(out.body || '')
        .replace(/^##\s*Where to Buy[\s\S]*?(?=^##\s|\Z)/gim, '')
        .replace(/^##\s*Disclosure[\s\S]*?(?=^##\s|\Z)/gim, '')
        .replace(/^>\s*\*\*Disclosure:\*\*[\s\S]*?(?=\n## |\n# |\Z)/gim, '')
        .trim();

    for (const section of BODY_SECTIONS) {
        if (!new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(body)) {
            errors.push(`body missing H2: ${section}`);
        }
    }

    const bannedCaption = /\b(showcase|lifestyle shot|product shot|marble look|cinematic|prompt|mockup|hero image|background)\b/i;
    let imageCaption = String(out.imageCaption || '').trim();
    if (hasImages) {
        if (!imageCaption) errors.push('missing imageCaption');
        else if (bannedCaption.test(imageCaption)) errors.push('imageCaption sounds like a prompt; describe what the photo shows/does');
    }

    const imageCaptions = Array.isArray(out.imageCaptions)
        ? out.imageCaptions.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3)
        : [];
    for (const [i, cap] of imageCaptions.entries()) {
        if (bannedCaption.test(cap)) errors.push(`imageCaptions[${i}] sounds like a prompt`);
    }

    if (errors.length) {
        const err = new Error(errors.join('; '));
        err.details = errors;
        throw err;
    }

    return {
        title: String(out.title).trim(),
        description: String(out.description).trim(),
        angle: out.angle,
        hook: String(out.hook).trim(),
        hookSupport: String(out.hookSupport).trim(),
        whyHelps,
        ctaLabel: String(out.ctaLabel || DEFAULT_CTA).trim() || DEFAULT_CTA,
        imageCaption: imageCaption || undefined,
        imageCaptions,
        body,
    };
}

export function buildImagesFrontmatter({ imageSrc, showcases = [], imageCaption, imageCaptions = [] }) {
    const paths = [];
    if (imageSrc) paths.push(imageSrc);
    for (const s of showcases) {
        const src = typeof s === 'string' ? s : s?.src;
        if (src && !paths.includes(src)) paths.push(src);
    }
    if (!paths.length) return { imagesLine: null, imageCaptionLine: null };

    const captions = [imageCaption, ...imageCaptions].filter(Boolean);
    const images = paths.map((src, i) => ({
        src,
        caption: captions[i] || captions[0] || 'Product photo for this review.',
        alt: captions[i] || captions[0] || 'Product photo',
    }));

    return {
        imagesLine: `images: ${JSON.stringify(images)}`,
        imageCaptionLine: imageCaption ? `imageCaption: ${JSON.stringify(imageCaption)}` : `imageCaption: ${JSON.stringify(images[0].caption)}`,
    };
}
