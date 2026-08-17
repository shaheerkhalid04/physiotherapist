/**
 * Patient-facing copy.
 *
 * Everything a patient reads that carries clinical meaning is either in this catalogue,
 * written by a human, or comes from their own clinician's prescription. No clinical string
 * shown to a patient is generated at runtime.
 *
 * The Urdu here needs review by a native speaker in the department before clinical use. It
 * is marked as such in PROGRESS.md rather than presented as finished.
 */

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const RTL_LOCALES: Locale[] = ["ur"];

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export const messages = {
  en: {
    "app.name": "Glide",
    "app.disclaimer":
      "This app supports your recovery. It does not replace review by your surgeon.",

    "nav.today": "Today",
    "nav.progress": "My progress",
    "nav.help": "Help",

    "today.title": "Today's session",
    "today.noPhase":
      "Your exercises have not been set yet. Your surgeon or therapist will add them.",
    "today.postOpDay": "Day {day} after your operation",
    "today.sets": "{sets} sets of {reps}",
    "today.hold": "Hold {seconds} seconds",
    "today.timesPerDay": "{count} times a day",
    "today.start": "Start",
    "today.done": "Done",
    "today.partial": "Partly done",
    "today.notDone": "Not done",
    "today.whyNotDone": "What stopped you?",
    "today.finish": "Finish session",

    "reason.PAIN": "Too painful",
    "reason.SWELLING": "Too swollen",
    "reason.TOO_DIFFICULT": "Too difficult",
    "reason.FORGOT": "Forgot",
    "reason.NO_TIME": "No time",
    "reason.SPLINT_PROBLEM": "Problem with the splint",
    "reason.UNWELL": "Feeling unwell",
    "reason.OTHER": "Something else",

    "measure.title": "Measure your movement",
    "measure.help": "Use the paper protractor you were given at discharge.",
    "measure.mcp": "Knuckle joint",
    "measure.pip": "Middle joint",
    "measure.dip": "End joint",
    "measure.flexion": "Bend",
    "measure.extension": "Straighten",
    "measure.implausible": "That looks unusual. You can still save it, please check first.",

    "symptoms.title": "How is your hand today?",
    "symptoms.painAtRest": "Pain when resting",
    "symptoms.painOnMovement": "Pain when moving",
    "symptoms.swelling": "Swelling",
    "symptoms.stiffness": "Stiffness",
    "symptoms.none": "None",
    "symptoms.moderate": "Some",
    "symptoms.severe": "A lot",
    "symptoms.splint": "Did you wear your splint as instructed?",

    "concern.button": "Something is wrong",
    "concern.title": "Tell us what is wrong",
    "concern.sent": "Your message has been sent to the hand team.",

    "urgent.contactDepartment":
      "Please contact the hand department now. Do not wait for your next appointment.",
    "urgent.weHaveYourMessage":
      "The hand team has your message. If you feel worse, contact the department now.",
    "outreach.splintReminder":
      "Your splint protects the repair. Please wear it exactly as your therapist showed you.",

    "offline.queued": "Saved on your phone. It will send when you have signal.",
    "offline.syncing": "Sending your records",
    "offline.synced": "Everything is saved",
    "offline.loading": "Loading your exercises",
    "offline.lastConfirmed": "Last confirmed with the hospital on {date}.",
    "offline.tooOld":
      "This phone has not connected to the hospital for {days} days, so we cannot be sure these are still the right exercises for you. Please contact the hand department before carrying on.",
    "offline.noCache":
      "Your exercises have not been downloaded to this phone yet. Please connect to the internet once, and after that you can use the app without signal.",

    "progress.title": "My progress",
    "progress.movement": "Movement",
    "progress.pain": "Pain",
    "progress.streak": "{count} day streak",
  },

  ur: {
    "app.name": "گلائیڈ",
    "app.disclaimer":
      "یہ ایپ آپ کی بحالی میں مدد کرتی ہے۔ یہ آپ کے سرجن کے معائنے کا متبادل نہیں ہے۔",

    "nav.today": "آج",
    "nav.progress": "میری پیش رفت",
    "nav.help": "مدد",

    "today.title": "آج کی مشقیں",
    "today.noPhase": "آپ کی مشقیں ابھی مقرر نہیں ہوئیں۔ آپ کا سرجن یا تھراپسٹ انہیں شامل کرے گا۔",
    "today.postOpDay": "آپریشن کے بعد {day} واں دن",
    "today.sets": "{reps} بار کے {sets} سیٹ",
    "today.hold": "{seconds} سیکنڈ روکیں",
    "today.timesPerDay": "دن میں {count} بار",
    "today.start": "شروع کریں",
    "today.done": "مکمل",
    "today.partial": "جزوی طور پر",
    "today.notDone": "نہیں کی",
    "today.whyNotDone": "کیا رکاوٹ آئی؟",
    "today.finish": "مشقیں مکمل کریں",

    "reason.PAIN": "بہت درد تھا",
    "reason.SWELLING": "بہت سوجن تھی",
    "reason.TOO_DIFFICULT": "بہت مشکل تھا",
    "reason.FORGOT": "بھول گیا",
    "reason.NO_TIME": "وقت نہیں ملا",
    "reason.SPLINT_PROBLEM": "پٹی میں مسئلہ تھا",
    "reason.UNWELL": "طبیعت ٹھیک نہیں تھی",
    "reason.OTHER": "کوئی اور وجہ",

    "measure.title": "اپنی حرکت ناپیں",
    "measure.help": "ڈسچارج کے وقت دیا گیا کاغذی پیمانہ استعمال کریں۔",
    "measure.mcp": "پور کا جوڑ",
    "measure.pip": "درمیانی جوڑ",
    "measure.dip": "آخری جوڑ",
    "measure.flexion": "خم کریں",
    "measure.extension": "سیدھا کریں",
    "measure.implausible": "یہ غیر معمولی لگتا ہے۔ آپ محفوظ کر سکتے ہیں، پہلے تصدیق کریں۔",

    "symptoms.title": "آج آپ کا ہاتھ کیسا ہے؟",
    "symptoms.painAtRest": "آرام کے وقت درد",
    "symptoms.painOnMovement": "حرکت کے وقت درد",
    "symptoms.swelling": "سوجن",
    "symptoms.stiffness": "سختی",
    "symptoms.none": "بالکل نہیں",
    "symptoms.moderate": "کچھ",
    "symptoms.severe": "بہت زیادہ",
    "symptoms.splint": "کیا آپ نے ہدایت کے مطابق پٹی پہنی؟",

    "concern.button": "کچھ ٹھیک نہیں ہے",
    "concern.title": "ہمیں بتائیں کیا مسئلہ ہے",
    "concern.sent": "آپ کا پیغام ہینڈ ٹیم کو بھیج دیا گیا ہے۔",

    "urgent.contactDepartment":
      "براہ کرم ابھی ہینڈ ڈیپارٹمنٹ سے رابطہ کریں۔ اگلی ملاقات کا انتظار نہ کریں۔",
    "urgent.weHaveYourMessage":
      "ہینڈ ٹیم کو آپ کا پیغام مل گیا ہے۔ اگر طبیعت بگڑے تو فوراً رابطہ کریں۔",
    "outreach.splintReminder":
      "آپ کی پٹی مرمت شدہ حصے کی حفاظت کرتی ہے۔ اسے بالکل ویسے پہنیں جیسے تھراپسٹ نے بتایا۔",

    "offline.queued": "آپ کے فون پر محفوظ ہو گیا۔ سگنل آنے پر بھیج دیا جائے گا۔",
    "offline.syncing": "آپ کا ریکارڈ بھیجا جا رہا ہے",
    "offline.synced": "سب کچھ محفوظ ہے",
    "offline.loading": "آپ کی مشقیں کھل رہی ہیں",
    "offline.lastConfirmed": "ہسپتال سے آخری تصدیق {date} کو ہوئی۔",
    "offline.tooOld":
      "اس فون کا ہسپتال سے {days} دن سے رابطہ نہیں ہوا، اس لیے ہم یقین سے نہیں کہہ سکتے کہ یہی مشقیں اب بھی آپ کے لیے درست ہیں۔ جاری رکھنے سے پہلے ہینڈ ڈیپارٹمنٹ سے رابطہ کریں۔",
    "offline.noCache":
      "آپ کی مشقیں ابھی اس فون پر محفوظ نہیں ہوئیں۔ ایک بار انٹرنیٹ سے منسلک ہوں، اس کے بعد آپ بغیر سگنل کے ایپ استعمال کر سکتے ہیں۔",

    "progress.title": "میری پیش رفت",
    "progress.movement": "حرکت",
    "progress.pain": "درد",
    "progress.streak": "{count} دن مسلسل",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];

export function translate(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  const catalogue = messages[locale] ?? messages.en;
  const template: string = catalogue[key] ?? messages.en[key] ?? key;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
