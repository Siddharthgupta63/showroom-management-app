"use client";

import React, { Suspense } from "react";
import VehiclesNewClient from "./VehiclesNewClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
      <VehiclesNewClient />
    </Suspense>
  );
}
