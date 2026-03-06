// frontend/components/Loader.tsx
"use client";

export default function Loader() {
  return (
    <div className="w-full h-full flex items-center justify-center py-10">
      <div
        aria-hidden
        className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"
      />
      <span className="ml-3 text-sm text-gray-600">Loading...</span>
    </div>
  );
}
