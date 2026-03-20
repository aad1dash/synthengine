/**
 * Deterministic PRNG seeded by a 32-bit integer (xoshiro128**).
 */
export function createRNG(seed) {
  let s0 = seed >>> 0 || 1;
  let s1 = (seed * 1664525 + 1013904223) >>> 0 || 1;
  let s2 = (s1 * 1664525 + 1013904223) >>> 0 || 1;
  let s3 = (s2 * 1664525 + 1013904223) >>> 0 || 1;

  function rotl(x, k) {
    return (x << k) | (x >>> (32 - k));
  }

  function next() {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);

    return result;
  }

  /** Returns float in [0, 1) */
  function random() {
    return next() / 4294967296;
  }

  /** Returns float in [min, max) */
  function range(min, max) {
    return min + random() * (max - min);
  }

  /** Returns integer in [min, max] inclusive */
  function intRange(min, max) {
    return min + (next() % (max - min + 1));
  }

  /** Pick random element from array */
  function pick(arr) {
    return arr[next() % arr.length];
  }

  return { random, range, intRange, pick, next };
}
