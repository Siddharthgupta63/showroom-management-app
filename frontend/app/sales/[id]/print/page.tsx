"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import api from "@/lib/api";

export default function SalePrintPage() {
  const params = useParams();
  const id = Number((params as any)?.id);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/sales/${id}/print`);
        setData(res.data?.data || null);
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Failed to load print data");
      }
    })();
  }, [id]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-gray-500">Loading...</div>;

  const s = data.sale || {};
  const b = data.branch || {};
  const c = data.contact || {};
  const v = data.vehicle || {};

  return (
    <AuthGuard>
      <div className="p-6 print:p-0">
        <style jsx global>{`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>

        <div className="no-print mb-4 flex gap-2">
          <button className="px-4 py-2 border rounded" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>

        <div className="border p-4 rounded bg-white text-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xl font-bold">SALE REGISTER</div>
              <div className="text-xs text-gray-600">Dealer Printable (Snapshot)</div>
            </div>
            <div className="text-right">
              <div>
                <b>Sale ID:</b> {s.id}
              </div>
              <div>
                <b>Date:</b> {String(s.sale_date || "").slice(0, 10)}
              </div>
              <div>
                <b>Invoice:</b> {s.invoice_number || "-"}
              </div>
              <div>
                <b>Branch:</b> {b.branch_name || "-"}
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-semibold">Customer</div>
              <div>
                <b>Name:</b> {s.customer_name || c.full_name || "-"}
              </div>
              <div>
                <b>Mobile:</b> {s.mobile_number || "-"}
              </div>
              <div>
                <b>Father:</b> {s.father_name || "-"}
              </div>
              <div>
                <b>Address:</b> {s.address || c.address || "-"}
              </div>
            </div>

            <div>
              <div className="font-semibold">Vehicle</div>
              <div>
                <b>Model:</b> {s.vehicle_model || [v.model_name, v.variant_name].filter(Boolean).join(" ") || "-"}
              </div>
              <div>
                <b>Chassis:</b> {s.chassis_number || "-"}
              </div>
              <div>
                <b>Engine:</b> {s.engine_number || "-"}
              </div>
              <div>
                <b>Tyre:</b> {s.tyre || "-"} &nbsp; <b>Helmet:</b> {s.helmet || "-"}
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-semibold">Insurance</div>
              <div>
                <b>Policy:</b> {s.insurance_number || "-"}
              </div>
              <div>
                <b>Company:</b> {s.insurance_company || "-"}
              </div>
              <div>
                <b>Broker:</b> {s.insurance_broker || "-"}
              </div>
              <div>
                <b>CPA:</b> {Number(s.cpa_applicable) === 1 ? "Yes" : "No"} &nbsp;{" "}
                <b>CPA No:</b> {s.cpa_insurance_number || "-"}
              </div>
            </div>

            <div>
              <div className="font-semibold">Payment & RC</div>
              <div>
                <b>Sale Price:</b> {s.sale_price || 0}
              </div>
              <div>
                <b>Finance Company:</b> {s.finance_company || "-"}
              </div>
              <div>
                <b>RC Required:</b> {Number(s.rc_required) === 1 ? "Yes" : "No"}
              </div>
              <div>
                <b>Aadhaar Required:</b> {Number(s.aadhaar_required) === 1 ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <hr className="my-3" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-semibold">Notes</div>
              <div className="min-h-[70px] border rounded p-2">{s.notes || ""}</div>
            </div>
            <div>
              <div className="font-semibold">Signature</div>
              <div className="min-h-[70px] border rounded p-2"></div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
