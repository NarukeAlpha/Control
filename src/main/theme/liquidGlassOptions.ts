export interface LiquidGlassViewOptions {
  cornerRadius: number;
  tintColor: `#${string}`;
  opaque: boolean;
}

export interface LiquidGlassTuning {
  scrim: number;
  subdued: number;
}

export interface LiquidGlassConfiguration {
  viewOptions: LiquidGlassViewOptions;
  tuning: LiquidGlassTuning;
}

export const controlLiquidGlassConfiguration: LiquidGlassConfiguration = {
  viewOptions: {
    // tintColor uses #RRGGBBAA byte order in electron-liquid-glass native code.
    // Keep alpha at zero until focused/unfocused screenshots prove a tint is
    // needed; colored native tints shift noticeably across macOS states.
    cornerRadius: 30,
    tintColor: "#FFFFFF00",
    opaque: true
  },
  tuning: {
    scrim: 0,
    subdued: 0
  }
};

export function assertRgbaHexColor(value: string): value is `#${string}` {
  return /^#[0-9a-fA-F]{8}$/.test(value);
}
