// Usage: npm run zernio:profiles
// Lists Zernio-connected social accounts (use the Pinterest _id as ZERNIO_PINTEREST_ACCOUNT_ID).
import { fail, requireEnv } from './lib/pinterest.mjs';

if (!process.env.ZERNIO_API_KEY?.trim()) {
    fail('ZERNIO_API_KEY is missing in .env — create a key at https://zernio.com/dashboard/api-keys');
}

const base = process.env.ZERNIO_API_BASE?.trim() || 'https://zernio.com/api/v1';
const key = requireEnv('ZERNIO_API_KEY');
const res = await fetch(`${base}/accounts`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
    fail(`Zernio accounts failed (${res.status}): ${json.message || JSON.stringify(json)}`);
}

const accounts = Array.isArray(json) ? json : json.accounts || json.data || [];
const pins = accounts.filter((a) => a.platform === 'pinterest');

console.log('\nZernio connected accounts:\n');
for (const a of accounts) {
    console.log(
        `- ${a.platform}: @${a.username || a.displayName || '?'}  accountId=${a._id || a.id}` +
            (a.metadata?.defaultBoardId ? `  defaultBoard=${a.metadata.defaultBoardId}` : ''),
    );
}

if (pins.length) {
    console.log(`\nFor .env:\nZERNIO_PINTEREST_ACCOUNT_ID=${pins[0]._id || pins[0].id}\n`);
} else {
    console.log('\nNo Pinterest account connected yet. Connect one in the Zernio dashboard first.\n');
}
