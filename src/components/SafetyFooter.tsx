import { translate, type Locale } from "@/i18n/messages";

/**
 * The non-dismissible footer required on every patient screen.
 *
 * It takes no props that could hide it and renders no close control. That is the point: a
 * patient must not be able to make it go away, and neither must a future component author
 * by passing a flag.
 */
export function SafetyFooter({ locale }: { locale: Locale }) {
  return (
    <footer
      role="contentinfo"
      data-testid="safety-footer"
      className="border-t border-[--color-border] bg-[--color-surface-sunken] px-4 py-3 text-center text-sm text-[--color-ink-muted]"
    >
      {translate(locale, "app.disclaimer")}
    </footer>
  );
}
