import argon2 from 'argon2';

const PASSWORD_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
});

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg$6yAc1DZVXk2NTNmJGP3E5jVDFyvmEsrdbgrQPrNDvFg';

export function hashPassword(password) {
  return argon2.hash(password, PASSWORD_OPTIONS);
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function consumePasswordVerificationTime(password) {
  return verifyPassword(DUMMY_PASSWORD_HASH, password);
}
