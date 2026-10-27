// Splits the local profile.json into a public part (public.js, plain) and the
// KVKK-sensitive fields listed in "private" (data.js, encrypted with the share key).
// Usage: node tools/build.mjs [--new-key]
// profile.json and profile.key stay local (.gitignore); only public.js and data.js are published.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = file => path.join(root, file);
const sha256 = value => crypto.createHash('sha256').update(value).digest();

const profilePath = at('profile.json');
if (!fs.existsSync(profilePath)) {
  console.error('profile.json bulunamadı. profile.example.json dosyasını profile.json olarak kopyalayıp doldurun.');
  process.exit(1);
}
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

// Reuse the existing key so previously shared links and QR codes keep working.
const keyPath = at('profile.key');
let key = fs.existsSync(keyPath) && !process.argv.includes('--new-key') ? fs.readFileSync(keyPath, 'utf8').trim() : '';
if (!key) {
  key = crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(keyPath, key + '\n');
  console.log('Yeni anahtar üretildi ve profile.key dosyasına yazıldı.');
}
if (!/^[A-Za-z0-9_-]{43}$/.test(key)) throw new Error('profile.key 43 karakterlik base64url anahtar olmalı.');

if (profile.photo && !profile.photo.startsWith('data:')) {
  const photoPath = path.resolve(root, profile.photo);
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(photoPath).toLowerCase()];
  if (!mime) throw new Error('Fotoğraf .png, .jpg veya .webp olmalı: ' + photoPath);
  profile.photo = `data:${mime};base64,${fs.readFileSync(photoPath).toString('base64')}`;
}

const privateFields = profile.private || ['photo', 'phone', 'email', 'birthDate', 'birthPlace', 'address'];
const secret = {};
const open = {};
for (const [field, value] of Object.entries(profile)) {
  if (field === 'private' || field === 'siteUrl') continue;
  if (privateFields.includes(field)) secret[field] = value;
  else open[field] = value;
}
for (const field of privateFields) {
  if (JSON.stringify(open.en || {}).includes(`"${field}"`)) throw new Error(`"en" içinde gizli alan olmamalı: ${field}`);
}

// Format v1, mirrored by decrypt() in app.js:
// [0x01][iv 16][hmac-sha256 32][aes-256-cbc ciphertext], keys derived from the share token.
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-cbc', sha256('enc-v1:' + key), iv);
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
const head = Buffer.concat([Buffer.from([1]), iv]);
const mac = crypto.createHmac('sha256', sha256('mac-v1:' + key)).update(Buffer.concat([head, ciphertext])).digest();
const blob = Buffer.concat([head, mac, ciphertext]);

// Self-check before writing anything public.
const check = crypto.createDecipheriv('aes-256-cbc', sha256('enc-v1:' + key), blob.subarray(1, 17));
const roundTrip = Buffer.concat([check.update(blob.subarray(49)), check.final()]).toString('utf8');
if (roundTrip !== JSON.stringify(secret)) throw new Error('Şifreleme doğrulaması başarısız.');

fs.writeFileSync(at('data.js'), `window.__PROFILE_CIPHER__ = "${blob.toString('base64')}";\n`);
fs.writeFileSync(at('public.js'), `window.__PROFILE_PUBLIC__ = ${JSON.stringify(open, null, 1)};\n`);

// Cache-bust each asset by its content so browsers never pair a new page with a stale payload.
const version = file => sha256(fs.readFileSync(at(file))).toString('hex').slice(0, 10);
const indexPath = at('index.html');
const html = fs.readFileSync(indexPath, 'utf8')
  .replace(/(href|src)="(styles\.css|public\.js|data\.js|app\.js)(\?v=[^"]*)?"/g, (_, attr, file) => `${attr}="${file}?v=${version(file)}"`);
fs.writeFileSync(indexPath, html);

const site = (profile.siteUrl || 'https://eafacan16.github.io/').replace(/\/?$/, '/');
console.log('public.js: ' + Object.keys(open).join(', '));
console.log('data.js (şifreli): ' + Object.keys(secret).join(', '));
console.log('\nTemel sürüm (herkese açık):  ' + site);
console.log('Tam sürüm (KVKK, şifreli):   ' + site + '#' + key);
console.log('Tam sürüm, İngilizce:        ' + site + '?lang=en#' + key + '\n');
