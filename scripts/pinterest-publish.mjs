// Usage: npm run pinterest:publish -- <draft-json>
// Shows the draft, requires typing "publish", then creates ONE pin.
// Uses Zernio (zernio.com) when ZERNIO_API_KEY is set — bypass while Pinterest
// Standard access is blocked. Set PINTEREST_PUBLISH_VIA=pinterest to force native API.
// Refuses drafts that lack hook-on-image + hook-in-description Pin assets.
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
    assertDraftReadyForPublish,
    createPin,
    fail,
    readDraft,
    refreshAccessTokenIfNeeded,
    requireEnv,
    writePublishReceipt,
    PIN_FILENAME,
    PIN_HEIGHT,
    PIN_WIDTH,
    PIN_ASPECT,
} from './lib/pinterest.mjs';
import { createPinViaZernio, shouldPublishViaZernio } from './lib/zernio.mjs';

const draftPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!draftPath) {
    fail('Pass a draft file: npm run pinterest:publish -- data/pinterest/drafts/<id>.json');
}

const draft = await readDraft(draftPath);
assertDraftReadyForPublish(draft);

if (draft.mediaLocalPath) {
    try {
        await fs.access(draft.mediaLocalPath);
    } catch {
        fail(`Pin image file missing on disk: ${draft.mediaLocalPath}\nRe-run: npm run pinterest:draft`);
    }
}

let boardId = process.env.PINTEREST_BOARD_ID?.trim();
let boardKey = draft.boardKey || undefined;
if (draft.boardKey) {
    try {
        const boards = JSON.parse(await fs.readFile('data/pinterest/boards.json', 'utf8'));
        const fromKey = boards?.boards?.[draft.boardKey]?.id;
        if (fromKey) {
            boardId = fromKey;
            boardKey = draft.boardKey;
        } else {
            console.warn(
                `Warning: board key "${draft.boardKey}" is not in data/pinterest/boards.json. Using PINTEREST_BOARD_ID instead.`,
            );
        }
    } catch {
        /* fall through to env board */
    }
}
if (!boardId) boardId = requireEnv('PINTEREST_BOARD_ID');
const viaZernio = shouldPublishViaZernio();

console.log('\n— Pin draft (confirm before API publish) —');
console.log(`File:        ${draftPath}`);
console.log(`Provider:    ${viaZernio ? 'Zernio (zernio.com) — Trial bypass' : 'Pinterest API v5'}`);
console.log(`Hook:        ${draft.hook}`);
console.log(`Title:       ${draft.title}`);
console.log(`Description:\n${draft.description}\n`);
console.log(`Image:       ${draft.mediaUrl}`);
console.log(`Pin spec:    ${PIN_WIDTH}×${PIN_HEIGHT} (${PIN_ASPECT}), file ${PIN_FILENAME}`);
console.log(`Hook on img: ${draft.hookOnImage ? 'yes' : 'no'}`);
console.log(`Link:        ${draft.link}`);
console.log(`Board id:    ${boardId}${boardKey ? ` (${boardKey})` : ''}`);
if (viaZernio) {
    console.log(`Zernio acct: ${process.env.ZERNIO_PINTEREST_ACCOUNT_ID || '(set ZERNIO_PINTEREST_ACCOUNT_ID)'}`);
}
console.log(`Draft hash:  ${draft.draftHash || '(none)'}`);
console.log('\nCompliance: one pin per confirmation. Type exactly: publish\n');

const rl = readline.createInterface({ input, output });
const answer = (await rl.question('Confirm> ')).trim();
rl.close();

if (answer !== 'publish') {
    console.log('Aborted — nothing was sent.');
    process.exit(0);
}

let pin;
let provider = 'pinterest';

if (viaZernio) {
    console.log('\nCreating pin via Zernio…');
    pin = await createPinViaZernio({ boardId, draft });
    provider = 'zernio';
} else {
    const token = await refreshAccessTokenIfNeeded();
    console.log('\nCreating pin via Pinterest API…');
    try {
        pin = await createPin({ token, boardId, draft });
    } catch (e) {
        const msg = String(e?.message || e);
        if (/403|Trial access|api-sandbox/i.test(msg) && process.env.ZERNIO_API_KEY?.trim()) {
            fail(
                `${msg}\n\nZERNIO_API_KEY is set but publish still used native Pinterest.\n` +
                    'Unset PINTEREST_PUBLISH_VIA=pinterest (or set PINTEREST_PUBLISH_VIA=zernio) and retry.',
            );
        }
        if (/403|Trial access|api-sandbox/i.test(msg)) {
            fail(
                `${msg}\n\nBypass while Standard is blocked: add ZERNIO_API_KEY + ZERNIO_PINTEREST_ACCOUNT_ID to .env\n` +
                    '(https://zernio.com), run npm run zernio:profiles, then publish again.',
            );
        }
        throw e;
    }
}

const { file, receipt } = await writePublishReceipt({ draft, pin, boardId, provider });

console.log('\nPublished.');
console.log(`Provider: ${provider}`);
console.log(`Pin id:   ${receipt.pinId || JSON.stringify(pin)}`);
console.log(`Receipt:  ${file}`);
if (receipt.pinUrl) console.log(`URL:      ${receipt.pinUrl}`);
else if (pin.id) console.log(`URL hint: https://www.pinterest.com/pin/${pin.id}/`);
console.log('');
