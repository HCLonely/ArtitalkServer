const crypto = require('node:crypto');
const { promisify } = require('node:util');

const pbkdf2 = promisify(crypto.pbkdf2);
const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return {
    password_hash: key.toString('base64url'),
    password_salt: salt,
    password_algorithm: `pbkdf2-${DIGEST}`,
    password_iterations: ITERATIONS
  };
}

async function verifyPassword(password, stored) {
  if (!stored || stored.password_algorithm !== `pbkdf2-${DIGEST}`) return false;
  if (!stored.password_hash || !stored.password_salt || !stored.password_iterations) return false;
  const key = await pbkdf2(password, stored.password_salt, Number(stored.password_iterations), KEY_LENGTH, DIGEST);
  const expected = Buffer.from(stored.password_hash, 'base64url');
  if (expected.length !== key.length) return false;
  return crypto.timingSafeEqual(expected, key);
}

function createSessionToken() {
  return crypto.randomBytes(24).toString('base64url');
}

module.exports = {
  createPasswordHash,
  verifyPassword,
  createSessionToken
};
