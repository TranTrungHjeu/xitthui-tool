"use client";

import {
  Drawer,
  DrawerContent,
  DrawerClose,
} from "@/components/ui/drawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Teacher } from "@/types";

interface FieldRowProps {
  label: string;
  value?: string | null;
  mono?: boolean;
}

function FieldRow({ label, value, mono }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </p>
      <p
        className={
          mono
            ? "font-mono text-xs bg-muted px-2 py-1 rounded break-all"
            : "text-sm break-words"
        }
      >
        {value || "—"}
      </p>
    </div>
  );
}

const formatGender = (gender?: string) => {
  if (!gender) return "—";
  const g = gender.toUpperCase();
  if (g === "MALE") return "Nam";
  if (g === "FEMALE") return "Nữ";
  return gender;
};

const getInitials = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

interface PersonnelDetailDrawerProps {
  teacher: Teacher | null;
  open: boolean;
  onClose: () => void;
}

export default function PersonnelDetailDrawer({
  teacher,
  open,
  onClose,
}: PersonnelDetailDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={(val) => !val && onClose()}>
      <DrawerContent
        side="right"
        width="min(560px, 100vw)"
        className="border-l border-border/80 bg-card"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-border bg-muted/20 shrink-0 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                {getInitials(teacher?.fullName || "")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                {teacher?.fullName || "Chi tiết nhân sự"}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {teacher?.code && (
                  <span className="font-mono">@{teacher.code}</span>
                )}
                {teacher?.code && teacher?.email && " · "}
                {teacher?.email}
              </p>
            </div>
          </div>
          <DrawerClose />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {teacher && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <FieldRow label="Họ và tên" value={teacher.fullName} />
              <FieldRow label="Mã nhân viên" value={teacher.code} mono />
              <FieldRow label="Username" value={teacher.username} />
              <FieldRow label="Giới tính" value={formatGender(teacher.gender)} />
              <FieldRow label="Điện thoại" value={teacher.phoneNumber} />
              <FieldRow label="Email công việc" value={teacher.email} />
              <FieldRow label="Email cá nhân" value={teacher.personalEmail} />

              <div className="md:col-span-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Môn học phụ trách
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.courses?.length ? (
                    teacher.courses.map((c) => (
                      <Badge key={c.id} variant="secondary">
                        {c.shortName || c.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Dòng khóa học
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.courseLines?.length ? (
                    teacher.courseLines.map((c) => (
                      <Badge key={c.id} variant="outline">
                        {c.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Cơ sở trực thuộc
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.centres?.length ? (
                    teacher.centres.map((c) => (
                      <Badge key={c.id}>{c.name}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Ghi chú
                </p>
                <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                  {teacher.notes || "—"}
                </div>
              </div>

              <div className="md:col-span-2 pt-2 border-t border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Thông tin hệ thống
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldRow label="User Reference ID" value={teacher.user} mono />
                  <FieldRow
                    label="Firebase ID"
                    value={teacher.firebaseId}
                    mono
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
