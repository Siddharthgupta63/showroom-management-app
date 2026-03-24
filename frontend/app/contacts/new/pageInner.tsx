"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function NewContactPageInner() {
  const params = useSearchParams();
  const router = useRouter();

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    vehicle_no: "",
    rto_number: "",
  });

  useEffect(() => {
    const vehicle = params.get("vehicle_no");
    if (vehicle) {
      setForm((prev) => ({ ...prev, vehicle_no: vehicle }));
    }
  }, [params]);

  const handleSubmit = async () => {
    try {
      const res = await api.post("/api/contacts", {
        customer_name: form.customer_name,
        phones: [form.phone],
        vehicles: [
          {
            vehicle_no: form.vehicle_no,
            rto_number: form.rto_number,
          },
        ],
      });

      alert("Contact created");
      router.push(`/contacts/${res.data.id}`);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Error");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>New Contact</h2>

      <input
        placeholder="Customer Name"
        value={form.customer_name}
        onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
      />

      <input
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />

      <input
        placeholder="Vehicle Number"
        value={form.vehicle_no}
        onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })}
      />

      <input
        placeholder="RTO Number"
        value={form.rto_number}
        onChange={(e) => setForm({ ...form, rto_number: e.target.value })}
      />

      <button onClick={handleSubmit}>Save</button>
    </div>
  );
}