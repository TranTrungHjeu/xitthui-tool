"use client";

import { use, Suspense } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { PUBLIC_TOOLS } from "@/lib/access";

function ToolLoadingState() {
  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

const ZaloTool = dynamic(
  () => import("@/app/zalo/page").then((m) => m.default),
  { ssr: false, loading: () => <ToolLoadingState /> },
);
const LmsTool = dynamic(
  () => import("@/app/lms/page").then((m) => m.default),
  { ssr: false, loading: () => <ToolLoadingState /> },
);
const TrialReportTool = dynamic(
  () => import("@/app/trial-report/page").then((m) => m.default),
  { ssr: false, loading: () => <ToolLoadingState /> },
);
const LessonTool = dynamic(
  () => import("@/app/lesson/page").then((m) => m.default),
  { ssr: false, loading: () => <ToolLoadingState /> },
);
const PayrollTool = dynamic(
  () => import("@/app/payroll/page").then((m) => m.default),
  { ssr: false, loading: () => <ToolLoadingState /> },
);

const PUBLIC_TOOL_RENDERERS: Record<string, React.ComponentType> = {
  "trial-report": TrialReportTool,
  zalo: ZaloTool,
  lms: LmsTool,
  lesson: LessonTool,
  payroll: PayrollTool,
};

function ToolPageInner({ keyName }: { keyName: string }) {
  const tool = PUBLIC_TOOLS.find((t) => t.key === keyName);
  if (!tool) notFound();

  const ToolComponent = PUBLIC_TOOL_RENDERERS[keyName];
  return <ToolComponent />;
}

export default function ToolPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  return (
    <Suspense fallback={<ToolLoadingState />}>
      <ToolPageInner keyName={key} />
    </Suspense>
  );
}