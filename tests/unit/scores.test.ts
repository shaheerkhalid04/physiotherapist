import { describe, expect, it } from "vitest";
import {
  stricklandModifiedInstrument,
  stricklandOriginalInstrument,
  stricklandPercent,
} from "@/lib/clinical/instruments/strickland";
import { quickDashInstrument, QUICKDASH_ITEMS } from "@/lib/clinical/instruments/quickDash";
import {
  prwheInstrument,
  PRWHE_ITEMS,
  PRWHE_PAIN_ITEMS,
  PRWHE_FUNCTION_ITEMS,
} from "@/lib/clinical/instruments/prwhe";
import { kapandjiInstrument, elbowRomInstrument } from "@/lib/clinical/instruments/jointArcs";
import { buildBuckGramckoInstrument } from "@/lib/clinical/instruments/buckGramckoLister";

describe("Strickland formula, PIP plus DIP over a 175 degree reference arc", () => {
  it("worked example: PIP 90 and DIP 60 with deficits 10 and 5 gives 77.1 percent", () => {
    // (90 + 60) - (10 + 5) = 135; 135 / 175 * 100 = 77.14
    const input = {
      pip: { flexion: 90, extension: -10 },
      dip: { flexion: 60, extension: -5 },
    };
    expect(stricklandPercent(input)).toBeCloseTo(77.14, 2);
  });

  it("worked example: a full 175 degree arc with no deficit is 100 percent", () => {
    const input = {
      pip: { flexion: 110, extension: 0 },
      dip: { flexion: 65, extension: 0 },
    };
    expect(stricklandPercent(input)).toBeCloseTo(100, 5);
  });

  it("the same 77.1 percent is EXCELLENT on original bands and GOOD on modified bands", () => {
    // This divergence is why both variants ship, and why the department must nominate one.
    const input = {
      pip: { flexion: 90, extension: -10 },
      dip: { flexion: 60, extension: -5 },
    };
    expect(stricklandOriginalInstrument.score(input).derived.grade).toBe("EXCELLENT");
    expect(stricklandModifiedInstrument.score(input).derived.grade).toBe("GOOD");
  });

  it("grades 45 percent as FAIR on original bands and POOR on modified bands", () => {
    const input = {
      pip: { flexion: 50, extension: -5 },
      dip: { flexion: 35, extension: -1.25 },
    };
    const original = stricklandOriginalInstrument.score(input);
    expect(original.derived.percent).toBeCloseTo(45, 1);
    expect(original.derived.grade).toBe("FAIR");
    expect(stricklandModifiedInstrument.score(input).derived.grade).toBe("POOR");
  });

  it("does not credit hyperextension at the PIP", () => {
    const hyper = stricklandPercent({
      pip: { flexion: 90, extension: 15 },
      dip: { flexion: 60, extension: 0 },
    });
    const neutral = stricklandPercent({
      pip: { flexion: 90, extension: 0 },
      dip: { flexion: 60, extension: 0 },
    });
    expect(hyper).toBe(neutral);
  });
});

describe("QuickDASH, ((mean of responses) - 1) * 25", () => {
  const answerAll = (value: number | null) =>
    Object.fromEntries(QUICKDASH_ITEMS.map((item) => [item, value])) as Record<
      (typeof QUICKDASH_ITEMS)[number],
      number | null
    >;

  it("worked example: every item answered 1, no difficulty, scores 0", () => {
    expect(quickDashInstrument.score(answerAll(1)).value).toBe(0);
  });

  it("worked example: every item answered 5, unable, scores 100", () => {
    expect(quickDashInstrument.score(answerAll(5)).value).toBe(100);
  });

  it("worked example: every item answered 3 scores 50", () => {
    // mean 3, (3 - 1) * 25 = 50
    expect(quickDashInstrument.score(answerAll(3)).value).toBe(50);
  });

  it("scores from ten items when one is missing, as the DASH manual permits", () => {
    const responses = answerAll(2);
    responses[QUICKDASH_ITEMS[0]] = null;
    const result = quickDashInstrument.score(responses);
    expect(result.derived.answered).toBe(10);
    expect(result.value).toBe(25);
  });

  it("refuses to score when two items are missing rather than inventing a total", () => {
    const responses = answerAll(2);
    responses[QUICKDASH_ITEMS[0]] = null;
    responses[QUICKDASH_ITEMS[1]] = null;
    const result = quickDashInstrument.score(responses);
    expect(result.value).toBeNull();
    expect(result.derived.scorable).toBe(false);
  });
});

