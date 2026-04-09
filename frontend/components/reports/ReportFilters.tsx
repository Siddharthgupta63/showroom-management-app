"use client";

type Option = {
  value: string;
  label: string;
};

type Props = {
  values: {
    fromDate: string;
    toDate: string;
    branchId?: string;
    status?: string;
    search: string;
  };
  onChange: (field: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  branchOptions?: Option[];
  statusOptions?: Option[];
  showStatus?: boolean;
};

export default function ReportFilters({
  values,
  onChange,
  onApply,
  onReset,
  branchOptions = [],
  statusOptions = [],
  showStatus = false,
}: Props) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">From Date</label>
          <input
            type="date"
            value={values.fromDate}
            onChange={(e) => onChange("fromDate", e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">To Date</label>
          <input
            type="date"
            value={values.toDate}
            onChange={(e) => onChange("toDate", e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Branch</label>
          <select
            value={values.branchId || ""}
            onChange={(e) => onChange("branchId", e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">All Branches</option>
            {branchOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {showStatus && (
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={values.status || ""}
              onChange={(e) => onChange("status", e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">All Status</option>
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={showStatus ? "" : "xl:col-span-2"}>
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            value={values.search}
            onChange={(e) => onChange("search", e.target.value)}
            placeholder="Customer / Mobile / Chassis / Vehicle"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={onApply}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium"
          >
            Apply
          </button>
          <button
            onClick={onReset}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}