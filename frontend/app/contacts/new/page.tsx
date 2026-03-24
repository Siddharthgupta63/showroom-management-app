"use client";

import React, { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import NewContactPageInner from "./pageInner";

export default function Page() {
  return (
    <AuthGuard>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <NewContactPageInner />
      </Suspense>
    </AuthGuard>
  );
}