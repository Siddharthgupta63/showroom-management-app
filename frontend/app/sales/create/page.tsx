"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Backward-compat route: /sales/create -> /sales/new
export default function SalesCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sales/new");
  }, [router]);

  return null;
}
