"use client";

type Props = {
  url: string;
  filename?: string;
};

export default function ExportButton({ url, filename }: Props) {
  const handleExport = async () => {
    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("showroom_token") ||
        "";

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Export failed:", res.status, text);
        alert("Export failed. Please login again or check report API.");
        return;
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "report.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium"
    >
      Export Excel
    </button>
  );
}