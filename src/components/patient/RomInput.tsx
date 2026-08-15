"use client";

import { useEffect, useState } from "react";
import { fingerRomInstrument, DIGITS } from "@/lib/clinical/instruments/fingerRom";
import { translate, type Locale } from "@/i18n/messages";

export interface RomValue {
  digit: (typeof DIGITS)[number];
  mcpFlexion: number;
  mcpExtension: number;
  pipFlexion: number;
  pipExtension: number;
  dipFlexion: number;
  dipExtension: number;
}

const EMPTY: RomValue = {
  digit: "INDEX",
  mcpFlexion: 0,
  mcpExtension: 0,
  pipFlexion: 0,
  pipExtension: 0,
  dipFlexion: 0,
  dipExtension: 0,
};

/**
 * Goniometer entry for a patient using the paper protractor issued at discharge.
 *
 * Implausible values warn and never block. The same instrument that scores on the server
 * produces the warning here, so the patient sees the same judgement the clinician will.
 */
export function RomInput({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (value: RomValue | null) => void;
}) {
  const [value, setValue] = useState<RomValue>(EMPTY);
  const [touched, setTouched] = useState(false);

  const warnings = touched
    ? fingerRomInstrument.score({
        digit: value.digit,
        active: {
          mcp: { flexion: value.mcpFlexion, extension: value.mcpExtension },
          pip: { flexion: value.pipFlexion, extension: value.pipExtension },
          dip: { flexion: value.dipFlexion, extension: value.dipExtension },
        },
      }).warnings
    : [];

  useEffect(() => {
    onChange(touched ? value : null);
  }, [value, touched, onChange]);

  const field = (
    label: string,
    key: keyof Omit<RomValue, "digit">,
    min: number,
    max: number,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-base">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value[key]}
        onChange={(event) => {
          setTouched(true);
          setValue((current) => ({ ...current, [key]: Number(event.target.value) }));
        }}
        className="rounded-control border border-border-strong bg-surface px-3 py-3 text-lg"
      />
    </label>
  );

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{translate(locale, "measure.title")}</h2>
      <p className="mt-1 text-base text-ink-muted">{translate(locale, "measure.help")}</p>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-base">{locale === "ur" ? "انگلی" : "Finger"}</span>
        <select
          value={value.digit}
          onChange={(event) => {
            setTouched(true);
            setValue((current) => ({
              ...current,
              digit: event.target.value as RomValue["digit"],
            }));
          }}
          className="rounded-control border border-border-strong bg-surface px-3 py-3 text-lg"
        >
          {DIGITS.map((digit) => (
            <option key={digit} value={digit}>
              {digit}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {field(`${translate(locale, "measure.mcp")} ${translate(locale, "measure.flexion")}`, "mcpFlexion", -30, 120)}
        {field(`${translate(locale, "measure.mcp")} ${translate(locale, "measure.extension")}`, "mcpExtension", -90, 45)}
        {field(`${translate(locale, "measure.pip")} ${translate(locale, "measure.flexion")}`, "pipFlexion", -30, 140)}
        {field(`${translate(locale, "measure.pip")} ${translate(locale, "measure.extension")}`, "pipExtension", -90, 45)}
        {field(`${translate(locale, "measure.dip")} ${translate(locale, "measure.flexion")}`, "dipFlexion", -30, 110)}
        {field(`${translate(locale, "measure.dip")} ${translate(locale, "measure.extension")}`, "dipExtension", -90, 45)}
      </div>

      {warnings.length > 0 ? (
        <p
          role="status"
          data-testid="rom-warning"
          className="mt-3 flex gap-2 rounded-control bg-review-quiet p-3 text-base"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-review">
            <path d="M10 1.5l8.5 15h-17l8.5-15zm0 5a1 1 0 00-1 1v4a1 1 0 002 0v-4a1 1 0 00-1-1zm0 9.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
          </svg>
          <span>{translate(locale, "measure.implausible")}</span>
        </p>
      ) : null}
    </section>
  );
}
