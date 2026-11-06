import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioLabel — AI-Powered Biomedical Image Annotation Platform",
  description:
    "From Microscopy Images to AI-Ready Datasets in Minutes. High-performance CPU-only biomedical image annotation.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#070b13] text-slate-100 antialiased selection:bg-brand-cyan/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