describe("PRWHE, pain 0 to 50 plus function halved to 0 to 50", () => {
  const answerAll = (value: number | null) =>
    Object.fromEntries(PRWHE_ITEMS.map((item) => [item, value])) as Record<
      (typeof PRWHE_ITEMS)[number],
      number | null
    >;

  it("worked example: every item 0 scores 0, the best possible result", () => {
    expect(prwheInstrument.score(answerAll(0)).value).toBe(0);
  });

  it("worked example: every item 10 scores 100, the worst possible result", () => {
    // pain 5 x 10 = 50, function 10 x 10 = 100 halved to 50, total 100
    const result = prwheInstrument.score(answerAll(10));
    expect(result.derived.pain).toBe(50);
    expect(result.derived.function).toBe(50);
    expect(result.value).toBe(100);
  });

  it("worked example: every item 5 scores 50", () => {
    const result = prwheInstrument.score(answerAll(5));
    expect(result.derived.pain).toBe(25);
    expect(result.derived.function).toBe(25);
    expect(result.value).toBe(50);
  });

  it("halves the function subscale, so ten function items of 10 contribute 50 not 100", () => {
    const responses = answerAll(0);
    for (const item of PRWHE_FUNCTION_ITEMS) responses[item] = 10;
    const result = prwheInstrument.score(responses);
    expect(result.derived.function).toBe(50);
    expect(result.value).toBe(50);
  });

  it("sums the pain subscale without halving it", () => {
    const responses = answerAll(0);
    for (const item of PRWHE_PAIN_ITEMS) responses[item] = 10;
    const result = prwheInstrument.score(responses);
    expect(result.derived.pain).toBe(50);
    expect(result.value).toBe(50);
  });

  it("refuses to score a partially completed questionnaire", () => {
    const responses = answerAll(5);
    responses[PRWHE_ITEMS[0]] = null;
    const result = prwheInstrument.score(responses);
    expect(result.value).toBeNull();
    expect(result.derived.missing).toContain(PRWHE_ITEMS[0]);
  });
});

describe("Kapandji and elbow arc", () => {
  it("passes the Kapandji landmark score through unchanged, 0 to 10", () => {
    expect(kapandjiInstrument.score({ score: 7 }).value).toBe(7);
  });

  it("worked example: elbow flexion 130 with a 30 degree fixed flexion deformity is a 100 degree arc", () => {
    const result = elbowRomInstrument.score({ flexion: 130, extensionDeficit: 30 });
    expect(result.value).toBe(100);
    expect(result.derived.functionalArcAchieved).toBe(true);
  });

  it("worked example: elbow flexion 110 with a 40 degree deficit misses the functional arc", () => {
    const result = elbowRomInstrument.score({ flexion: 110, extensionDeficit: 40 });
    expect(result.value).toBe(70);
    expect(result.derived.functionalArcAchieved).toBe(false);
  });
});

describe("Buck-Gramcko-Lister", () => {
  const input = {
    mcp: { flexion: 85, extension: 0 },
    pip: { flexion: 95, extension: -10 },
    dip: { flexion: 60, extension: -5 },
    fingertipToPalmCm: 1.5,
  };

  it("computes summed active motion of 225 degrees from 240 flexion less 15 deficit", () => {
    const result = buildBuckGramckoInstrument().score(input);
    expect(result.derived.flexionTotal).toBe(240);
    expect(result.derived.extensionDeficitTotal).toBe(15);
    expect(result.value).toBe(225);
  });

  it("returns no grade and warns while the department has not approved point bands", () => {
    const result = buildBuckGramckoInstrument().score(input);
    expect(result.derived.grade).toBeNull();
    expect(result.derived.gradingConfigured).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });

  it("grades once a clinician has approved bands", () => {
    const configured = buildBuckGramckoInstrument({
      approved: true,
      bands: [
        { grade: "EXCELLENT", minMotion: 220 },
        { grade: "GOOD", minMotion: 180 },
        { grade: "FAIR", minMotion: 130 },
        { grade: "POOR", minMotion: 0 },
      ],
    });
    expect(configured.score(input).derived.grade).toBe("EXCELLENT");
  });
});
