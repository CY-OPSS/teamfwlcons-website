import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
  // 已移除语言切换：固定中文，避免按浏览器语言跳到 /en
  localeDetection: false,
});

export const config = {
  matcher: ["/((?!api|_next|admin|login|.*\\..*).*)"],
};
