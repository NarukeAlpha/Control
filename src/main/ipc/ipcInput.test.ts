import { describe, expect, it } from "vitest";

import {
  isJsonObject,
  isJsonValue,
  isRecord,
  nullableTrimmedString,
  optionalBoolean,
  optionalJsonArray,
  optionalJsonObject,
  optionalJsonValue,
  optionalNullableBoolean,
  optionalNullableString,
  optionalPositiveInteger,
  optionalString,
  optionalTrimmedString,
  requirePositiveInteger,
  requireRecord,
  requireStringArray,
  requireTrimmedString
} from "./ipcInput";

describe("ipcInput", () => {
  it("validates record-shaped IPC payloads", () => {
    expect(isRecord({ ok: true })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(requireRecord<{ name: string }>({ name: "Control" }, "payload required")).toEqual({
      name: "Control"
    });
    expect(() => requireRecord([], "payload required")).toThrow("payload required");
  });

  it("normalizes string values consistently", () => {
    expect(requireTrimmedString(" value ", "value required")).toBe("value");
    expect(optionalTrimmedString(" value ")).toBe("value");
    expect(optionalTrimmedString("   ")).toBeUndefined();
    expect(nullableTrimmedString("   ")).toBeNull();
    expect(optionalString("", "string required")).toBe("");
    expect(optionalNullableString(null, "string required")).toBeNull();

    expect(() => requireTrimmedString(" ", "value required")).toThrow("value required");
    expect(() => optionalString(1, "string required")).toThrow("string required");
    expect(() => optionalNullableString(1, "string required")).toThrow("string required");
  });

  it("validates booleans and positive integers", () => {
    expect(optionalBoolean(true, "boolean required")).toBe(true);
    expect(optionalBoolean(undefined, "boolean required")).toBeUndefined();
    expect(optionalNullableBoolean(null, "nullable boolean required")).toBeNull();
    expect(requirePositiveInteger(1, "integer required")).toBe(1);
    expect(optionalPositiveInteger(undefined, "integer required")).toBeUndefined();

    expect(() => optionalBoolean("true", "boolean required")).toThrow("boolean required");
    expect(() => optionalNullableBoolean("true", "nullable boolean required")).toThrow(
      "nullable boolean required"
    );
    expect(() => requirePositiveInteger(0, "integer required")).toThrow("integer required");
    expect(() => optionalPositiveInteger(1.5, "integer required")).toThrow("integer required");
  });

  it("validates string arrays", () => {
    expect(requireStringArray([" one ", "two"], "strings required")).toEqual(["one", "two"]);
    expect(() => requireStringArray(["one", ""], "strings required")).toThrow("strings required");
    expect(() => requireStringArray("one", "strings required")).toThrow("strings required");
  });

  it("validates JSON-safe values", () => {
    expect(isJsonValue({ nested: ["value", 1, true, null] })).toBe(true);
    expect(isJsonValue({ invalid: Number.NaN })).toBe(false);
    expect(isJsonObject({ ok: true })).toBe(true);
    expect(optionalJsonValue({ ok: true }, "json required")).toEqual({ ok: true });
    expect(optionalJsonArray([1, "two"], "json array required")).toEqual([1, "two"]);
    expect(optionalJsonObject({ ok: true }, "json object required")).toEqual({ ok: true });

    expect(() => optionalJsonValue(Number.NaN, "json required")).toThrow("json required");
    expect(() => optionalJsonArray([Number.NaN], "json array required")).toThrow("json array required");
    expect(() => optionalJsonObject([], "json object required")).toThrow("json object required");
  });
});
