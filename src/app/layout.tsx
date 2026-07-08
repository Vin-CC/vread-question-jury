import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VREAD Question Jury",
  description: "LLM-as-a-Jury for verified reading-comprehension questions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
