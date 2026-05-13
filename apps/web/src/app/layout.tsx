import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearDeed | Verify a Khordha Plot Before You Pay",
  description:
    "ClearDeed checks Odisha public land records and prepares a buyer-friendly property verification report for Khordha plots.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
