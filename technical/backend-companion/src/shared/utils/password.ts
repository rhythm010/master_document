import bcrypt from "bcrypt";

// Hash a plaintext password using bcrypt.
export async function hashPassword(password: string, rounds: number) {
  return bcrypt.hash(password, rounds);
}

// Compare a plaintext password to a bcrypt hash.
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
