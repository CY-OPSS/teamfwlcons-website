import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamFwlcons - CS2 电竞战队",
  description: "学校 CS2 电竞战队官方网站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
