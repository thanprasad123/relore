import 'dotenv/config';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { getAddress, verifyMessage } from 'ethers';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, process.env.DATA_DIR || '.data');
const evidenceDir = resolve(dataDir, 'evidence');
mkdirSync(evidenceDir, { recursive: true });

const db = new DatabaseSync(resolve(dataDir, 'marketplace.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'CONSUMER',
    seller_status TEXT NOT NULL DEFAULT 'NOT_APPLIED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS challenges (
    wallet_address TEXT PRIMARY KEY COLLATE NOCASE,
    nonce TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS passports (
    passport_id TEXT PRIMARY KEY,
    owner_wallet TEXT NOT NULL,
    identifier_hash TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS listings (
    listing_id TEXT PRIMARY KEY,
    passport_id TEXT NOT NULL REFERENCES passports(passport_id),
    seller_wallet TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS listings_status_created ON listings(status, created_at DESC);
  CREATE TABLE IF NOT EXISTS seller_applications (
    wallet_address TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    status TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS evidence (
    evidence_id TEXT PRIMARY KEY,
    owner_wallet TEXT NOT NULL,
    passport_id TEXT,
    content_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(listing_id),
    buyer_wallet TEXT NOT NULL,
    seller_wallet TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_reference TEXT,
    seller_transfer_tx TEXT,
    buyer_confirmation_tx TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_wallet TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();
const sha256 = value => createHash('sha256').update(value).digest('hex');
const admins = new Set((process.env.ADMIN_WALLETS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
const allowedOrigins = new Set((process.env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(v => v.trim()).filter(Boolean));
const sessionHours = Number(process.env.SESSION_HOURS || 24);
const cookieName = 'passport_session';
const rateBuckets = new Map();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim().split(/=(.*)/s)).filter(([k, v]) => k && v !== undefined).map(([k, v]) => [k, decodeURIComponent(v)]));
}

function rateLimit(req, res, limit = 60, windowMs = 60_000) {
  const key = `${req.socket.remoteAddress || 'unknown'}:${req.url?.split('?')[0]}`;
  const time = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || time >= bucket.resetAt) rateBuckets.set(key, { count: 1, resetAt: time + windowMs });
  else bucket.count++;
  const current = rateBuckets.get(key);
  if (current.count > limit) {
    send(res, 429, { error: 'rate_limited', message: 'Too many requests. Try again shortly.' }, { 'retry-after': String(Math.ceil((current.resetAt - time) / 1000)) });
    return false;
  }
  return true;
}

async function readJson(req, maxBytes = 256 * 1024) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    send(res, 403, { error: 'origin_not_allowed' });
    return false;
  }
  return true;
}

function publicUser(row) {
  return { id: row.id, walletAddress: row.wallet_address, name: row.display_name, role: row.role, sellerStatus: row.seller_status, createdAt: row.created_at };
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(sha256(token), Date.now());
  return row || null;
}

function unauthorized(res) { send(res, 401, { error: 'authentication_required', message: 'Connect your wallet and sign in to continue.' }); }
function forbidden(res) { send(res, 403, { error: 'forbidden', message: 'Your account is not allowed to perform this action.' }); }

function requireUser(req, res, roles) {
  const user = getSession(req);
  if (!user) { unauthorized(res); return null; }
  if (roles && !roles.includes(user.role)) { forbidden(res); return null; }
  return user;
}

function audit(user, action, targetId) {
  db.prepare('INSERT INTO audit_log(actor_wallet,action,target_id,created_at) VALUES(?,?,?,?)').run(user.wallet_address, action, targetId, now());
}

function validateText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) throw Object.assign(new Error(`${label} is required and must be at most ${maxLength} characters.`), { status: 400 });
  return value.trim();
}

const routes = async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method || 'GET';
  if (!rateLimit(req, res, path.includes('/auth/') ? 20 : 90)) return;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !requireSameOrigin(req, res)) return;
  if (method === 'OPTIONS') { res.writeHead(204, { allow: 'GET,POST,PATCH,DELETE,OPTIONS' }); res.end(); return; }

  if (method === 'GET' && path === '/api/health') return send(res, 200, { status: 'ok', database: 'sqlite', chainId: 91562037, payments: process.env.PAYMENT_PROVIDER ? 'configured' : 'not_configured', contracts: Boolean(process.env.MST_PRODUCT_PASSPORT_REGISTRY && process.env.MST_OWNERSHIP_REGISTRY) });

  if (method === 'POST' && path === '/api/auth/nonce') {
    const body = await readJson(req);
    let wallet;
    try { wallet = getAddress(body.walletAddress); } catch { return send(res, 400, { error: 'invalid_wallet_address' }); }
    const nonce = randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 5 * 60_000;
    db.prepare('INSERT INTO challenges(wallet_address,nonce,expires_at) VALUES(?,?,?) ON CONFLICT(wallet_address) DO UPDATE SET nonce=excluded.nonce,expires_at=excluded.expires_at').run(wallet, nonce, expiresAt);
    const domain = req.headers.host || 'localhost';
    const message = `Product Passport Marketplace login\nDomain: ${domain}\nWallet: ${wallet}\nNonce: ${nonce}\nIssued At: ${now()}\nThis signature will not send a blockchain transaction.`;
    db.prepare('UPDATE challenges SET nonce=? WHERE wallet_address=?').run(JSON.stringify({ nonce, message, expiresAt }), wallet);
    return send(res, 200, { message, expiresAt: new Date(expiresAt).toISOString() });
  }

  if (method === 'POST' && path === '/api/auth/verify') {
    const body = await readJson(req);
    let wallet;
    try { wallet = getAddress(body.walletAddress); } catch { return send(res, 400, { error: 'invalid_wallet_address' }); }
    const challenge = db.prepare('SELECT nonce,expires_at FROM challenges WHERE wallet_address=?').get(wallet);
    if (!challenge || challenge.expires_at <= Date.now()) return send(res, 401, { error: 'challenge_expired', message: 'Request a fresh sign-in challenge.' });
    let parsed;
    try { parsed = JSON.parse(challenge.nonce); } catch { return send(res, 401, { error: 'invalid_challenge' }); }
    if (body.message !== parsed.message) return send(res, 401, { error: 'challenge_mismatch' });
    let signer;
    try { signer = getAddress(verifyMessage(body.message, body.signature)); } catch { return send(res, 401, { error: 'invalid_signature' }); }
    if (signer !== wallet) return send(res, 401, { error: 'wallet_signature_mismatch' });
    db.prepare('DELETE FROM challenges WHERE wallet_address=?').run(wallet);
    const timestamp = now();
    const id = `wallet:${wallet.toLowerCase()}`;
    const initialRole = admins.has(wallet.toLowerCase()) ? 'ADMIN' : 'CONSUMER';
    db.prepare("INSERT INTO users(id,wallet_address,role,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(wallet_address) DO UPDATE SET role=CASE WHEN excluded.role='ADMIN' THEN 'ADMIN' ELSE users.role END,updated_at=excluded.updated_at").run(id, wallet, initialRole, timestamp, timestamp);
    const user = db.prepare('SELECT * FROM users WHERE wallet_address=?').get(wallet);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + sessionHours * 60 * 60_000;
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(sha256(token), user.id, expiresAt, timestamp);
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return send(res, 200, { user: publicUser(user) }, { 'set-cookie': `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionHours * 3600}${secure}` });
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token));
    return send(res, 200, { ok: true }, { 'set-cookie': `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  }

  if (method === 'GET' && path === '/api/me') {
    const user = getSession(req);
    return user ? send(res, 200, { user: publicUser(user) }) : unauthorized(res);
  }

  if (method === 'PATCH' && path === '/api/me') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readJson(req);
    const name = validateText(body.name, 'Name', 80);
    db.prepare('UPDATE users SET display_name=?,updated_at=? WHERE id=?').run(name, now(), user.id);
    return send(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
  }

  if (method === 'POST' && path === '/api/seller-applications') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readJson(req);
    const business = validateText(body.businessName, 'Business name', 120);
    db.prepare(`INSERT INTO seller_applications(wallet_address,business_name,status,submitted_at) VALUES(?,?,?,?) ON CONFLICT(wallet_address) DO UPDATE SET business_name=excluded.business_name,status='PENDING',submitted_at=excluded.submitted_at,reviewed_at=NULL`).run(user.wallet_address, business, 'PENDING', now());
    db.prepare('UPDATE users SET seller_status=?,updated_at=? WHERE id=?').run('PENDING', now(), user.id);
    audit(user, 'SELLER_APPLICATION_SUBMITTED', user.wallet_address);
    return send(res, 201, { status: 'PENDING' });
  }

  if (method === 'GET' && path === '/api/listings') {
    const rows = db.prepare(`SELECT payload_json FROM listings WHERE status='ACTIVE' ORDER BY created_at DESC LIMIT 200`).all();
    return send(res, 200, { listings: rows.map(row => JSON.parse(row.payload_json)) });
  }

  if (method === 'GET' && path === '/api/my/marketplace') {
    const user = requireUser(req, res); if (!user) return;
    const passports = db.prepare('SELECT payload_json FROM passports WHERE owner_wallet=? ORDER BY created_at DESC').all(user.wallet_address).map(row => JSON.parse(row.payload_json));
    const listings = db.prepare('SELECT payload_json FROM listings WHERE seller_wallet=? ORDER BY created_at DESC').all(user.wallet_address).map(row => JSON.parse(row.payload_json));
    return send(res, 200, { passports, listings });
  }

  if (method === 'POST' && path === '/api/passports') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readJson(req);
    const identifierHash = String(body.identifierHash || '').toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(identifierHash)) return send(res, 400, { error: 'invalid_identifier_hash', message: 'Send only a 32-byte hash, never a serial number or IMEI.' });
    const category = body.category;
    if (!['SMARTPHONE', 'LAPTOP'].includes(category)) return send(res, 400, { error: 'invalid_category' });
    const brand = validateText(body.brand, 'Brand', 80);
    const model = validateText(body.model, 'Model', 140);
    const releaseYear = Number(body.releaseYear);
    if (!Number.isInteger(releaseYear) || releaseYear < 1970 || releaseYear > new Date().getFullYear() + 1) return send(res, 400, { error: 'invalid_release_year' });
    let imageUrl = '';
    if (typeof body.imageUrl === 'string' && body.imageUrl.startsWith('https://')) {
      imageUrl = body.imageUrl.slice(0, 800);
    } else if (typeof body.imageUrl === 'string' && body.imageUrl.startsWith('data:')) {
      const uploadedImage = body.imageUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!uploadedImage || uploadedImage[2].length > 220_000) return send(res, 400, { error: 'invalid_product_image', message: 'Choose a JPG, PNG, or WebP photo smaller than 160 KB after processing.' });
      const bytes = Buffer.from(uploadedImage[2], 'base64');
      if (bytes.length > 160 * 1024) return send(res, 413, { error: 'product_image_size_limit' });
      const validImage = uploadedImage[1] === 'jpeg'
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : uploadedImage[1] === 'png'
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!validImage) return send(res, 415, { error: 'invalid_product_image_type' });
      imageUrl = body.imageUrl;
    }
    const existing = db.prepare('SELECT passport_id FROM passports WHERE identifier_hash=?').get(identifierHash);
    if (existing) return send(res, 409, { error: 'product_already_registered', passportId: existing.passport_id });
    const passportId = body.passportId ? String(body.passportId).trim().toUpperCase() : `PP-${randomBytes(4).readUInt32BE() % 900000 + 100000}`;
    if (!/^PP-[A-Z0-9-]{3,32}$/.test(passportId)) return send(res, 400, { error: 'invalid_passport_id' });
    const createdAt = now();
    const payload = {
      passportId, category, brand, model, releaseYear,
      imageUrl,
      additionalImages: [],
      identifier: { category, model, brand, hashedIdentifier: identifierHash },
      verificationLevel: 'SELLER_REPORTED', currentStatus: 'ACTIVE',
      currentOwnerId: user.id, currentOwnerName: user.display_name || `MST user ${user.wallet_address.slice(-4)}`,
      currentOwnerDid: `did:mst:wallet:${user.wallet_address.toLowerCase()}`,
      riskLevel: 'REVIEW_REQUIRED', riskScore: 50, riskSignals: ['Backend record created; identity anchor not independently confirmed.'],
      createdAt, updatedAt: createdAt, ownershipHistory: [], attestations: [], serviceRecords: [],
      inspectionRecords: [], lifecycleHistory: [], disputes: [],
      conditionReport: { display: 'GOOD', body: 'GOOD', batteryHealthPct: 0, keyboardPorts: 'GOOD', aiObservationNotes: [] },
      chainStatus: 'UNANCHORED',
    };
    db.prepare('INSERT INTO passports(passport_id,owner_wallet,identifier_hash,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(passportId, user.wallet_address, identifierHash, JSON.stringify(payload), createdAt, createdAt);
    audit(user, 'PASSPORT_CREATED', passportId);
    return send(res, 201, { passport: payload });
  }

  if (method === 'GET' && path === '/api/passports') {
    const rows = db.prepare('SELECT payload_json FROM passports ORDER BY created_at DESC LIMIT 200').all();
    return send(res, 200, { passports: rows.map(row => JSON.parse(row.payload_json)) });
  }

  const passportMatch = path.match(/^\/api\/passports\/([A-Za-z0-9_-]+)$/);
  if (method === 'GET' && passportMatch) {
    const row = db.prepare('SELECT payload_json FROM passports WHERE passport_id=?').get(passportMatch[1]);
    return row ? send(res, 200, { passport: JSON.parse(row.payload_json) }) : send(res, 404, { error: 'passport_not_found' });
  }

  if (method === 'POST' && path === '/api/listings') {
    const user = requireUser(req, res); if (!user) return;
    if (user.role !== 'SELLER' && user.role !== 'ADMIN') return forbidden(res);
    const body = await readJson(req);
    const passportId = validateText(body.passportId, 'Passport ID', 40);
    const product = db.prepare('SELECT * FROM passports WHERE passport_id=?').get(passportId);
    if (!product) return send(res, 404, { error: 'passport_not_found' });
    if (product.owner_wallet.toLowerCase() !== user.wallet_address.toLowerCase()) return forbidden(res);
    const active = db.prepare(`SELECT 1 FROM listings WHERE passport_id=? AND status IN ('ACTIVE','PENDING_REVIEW','RESERVED')`).get(passportId);
    if (active) return send(res, 409, { error: 'active_listing_exists' });
    const price = Number(body.price);
    if (!Number.isSafeInteger(price) || price < 1 || price > 10_000_000_000) return send(res, 400, { error: 'invalid_price', message: 'Price must be an integer number of rupees.' });
    const listingId = `LST-${randomBytes(5).toString('hex').toUpperCase()}`;
    const createdAt = now();
    const listing = {
      id: listingId, passportId, sellerId: user.id, sellerWallet: user.wallet_address,
      sellerName: user.display_name || `MST user ${user.wallet_address.slice(-4)}`,
      sellerReputation: 0, sellerDid: `did:mst:wallet:${user.wallet_address.toLowerCase()}`,
      title: validateText(body.title, 'Title', 160), description: String(body.description || '').trim().slice(0, 4000),
      price, currency: 'INR', location: validateText(body.location, 'Location', 120),
      status: 'PENDING_REVIEW', listedAt: createdAt, createdAt,
    };
    db.prepare('INSERT INTO listings(listing_id,passport_id,seller_wallet,status,payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(listingId, passportId, user.wallet_address, listing.status, JSON.stringify(listing), createdAt, createdAt);
    audit(user, 'LISTING_SUBMITTED', listingId);
    return send(res, 201, { listing });
  }

  if (method === 'GET' && path === '/api/admin/review-queue') {
    const user = requireUser(req, res, ['ADMIN']); if (!user) return;
    const listings = db.prepare(`SELECT payload_json FROM listings WHERE status='PENDING_REVIEW' ORDER BY created_at ASC LIMIT 100`).all().map(row => JSON.parse(row.payload_json));
    const sellers = db.prepare(`SELECT * FROM seller_applications WHERE status='PENDING' ORDER BY submitted_at ASC LIMIT 100`).all();
    return send(res, 200, { listings, sellerApplications: sellers });
  }

  const reviewSeller = path.match(/^\/api\/admin\/sellers\/0x[0-9a-fA-F]{40}$/);
  if (method === 'PATCH' && reviewSeller) {
    const user = requireUser(req, res, ['ADMIN']); if (!user) return;
    const body = await readJson(req);
    if (!['APPROVE', 'REJECT'].includes(body.decision)) return send(res, 400, { error: 'invalid_decision' });
    const wallet = getAddress(path.split('/').at(-1));
    const application = db.prepare('SELECT * FROM seller_applications WHERE wallet_address=?').get(wallet);
    if (!application) return send(res, 404, { error: 'seller_application_not_found' });
    const status = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const role = body.decision === 'APPROVE' ? 'SELLER' : 'CONSUMER';
    const reviewedAt = now();
    db.prepare('UPDATE seller_applications SET status=?,reviewed_at=? WHERE wallet_address=?').run(status, reviewedAt, wallet);
    db.prepare('UPDATE users SET role=?,seller_status=?,updated_at=? WHERE wallet_address=?').run(role, status, reviewedAt, wallet);
    audit(user, `SELLER_${body.decision}`, wallet);
    return send(res, 200, { walletAddress: wallet, status, role });
  }

  const reviewListing = path.match(/^\/api\/admin\/listings\/([A-Za-z0-9_-]+)$/);
  if (method === 'PATCH' && reviewListing) {
    const user = requireUser(req, res, ['ADMIN']); if (!user) return;
    const body = await readJson(req);
    if (!['APPROVE', 'REJECT'].includes(body.decision)) return send(res, 400, { error: 'invalid_decision' });
    const row = db.prepare('SELECT payload_json,status FROM listings WHERE listing_id=?').get(reviewListing[1]);
    if (!row) return send(res, 404, { error: 'listing_not_found' });
    if (row.status !== 'PENDING_REVIEW') return send(res, 409, { error: 'listing_not_pending_review' });
    const listing = JSON.parse(row.payload_json);
    listing.status = body.decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
    listing.reviewedAt = now();
    listing.reviewNote = String(body.note || '').trim().slice(0, 500);
    db.prepare('UPDATE listings SET status=?,payload_json=?,updated_at=? WHERE listing_id=?').run(listing.status, JSON.stringify(listing), now(), reviewListing[1]);
    audit(user, `LISTING_${body.decision}`, reviewListing[1]);
    return send(res, 200, { listing });
  }

  if (method === 'POST' && path === '/api/orders') {
    const user = requireUser(req, res); if (!user) return;
    if (!process.env.PAYMENT_PROVIDER || !process.env.PAYMENT_API_KEY) return send(res, 503, { error: 'payments_not_configured', message: 'Checkout is unavailable until a payment provider is configured.' });
    return send(res, 501, { error: 'payment_adapter_not_implemented', message: 'Configure the provider-specific checkout adapter before accepting payment.' });
  }

  if (method === 'POST' && path === '/api/evidence') {
    const user = requireUser(req, res); if (!user) return;
    const body = await readJson(req, 12 * 1024 * 1024);
    const type = String(body.contentType || '');
    const extensions = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    if (!extensions[type]) return send(res, 415, { error: 'unsupported_evidence_type' });
    if (typeof body.base64 !== 'string') return send(res, 400, { error: 'missing_file_data' });
    const bytes = Buffer.from(body.base64, 'base64');
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return send(res, 413, { error: 'evidence_size_limit', message: 'Evidence files must be smaller than 8 MB.' });
    const signatures = {
      'application/pdf': bytes.subarray(0, 5).toString('ascii') === '%PDF-',
      'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/webp': bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
    };
    if (!signatures[type]) return send(res, 415, { error: 'file_content_type_mismatch' });
    const evidenceId = randomBytes(16).toString('hex');
    const filePath = resolve(evidenceDir, `${evidenceId}${extensions[type]}`);
    if (!filePath.startsWith(`${evidenceDir}${sep}`)) return send(res, 400, { error: 'invalid_file_path' });
    const digest = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(filePath, bytes, { flag: 'wx', mode: 0o600 });
    const fileName = String(body.fileName || 'evidence').replace(/[\r\n"/\\]/g, '_').slice(0, 120);
    db.prepare('INSERT INTO evidence(evidence_id,owner_wallet,passport_id,content_type,file_name,file_path,sha256,byte_size,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(evidenceId, user.wallet_address, body.passportId || null, type, fileName, filePath, digest, bytes.length, now());
    return send(res, 201, { evidenceId, sha256: `0x${digest}`, byteSize: bytes.length });
  }

  const evidenceMatch = path.match(/^\/api\/evidence\/([a-f0-9]{32})$/);
  if (method === 'GET' && evidenceMatch) {
    const user = requireUser(req, res); if (!user) return;
    const evidence = db.prepare('SELECT * FROM evidence WHERE evidence_id=?').get(evidenceMatch[1]);
    if (!evidence) return send(res, 404, { error: 'evidence_not_found' });
    if (user.role !== 'ADMIN' && evidence.owner_wallet.toLowerCase() !== user.wallet_address.toLowerCase()) return forbidden(res);
    const bytes = readFileSync(evidence.file_path);
    res.writeHead(200, { 'content-type': evidence.content_type, 'content-length': bytes.length, 'content-disposition': `attachment; filename="${evidence.file_name}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
    return res.end(bytes);
  }

  if (method === 'GET' && path === '/api/admin/audit-log') {
    const user = requireUser(req, res, ['ADMIN']); if (!user) return;
    const rows = db.prepare('SELECT actor_wallet,action,target_id,created_at FROM audit_log ORDER BY id DESC LIMIT 200').all();
    return send(res, 200, { events: rows });
  }

  return send(res, 404, { error: 'not_found' });
};

const server = createServer((req, res) => {
  routes(req, res).catch(error => {
    console.error('API request failed:', error?.message || error);
    if (!res.headersSent) send(res, error.status || 500, { error: error.status ? 'invalid_request' : 'internal_error', message: error.status ? error.message : 'The server could not complete the request.' });
    else res.destroy();
  });
});

const port = Number(process.env.API_PORT || 8787);
server.listen(port, process.env.API_HOST || '127.0.0.1', () => console.log(`Marketplace API listening on http://${process.env.API_HOST || '127.0.0.1'}:${port}`));

function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
