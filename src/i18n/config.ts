import { getRequestConfig } from "next-intl/server";

export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh";

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locales.includes(locale as Locale)
    ? locale
    : defaultLocale;

  return {
    messages: (await import(`./messages/${resolvedLocale}.json`)).default,
    locale: resolvedLocale!,
  };
});
