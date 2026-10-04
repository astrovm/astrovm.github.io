import { describe, expect, test } from "bun:test";
import { allowedOrigin, parseMessage, roomName } from "./move.js";

const cat = (extra = {}) => JSON.stringify({ x: 0.5, y: 0.25, s: [-3, -3], ...extra });

describe("parseMessage", () => {
  test("keeps a cat's spot and sprite", () => {
    expect(parseMessage(cat())).toEqual({ x: 0.5, y: 0.25, s: [-3, -3], r: 0, h: 0 });
    expect(parseMessage(cat({ r: 1, h: true }))).toEqual({ x: 0.5, y: 0.25, s: [-3, -3], r: 1, h: 1 });
  });

  test("clamps spots to the window", () => {
    expect(parseMessage(cat({ x: -3, y: 9 }))).toMatchObject({ x: 0, y: 1 });
  });

  test("rounds so nobody can send huge numbers of digits", () => {
    expect(parseMessage(cat({ x: 0.123456789 }))).toMatchObject({ x: 0.123 });
  });

  test("drops anything extra", () => {
    expect(parseMessage(cat({ name: "hi" }))).not.toHaveProperty("name");
  });

  test("drops cats that make no sense", () => {
    expect(parseMessage(cat({ x: "a" }))).toBeNull();
    expect(parseMessage(cat({ y: "Infinity" }))).toBeNull();
    expect(parseMessage(cat({ s: undefined }))).toBeNull();
    expect(parseMessage(cat({ s: [-3] }))).toBeNull();
    expect(parseMessage(cat({ s: [1, 0] }))).toBeNull();
    expect(parseMessage(cat({ s: [-8, 0] }))).toBeNull();
    expect(parseMessage(cat({ s: [-1.5, 0] }))).toBeNull();
  });

  test("passes nudges to another cat", () => {
    expect(parseMessage('{"to":"0a1b2c3d","a":"boop"}')).toEqual({ to: "0a1b2c3d", a: "boop" });
    expect(parseMessage('{"to":"0a1b2c3d","a":"tag","x":1}')).toEqual({ to: "0a1b2c3d", a: "tag" });
  });

  test("drops odd nudges", () => {
    expect(parseMessage('{"to":"someone","a":"boop"}')).toBeNull();
    expect(parseMessage('{"to":"0a1b2c3d","a":"bite"}')).toBeNull();
  });

  test("drops junk", () => {
    expect(parseMessage(42)).toBeNull();
    expect(parseMessage("x".repeat(101))).toBeNull();
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage("null")).toBeNull();
  });
});

describe("roomName", () => {
  test("uses the page path without the language", () => {
    expect(roomName("/en/blog/half-life/")).toBe("/blog/half-life/");
    expect(roomName("/ja/blog/half-life/")).toBe("/blog/half-life/");
    expect(roomName("/es/")).toBe("/");
    expect(roomName("/zh")).toBe("/");
  });

  test("leaves other paths alone", () => {
    expect(roomName("/english/")).toBe("/english/");
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
