"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return;
    
    // Remove current locale from pathname if it exists
    let pathWithoutLocale = pathname;
    if (pathname.startsWith("/zh")) {
      pathWithoutLocale = pathname.substring(3) || "/";
    } else if (pathname.startsWith("/en")) {
      pathWithoutLocale = pathname.substring(3) || "/";
    }
    
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
            : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          locale === "en"
            ? "bg-blue-600 text-white"
            : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
        }`}
      >
        EN
      </button>
    </div>
  );
}
