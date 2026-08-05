"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, X, Loader2, AlertCircle } from "lucide-react";
import { payrollService } from "@/services/payrollService";
import type { PayrollPreviewResponse } from "@/types/payroll";
import { toast } from "@/components/ui/toast";

interface UploadPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

type Phase = "idle" | "previewing" | "preview" | "uploading" | "done";

// The shape of res.data for the preview endpoint (envelope already
// unwrapped by payrollService.previewPeriod).
type PreviewData = PayrollPreviewResponse;

export function UploadPeriodDialog({
  open,
  onOpenChange,
  onUploaded,
}: UploadPeriodDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [overrideMonth, setOverrideMonth] = useState<string>("");
  const [overrideYear, setOverrideYear] = useState<string>("");
  const [overrideLabel, setOverrideLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPhase("idle");
    setPreview(null);
    setOverrideMonth("");
    setOverrideYear("");
    setOverrideLabel("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) {
      toast.error("Chỉ chấp nhận file .xlsx hoặc .xls");
      return;
    }
    setFile(f);
  }, []);

  async function runPreview() {
    if (!file) return;
    setError(null);
    setPhase("previewing");
    try {
      const res = await payrollService.previewPeriod(file, {});
      if (res.success && res.data) {
        setPreview(res.data);
        setPhase("preview");
        // Pre-fill override fields from inferred metadata so TE can
        // adjust if filename heuristic guessed wrong.
        setOverrideMonth(String(res.data.periodMeta.month ?? ""));
        setOverrideYear(String(res.data.periodMeta.year ?? ""));
        setOverrideLabel(res.data.periodMeta.label ?? "");
      } else {
        setError(res.error ?? "Không thể preview file");
        setPhase("idle");
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setPhase("idle");
    }
  }

  async function runUpload() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      const extra: { month?: number; year?: number; label?: string } = {};
      const m = Number(overrideMonth);
      const y = Number(overrideYear);
      if (Number.isFinite(m) && m >= 1 && m <= 12) extra.month = m;
      if (Number.isFinite(y) && y > 2000) extra.year = y;
      if (overrideLabel.trim()) extra.label = overrideLabel.trim();

      const res = await payrollService.uploadPeriod(file, extra);
      if (res.success && res.data) {
        toast.success(`Đã upload kỳ công — ${res.data.recordCount} dòng`);
        setPhase("done");
        onUploaded();
        close();
      } else {
        setError(res.error ?? "Upload thất bại");
        setPhase("preview");
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setPhase("preview");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload kỳ công mới
          </DialogTitle>
          <DialogDescription>
            File Excel (.xlsx) với 22 cột theo template MindX (CÔNG GV). Dữ liệu
            sẽ được lưu vào MongoDB và có thể tra cứu công khai.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:bg-muted/50"
            }`}
          >
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Kéo thả file Excel vào đây, hoặc click để chọn
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            {file && (
              <Badge variant="soft" className="mt-2">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {file.name} ({Math.round(file.size / 1024)} KB)
              </Badge>
            )}
          </div>
        )}

        {(phase === "previewing" || phase === "uploading") && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {phase === "previewing"
                ? "Đang parse file..."
                : "Đang upload và insert vào MongoDB..."}
            </p>
          </div>
        )}

        {phase === "preview" && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tháng</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={overrideMonth}
                  onChange={(e) => setOverrideMonth(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Năm</Label>
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={overrideYear}
                  onChange={(e) => setOverrideYear(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label</Label>
                <Input
                  value={overrideLabel}
                  onChange={(e) => setOverrideLabel(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-muted-foreground">Số dòng dữ liệu</p>
                <p className="text-base font-semibold">
                  {preview.totalRecords.toLocaleString("vi-VN")}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-muted-foreground">Cảnh báo</p>
                <p className="text-base font-semibold">
                  {preview.warnings.length}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-muted-foreground">File gốc</p>
                <p className="text-xs font-mono truncate">
                  {preview.periodMeta.originalFileName}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Preview 20 dòng đầu:
              </p>
              <div className="rounded-md border overflow-auto max-h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Giáo viên</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Vai trò</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Giờ</TableHead>
                      <TableHead>Trung tâm</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((p: PreviewData["preview"][number]) => (
                      <TableRow key={p.idx}>
                        <TableCell className="text-xs">{p.idx + 1}</TableCell>
                        <TableCell className="text-xs">
                          {p.teacherName}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {p.className === "undefined" ? "—" : p.className}
                        </TableCell>
                        <TableCell className="text-xs">{p.classRole}</TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={
                              p.type === "OFFICE_HOURS" ? "info" : "outline"
                            }
                          >
                            {p.type === "OFFICE_HOURS" ? "OH" : "Lớp"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={
                              p.status === "CHECKED" ? "success" : "warning"
                            }
                          >
                            {p.status === "CHECKED" ? "Đã check" : "Chưa check"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {p.effectiveDuration}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {p.centreShortname}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 space-y-1">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {preview.warnings.length} cảnh báo khi parse
                </p>
                <div className="max-h-32 overflow-auto text-xs">
                  {preview.warnings
                    .slice(0, 20)
                    .map((w: PreviewData["warnings"][number], i: number) => (
                      <div
                        key={i}
                        className="text-amber-700 dark:text-amber-300"
                      >
                        Row {w.row}: {w.reason}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
            <div className="text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === "idle" && file && (
            <>
              <Button variant="outline" onClick={close}>
                <X className="h-4 w-4" />
                Hủy
              </Button>
              <Button onClick={runPreview}>
                <Upload className="h-4 w-4" />
                Preview &amp; xác nhận
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="outline" onClick={close}>
                Hủy
              </Button>
              <Button onClick={runUpload}>
                <Upload className="h-4 w-4" />
                Xác nhận upload {preview?.totalRecords.toLocaleString("vi-VN")} dòng
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}