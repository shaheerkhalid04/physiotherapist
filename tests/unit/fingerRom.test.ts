import { describe, expect, it } from "vitest";
import {
  activeLossWithPreservedPassive,
  fingerRomInstrument,
  type FingerRomInput,
} from "@/lib/clinical/instruments/fingerRom";

const digit = (
  mcp: [number, number],
  pip: [number, number],
  dip: [number, number],
  passive?: { mcp: [number, number]; pip: [number, number]; dip: [number, number] },
): FingerRomInput => ({
  digit: "INDEX",
  active: {
    mcp: { flexion: mcp[0], extension: mcp[1] },
    pip: { flexion: pip[0], extension: pip[1] },
    dip: { flexion: dip[0], extension: dip[1] },
  },
  passive: passive
    ? {
        mcp: { flexion: passive.mcp[0], extension: passive.mcp[1] },
        pip: { flexion: passive.pip[0], extension: passive.pip[1] },
        dip: { flexion: passive.dip[0], extension: passive.dip[1] },
      }
    : undefined,
});

describe("Total Active Motion, ASSH definition", () => {
  it("worked example: a normal index finger with 85/100/75 flexion and no lag scores TAM 260", () => {
    const result = fingerRomInstrument.score(digit([85, 0], [100, 0], [75, 0]));
    expect(result.value).toBe(260);
    expect(result.derived.percentOfNormal).toBe(100);
  });

  it("worked example: flexion 85/100/70 with PIP lag 15 and DIP lag 5 scores TAM 235", () => {
    // Summed flexion 255, summed extension deficit 20, TAM 235.
    const result = fingerRomInstrument.score(digit([85, 0], [100, -15], [70, -5]));
    expect(result.value).toBe(235);
    expect(result.derived.extensionLag).toEqual({ mcp: 0, pip: 15, dip: 5, total: 20 });
  });

  it("credits hyperextension as zero deficit rather than as extra motion", () => {
    // A PIP that hyperextends 10 degrees must not add 10 degrees to TAM.
    const hyper = fingerRomInstrument.score(digit([85, 0], [100, 10], [75, 0]));
    const neutral = fingerRomInstrument.score(digit([85, 0], [100, 0], [75, 0]));
    expect(hyper.value).toBe(neutral.value);
  });

  it("computes Total Passive Motion separately when a clinician supplies passive values", () => {
    const result = fingerRomInstrument.score(
      digit([80, 0], [80, -10], [60, -10], {
        mcp: [90, 0],
        pip: [100, 0],
        dip: [75, 0],
      }),
    );
    expect(result.value).toBe(200);
    expect(result.derived.tpm).toBe(265);
  });

  it("warns when passive motion is recorded as less than active motion", () => {
    const result = fingerRomInstrument.score(
      digit([85, 0], [100, 0], [75, 0], { mcp: [40, 0], pip: [40, 0], dip: [30, 0] }),
    );
    expect(result.warnings.some((w) => w.field === "passive")).toBe(true);
  });

  it("warns on implausible flexion but still records the value", () => {
    const result = fingerRomInstrument.score(digit([85, 0], [135, 0], [75, 0]));
    expect(result.warnings.some((w) => w.field === "active.pip.flexion")).toBe(true);
    expect(result.value).not.toBeNull();
  });
});

describe("active loss with preserved passive motion", () => {
  it("detects the rupture pattern: active TAM falls 60 degrees while passive is preserved", () => {
    const before = digit([85, 0], [100, 0], [75, 0]);
    const after = digit([85, 0], [40, 0], [35, 0], {
      mcp: [85, 0],
      pip: [100, 0],
      dip: [75, 0],
    });
    expect(activeLossWithPreservedPassive(before, after, 20)).toBe(true);
  });

  it("does not fire when passive motion fell alongside active motion, which is stiffness", () => {
    const before = digit([85, 0], [100, 0], [75, 0]);
    const after = digit([85, 0], [40, 0], [35, 0], {
      mcp: [85, 0],
      pip: [45, 0],
      dip: [38, 0],
    });
    expect(activeLossWithPreservedPassive(before, after, 20)).toBe(false);
  });
});
