"use client";

import { useEffect, useState } from "react";
import { translate, type Locale } from "@/i18n/messages";

export interface SymptomValue {
  painAtRest: number;
  painOnMovement: number;
  swelling: number;
  stiffness: number;
  fever: boolean;
  spreadingRedness: boolean;
  discharge: boolean;
  numbness: boolean;
  colourChange: boolean;
  coldIntolerance: boolean;
  temperatureChange: boolean;
  orthosis: "WORN_AS_INSTRUCTED" | "WORN_PARTIALLY" | "NOT_WORN" | "NOT_APPLICABLE";
}

const EMPTY: SymptomValue = {
  painAtRest: 0,
  painOnMovement: 0,
  swelling: 0,
  stiffness: 0,
  fever: false,
  spreadingRedness: false,
  discharge: false,
  numbness: false,
  colourChange: false,
  coldIntolerance: false,
  temperatureChange: false,
  orthosis: "NOT_APPLICABLE",
};

const FLAGS: { key: keyof SymptomValue; en: string; ur: string }[] = [
  { key: "fever", en: "Fever", ur: "بخار" },
  { key: "spreadingRedness", en: "Redness spreading from the wound", ur: "زخم سے پھیلتی سرخی" },
  { key: "discharge", en: "Discharge or pus", ur: "پیپ یا رطوبت" },
  { key: "numbness", en: "New numbness", ur: "نیا سن پن" },
  { key: "colourChange", en: "Finger changing colour", ur: "انگلی کا رنگ بدلنا" },
  { key: "coldIntolerance", en: "New coldness in the hand", ur: "ہاتھ میں نئی ٹھنڈ" },
  { key: "temperatureChange", en: "Hand feels hotter or colder than usual", ur: "ہاتھ معمول سے گرم یا ٹھنڈا" },
];

/**
 * Pain, swelling, stiffness and the red flag symptoms.
 *
 * The symptom checkboxes are plain descriptions of what the patient can observe. They are
 * not phrased as diagnoses, and no interpretation is shown back: the rules engine decides
 * what a combination means, and a clinician sees the result.
 */
export function SymptomForm({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (value: SymptomValue) => void;
}) {
  const [value, setValue] = useState<SymptomValue>(EMPTY);

  useEffect(() => {
    onChange(value);
  }, [value, onChange]);

  const scale = (label: string, key: "painAtRest" | "painOnMovement") => (
    <label className="flex flex-col gap-2">
      <span className="text-base">
        {label}: <strong className="tabular-nums">{value[key]}</strong> / 10
      </span>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value[key]}
        onChange={(event) =>
          setValue((current) => ({ ...current, [key]: Number(event.target.value) }))
        }
        className="h-10 w-full"
      />
    </label>
  );

  const threePoint = (label: string, key: "swelling" | "stiffness") => (
    <fieldset>
      <legend className="text-base">{label}</legend>
      <div className="mt-2 flex gap-2">
        {[0, 1, 2].map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value[key] === level}
            onClick={() => setValue((current) => ({ ...current, [key]: level }))}
            className={`flex-1 rounded-control border px-3 py-3 text-base ${
              value[key] === level
                ? "border-accent bg-accent-quiet"
                : "border-border bg-surface-sunken"
            }`}
          >
            {translate(
              locale,
              level === 0 ? "symptoms.none" : level === 1 ? "symptoms.moderate" : "symptoms.severe",
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{translate(locale, "symptoms.title")}</h2>

      {scale(translate(locale, "symptoms.painAtRest"), "painAtRest")}
      {scale(translate(locale, "symptoms.painOnMovement"), "painOnMovement")}
      {threePoint(translate(locale, "symptoms.swelling"), "swelling")}
      {threePoint(translate(locale, "symptoms.stiffness"), "stiffness")}

      <fieldset>
        <legend className="text-base">{translate(locale, "symptoms.splint")}</legend>
        <div className="mt-2 flex flex-col gap-2">
          {(["WORN_AS_INSTRUCTED", "WORN_PARTIALLY", "NOT_WORN", "NOT_APPLICABLE"] as const).map(
            (option) => (
              <button
                key={option}
                type="button"
                aria-pressed={value.orthosis === option}
                onClick={() => setValue((current) => ({ ...current, orthosis: option }))}
                className={`rounded-control border px-3 py-3 text-start text-base ${
                  value.orthosis === option
                    ? "border-accent bg-accent-quiet"
                    : "border-border bg-surface-sunken"
                }`}
              >
                {option === "WORN_AS_INSTRUCTED"
                  ? locale === "ur"
                    ? "ہدایت کے مطابق پہنی"
                    : "Worn as instructed"
                  : option === "WORN_PARTIALLY"
                    ? locale === "ur"
                      ? "کچھ دیر پہنی"
                      : "Worn some of the time"
                    : option === "NOT_WORN"
                      ? locale === "ur"
                        ? "نہیں پہنی"
                        : "Not worn"
                      : locale === "ur"
                        ? "مجھے پٹی نہیں دی گئی"
                        : "I was not given a splint"}
              </button>
            ),
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-base font-medium">
          {locale === "ur" ? "کیا ان میں سے کچھ ہے؟" : "Do you have any of these?"}
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {FLAGS.map((flag) => (
            <label key={String(flag.key)} className="flex items-center gap-3 py-2 text-base">
              <input
                type="checkbox"
                checked={Boolean(value[flag.key])}
                onChange={(event) =>
                  setValue((current) => ({ ...current, [flag.key]: event.target.checked }))
                }
                className="h-6 w-6"
              />
              <span>{locale === "ur" ? flag.ur : flag.en}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
