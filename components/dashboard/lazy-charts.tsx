"use client";

import dynamic from "next/dynamic";

// Recharts pesa y los tres gráficos viven bajo el pliegue. El import dinámico debe
// hacerse desde un componente cliente: si lo hiciera la página (Server Component),
// Next no divide el chunk (ver docs, "Lazy Loading" → Importing Client Components).
const skeleton = (height: number) => (
  <div className="animate-pulse rounded-lg bg-muted" style={{ height }} />
);

export const CategoryBars = dynamic(
  () => import("./category-bars").then((m) => m.CategoryBars),
  { loading: () => skeleton(160) },
);

export const PaymentSplit = dynamic(
  () => import("./payment-split").then((m) => m.PaymentSplit),
  { loading: () => skeleton(168) },
);

export const MonthlyTrend = dynamic(
  () => import("./monthly-trend").then((m) => m.MonthlyTrend),
  { loading: () => skeleton(168) },
);
