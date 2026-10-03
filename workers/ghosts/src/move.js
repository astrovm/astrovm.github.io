// Turn a message from a visitor into a safe position, or null if it is junk.
// x is a fraction of the page width (0 to 1), y is pixels from the top of the page.
export function parseMove(message) {
  if (typeof message !== "string" || message.length > 100) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(message);
  } catch {
    return null;
  }
  const x = Number(data?.x);
  const y = Number(data?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return {
    x: Math.min(1, Math.max(0, Math.round(x * 10000) / 10000)),
    y: Math.min(100000, Math.max(0, Math.round(y))),
  };
}

// Rooms are page paths, kept short so nobody can make endless rooms out of junk.
export function roomName(value) {
  const path = typeof value === "string" && value.startsWith("/") ? value : "/";
  return path.slice(0, 200);
}

export const ALLOWED_ORIGINS = ["https://4st.li", "http://localhost:1313"];

export function allowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
