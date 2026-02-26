// frontend/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Showroom DMS",
  description: "Dealer Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
