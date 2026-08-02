"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    // Remove current locale from pathname
    const pathWithoutLocale = pathname.replace(/^\/(zh|en)/, "") || "/";
    // Navigate to new locale
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => switchLocale("zh")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          locale === "zh"
            ? "bg-blue-600 text-white"
            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          locale === "en"
            ? "bg-blue-600 text-white"
            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
        }`}
      >
        EN
      </button>
    </div>
  );
}
