// Usage:
//   npm run pinterest:oauth
//   npm run pinterest:oauth -- --code <authorization_code>
//
// Public redirect (register in Pinterest app):
//   https://mybusinesswork.com/oauth/pinterest/
// That page forwards ?code= to http://127.0.0.1:8787/callback while this CLI listens,
// or you can paste the code with --code if the forward fails.
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import {
    buildAuthorizeUrl,
    exchangeAuthorizationCode,
    fail,
    requireEnv,
    DEFAULT_SCOPES,
    SITE_URL,
} from './lib/pinterest.mjs';

const appId = requireEnv('PINTEREST_APP_ID');
const appSecret = requireEnv('PINTEREST_APP_SECRET');
const redirectUri =
    process.env.PINTEREST_REDIRECT_URI?.trim() || `${SITE_URL}/oauth/pinterest/`;
const localPort = Number(process.env.PINTEREST_LOCAL_PORT || 8787);
const localCallbackPath = '/callback';

let redirect;
try {
    redirect = new URL(redirectUri);
} catch {
    fail('PINTEREST_REDIRECT_URI must be a valid URL.');
}

const codeFlagIdx = process.argv.indexOf('--code');
const codeFromCli =
    codeFlagIdx >= 0 ? process.argv[codeFlagIdx + 1]?.trim() : undefined;

async function finishWithCode(code, expectedState) {
    if (expectedState) {
        // State is validated only for browser callback path.
    }
    const tokens = await exchangeAuthorizationCode({
        appId,
        appSecret,
        redirectUri,
        code,
    });

    console.log('\nSuccess. Add these to your .env (do not commit .env):\n');
    console.log(`PINTEREST_ACCESS_TOKEN=${tokens.access_token || ''}`);
    if (tokens.refresh_token) console.log(`PINTEREST_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (tokens.expires_in) console.log(`# expires_in=${tokens.expires_in}s`);
    console.log(`PINTEREST_REDIRECT_URI=${redirectUri}`);
    console.log('\nThen set PINTEREST_BOARD_ID and run: npm run pinterest:draft\n');
}

function openBrowser(url) {
    const platform = process.platform;
    if (platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else if (platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

if (codeFromCli) {
    console.log('\nExchanging authorization code…');
    await finishWithCode(codeFromCli);
    process.exit(0);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = buildAuthorizeUrl({
    appId,
    redirectUri,
    state,
    scopes: DEFAULT_SCOPES,
});

console.log('\nPinterest OAuth (internal Daily Viral Deals publisher)');
console.log(`Scopes:   ${DEFAULT_SCOPES.join(', ')}`);
console.log(`Redirect: ${redirectUri}`);
console.log(`Local:    http://127.0.0.1:${localPort}${localCallbackPath}`);
console.log('\nRegister this exact Redirect URI in your Pinterest app settings:');
console.log(`  ${redirectUri}`);
console.log('\nIf the browser does not open, visit:\n');
console.log(authUrl);
console.log('\nWaiting for callback (via site → localhost handoff)…\n');

const server = http.createServer(async (req, res) => {
    try {
        const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${localPort}`);
        if (reqUrl.pathname !== localCallbackPath) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }

        const err = reqUrl.searchParams.get('error');
        if (err) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>Authorization failed</h1><p>${err}</p>`);
            console.error('Authorization error:', err, reqUrl.searchParams.get('error_description') || '');
            server.close();
            process.exit(1);
        }

        const code = reqUrl.searchParams.get('code');
        const returnedState = reqUrl.searchParams.get('state');
        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing code');
            return;
        }
        if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid state');
            fail('OAuth state mismatch — try again.');
        }

        await finishWithCode(code, state);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
            '<h1>Connected</h1><p>You can close this tab and return to the terminal. Paste the tokens into <code>.env</code>.</p>',
        );

        server.close();
        process.exit(0);
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
        console.error(e);
        server.close();
        process.exit(1);
    }
});

server.listen(localPort, '127.0.0.1', () => {
    openBrowser(authUrl);
});
