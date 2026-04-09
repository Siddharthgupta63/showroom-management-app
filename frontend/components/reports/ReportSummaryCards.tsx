"use client";

type Card = {
  label: string;
  value: string | number;
};

export default function ReportSummaryCards({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border bg-white p-4 shadow-sm"
        >
          <div className="text-sm text-gray-500">{card.label}</div>
          <div className="mt-2 text-xl font-bold">{card.value}</div>
        </div>
      ))}
    </div>
  );
}