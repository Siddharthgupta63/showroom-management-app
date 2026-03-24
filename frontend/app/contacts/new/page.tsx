"use client";

import React, { Suspense } from "react";
import NewContactPageInner from "./pageInner";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
      <NewContactPageInner />
    </Suspense>
  );
}