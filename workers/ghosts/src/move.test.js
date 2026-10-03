import { describe, expect, test } from "bun:test";
import { allowedOrigin, parseMove, roomName } from "./move.js";

describe("parseMove", () => {
  test("keeps a normal position", () => {
    expect(parseMove('{"x":0.5,"y":1200}')).toEqual({ x: 0.5, y: 1200 });
  });

  test("clamps positions to the page", () => {
    expect(parseMove('{"x":-3,"y":-10}')).toEqual({ x: 0, y: 0 });
    expect(parseMove('{"x":7,"y":9999999}')).toEqual({ x: 1, y: 100000 });
  });

  test("rounds so nobody can send huge numbers of digits", () => {
    expect(parseMove('{"x":0.123456789,"y":10.6}')).toEqual({ x: 0.1235, y: 11 });
  });

  test("drops junk", () => {
    expect(parseMove(42)).toBeNull();
    expect(parseMove("x".repeat(101))).toBeNull();
    expect(parseMove("not json")).toBeNull();
    expect(parseMove("null")).toBeNull();
    expect(parseMove('{"x":"a","y":1}')).toBeNull();
    expect(parseMove('{"x":1,"y":"Infinity"}')).toBeNull();
  });
});

describe("roomName", () => {
  test("uses the page path", () => {
    expect(roomName("/en/blog/half-life/")).toBe("/en/blog/half-life/");
  });

  test("falls back to the home page for anything else", () => {
    expect(roomName(null)).toBe("/");
    expect(roomName("https://evil.example/")).toBe("/");
  });

  test("keeps room names short", () => {
    expect(roomName(`/${"a".repeat(500)}`)).toHaveLength(200);
  });
});

describe("allowedOrigin", () => {
  test("lets the site and local preview in", () => {
    expect(allowedOrigin("https://4st.li")).toBe(true);
    expect(allowedOrigin("http://localhost:1313")).toBe(true);
  });

  test("keeps other sites out", () => {
    expect(allowedOrigin("https://evil.example")).toBe(false);
    expect(allowedOrigin(null)).toBe(false);
  });
});
