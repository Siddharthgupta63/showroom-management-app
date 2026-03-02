"use client";

import React, { Suspense } from "react";
import PurchasesPrintSummaryInner from "./PrintClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
      <PurchasesPrintSummaryInner />
    </Suspense>
  );
}
