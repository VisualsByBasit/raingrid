import { describe, expect, it } from "vitest";
import { classifyGpu, decodeCache, encodeCache, parseQuality, pickQuality, stepDown, tooSlow, type DeviceInfo } from "./quality";

const desktop = (renderer: string, extra: Partial<DeviceInfo> = {}): DeviceInfo => ({
  renderer,
  memory: 8,
  cores: 16,
  screenPx: 1920 * 1080,
  phone: false,
  ...extra,
});

describe("classifyGpu", () => {
  it.each([
    ["ANGLE (Intel, Intel(R) UHD Graphics (0x00009A60) Direct3D11 vs_5_0 ps_5_0, D3D11)", "integrated"],
    ["ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", "integrated"],
    ["ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)", "integrated"],
    ["ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", "integrated"],
    ["ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", "integrated"],
    ["ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)", "integrated"],
    ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)", "discrete"],
    ["ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)", "discrete"],
    ["ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", "discrete"],
    ["AMD Radeon Pro 5500M OpenGL Engine", "discrete"],
    ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)", "software"],
    ["ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)", "software"],
    ["llvmpipe (LLVM 15.0.7, 256 bits)", "software"],
    ["", "unknown"],
    ["WebKit WebGL", "unknown"],
  ])("%s -> %s", (renderer, gpu) => {
    expect(classifyGpu(renderer)).toBe(gpu);
  });
});

describe("pickQuality", () => {
  it("gives dedicated GPUs the full scene", () => {
    expect(pickQuality(desktop("NVIDIA GeForce RTX 4070")).quality).toBe("high");
  });
  it("gives integrated GPUs and phones the medium tier", () => {
    expect(pickQuality(desktop("Intel(R) UHD Graphics")).quality).toBe("medium");
    expect(pickQuality(desktop("Apple GPU", { phone: true })).quality).toBe("medium");
  });
  it("sends software rendering and weak devices to the CSS hero", () => {
    expect(pickQuality(desktop("SwiftShader")).quality).toBe("low");
    expect(pickQuality(desktop("NVIDIA GeForce GTX 1050", { cores: 4 })).quality).toBe("low");
    expect(pickQuality(desktop("Intel(R) UHD Graphics", { memory: 2 })).quality).toBe("low");
  });
  it("is careful with an unknown GPU on little memory or a huge screen", () => {
    expect(pickQuality(desktop("", { memory: 4 })).quality).toBe("medium");
    expect(pickQuality(desktop("", { screenPx: 3840 * 2160 })).quality).toBe("medium");
    expect(pickQuality(desktop("")).quality).toBe("high");
  });
});

describe("probe and stepping", () => {
  it("steps down one tier at a time and stops at low", () => {
    expect(stepDown("high")).toBe("medium");
    expect(stepDown("medium")).toBe("low");
    expect(stepDown("low")).toBe("low");
  });
  it("flags a high tier under 30 fps but not a medium tier at its 30 fps cap", () => {
    const at30 = Array(60).fill(33.4);
    expect(tooSlow("high", at30).slow).toBe(false);
    expect(tooSlow("high", Array(40).fill(42)).slow).toBe(true);
    expect(tooSlow("medium", Array(40).fill(42)).slow).toBe(false);
    expect(tooSlow("medium", Array(30).fill(70)).slow).toBe(true);
  });
  it("ignores a few hitches", () => {
    const frames = [...Array(50).fill(17), 140, 120, 160];
    expect(tooSlow("high", frames)).toEqual({ slow: false, median: 17 });
  });
});

describe("query and cache", () => {
  it("parses ?quality", () => {
    expect(parseQuality("medium")).toBe("medium");
    expect(parseQuality("ultra")).toBeNull();
    expect(parseQuality(null)).toBeNull();
  });
  it("only trusts a cached tier for the same GPU", () => {
    const raw = encodeCache("medium", "Intel(R) UHD Graphics");
    expect(decodeCache(raw, "Intel(R) UHD Graphics")).toBe("medium");
    expect(decodeCache(raw, "NVIDIA GeForce RTX 4070")).toBeNull();
    expect(decodeCache("not json", "x")).toBeNull();
    expect(decodeCache(null, "x")).toBeNull();
  });
});
