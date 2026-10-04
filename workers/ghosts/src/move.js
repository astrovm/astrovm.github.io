// Turn a message from a visitor into something safe to pass on, or null if it is junk.
//
// Where their cat is: x and y are fractions of their window (0 to 1), s is the
// sprite it shows, r means it sits on the reading bar and h means it is hidden.
// A nudge to another cat: to is that cat's id and a is what happened.
export const NUDGES = ["boop", "tag"];

export function parseMessage(message) {
  if (typeof message !== "string" || message.length > 100) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(message);
  } catch {
    return null;
  }
  if (typeof data?.to === "string") {
    return /^[0-9a-f]{8}$/.test(data.to) && NUDGES.includes(data.a) ? { to: data.to, a: data.a } : null;
  }
  const x = Number(data?.x);
  const y = Number(data?.y);
  const s = data?.s;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !isSprite(s)) {
    return null;
  }
  return { x: fraction(x), y: fraction(y), s: [s[0], s[1]], r: data.r ? 1 : 0, h: data.h ? 1 : 0 };
}

// The sprite sheet is 8 by 4 cells, counted from 0 down to -7.
function isSprite(s) {
  return Array.isArray(s) && s.length === 2 && s.every((n) => Number.isInteger(n) && n <= 0 && n >= -7);
}

function fraction(n) {
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
}

// Rooms are page paths without the language, so readers of every translation meet.
// Kept short so nobody can make endless rooms out of junk.
export function roomName(value) {
  const path = typeof value === "string" && value.startsWith("/") ? value : "/";
  return path.replace(/^\/(en|es|ja|zh)(?=\/|$)/, "").slice(0, 200) || "/";
}

export const ALLOWED_ORIGINS = ["https://4st.li", "http://localhost:1313"];

export function allowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
