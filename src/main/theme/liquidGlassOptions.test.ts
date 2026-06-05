import { describe, expect, it } from "vitest";

import { assertRgbaHexColor, controlLiquidGlassConfiguration } from "./liquidGlassOptions";

describe("controlLiquidGlassConfiguration", () => {
  it("uses a neutral transparent RGBA tint and app-surface backing", () => {
    expect(controlLiquidGlassConfiguration.viewOptions).toEqual({
      cornerRadius: 30,
      tintColor: "#FFFFFF00",
      opaque: true
    });
    expect(assertRgbaHexColor(controlLiquidGlassConfiguration.viewOptions.tintColor)).toBe(true);
  });

  it("keeps private material tuning neutral by default", () => {
    expect(controlLiquidGlassConfiguration.tuning).toEqual({
      scrim: 0,
      subdued: 0
    });
  });
});
