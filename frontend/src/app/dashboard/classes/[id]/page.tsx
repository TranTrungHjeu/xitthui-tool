"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import ClassDetailDrawer from "@/components/ClassDetailDrawer";

export default function ClassDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  return (
    <div className="min-h-[80vh] p-6 flex items-center justify-center">
      <ClassDetailDrawer
        classId={id}
        open={true}
        onClose={() => router.push("/dashboard/classes")}
      />
    </div>
  );
}
