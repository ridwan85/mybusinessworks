// Usage: npm run pinterest:draft [-- <slug-or-asin>] [--skip-image] [--own-photo] [--ai-scene]
// Builds pin draft JSON and a 1000×1500 text graphic (hook + benefits + brand colors).
// Does NOT publish. Does not read Amazon product photos.
//   --own-photo   place public/images/reviews/<asin>/own.jpg on the graphic
//   --ai-scene    Gemini edit of that own photo only; requires PIN_ALLOW_AI_SCENE=1
import {
    assertDraftReadyForPublish,
    buildPinDraft,
    fail,
    listDraftableReviews,
    writeDraft,
    PIN_HEIGHT,
    PIN_WIDTH,
    PIN_ASPECT,
} from './lib/pinterest.mjs';
import { generatePinterestPinImage } from './lib/pinterest-pin-image.mjs';

const args = process.argv.slice(2);
const skipImage = args.includes('--skip-image');
const imageMode = args.includes('--ai-scene') ? 'ai-scene' : args.includes('--own-photo') ? 'own' : 'template';
const filter = args.find((a) => !a.startsWith('--'));

const reviews = await listDraftableReviews(filter);
if (!reviews.length) {
    fail(filter ? `No reviews matched "${filter}".` : 'No reviews found in src/content/reviews/.');
}

console.log(`Building ${reviews.length} pin draft(s)…`);
console.log(`Pin image: ${PIN_WIDTH}×${PIN_HEIGHT} (${PIN_ASPECT}), mode ${imageMode}. Amazon product photos are not used.\n`);

for (const review of reviews) {
    if (!String(review.hook || '').trim()) {
        fail(`Review ${review.slug} has no hook — cannot build a compliant Pin.`);
    }

    let pinImageReady = false;
    if (skipImage) {
        console.log(`⚠ Skipping Pin image generation for ${review.slug} (--skip-image). Publish will refuse until generated.`);
    } else {
        await generatePinterestPinImage(review, { mode: imageMode });
        pinImageReady = true;
    }

    const draft = buildPinDraft(review, { pinImageReady, imageMode });
    if (pinImageReady) {
        // Ensure publish gate passes after successful generation.
        assertDraftReadyForPublish(draft);
    }

    const file = await writeDraft(draft);
    console.log(`✓ ${draft.slug}`);
    console.log(`  hook:  ${draft.hook}`);
    console.log(`  title: ${draft.title}`);
    console.log(`  desc:  ${draft.description.slice(0, 120).replace(/\n/g, ' ')}…`);
    console.log(`  media: ${draft.mediaUrl}`);
    console.log(`  file:  ${file}\n`);
}

console.log('Next: deploy so the Pin image URL is live, then publish one draft:');
console.log('  npm run pinterest:publish -- data/pinterest/drafts/<id>.json');
console.log('(You must type "publish" to confirm each pin.)\n');
