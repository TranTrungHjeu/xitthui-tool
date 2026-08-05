"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Copy } from "lucide-react";
import { buildInnerHtml } from "@/lib/zalo-format";

type Props = {
  open: boolean;
  onClose: () => void;
  comment: string;
  onCopy: () => void;
  isMobile: boolean;
};

export default function PreviewModal({
  open,
  onClose,
  comment,
  onCopy,
  isMobile,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          isMobile
            ? "w-[95vw] max-w-[95vw] border-brand-60/20"
            : "max-w-2xl border-brand-60/20"
        }
      >
        <DialogHeader className="border-b-2 border-brand-10/15 pb-3">
          <DialogTitle className="flex items-center gap-2 text-brand-60">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md mindx-badge-crimson">
              <Eye className="h-4 w-4" />
            </span>
            <span className="text-mindx-gradient">
              Xem trước định dạng Zalo
            </span>
          </DialogTitle>
          <DialogDescription className="hidden">
            Xem trước định dạng nhận xét trước khi copy
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Legend — dùng đúng 3 brand colors */}
          <div className="bg-brand-60-soft/60 border-2 border-brand-60/15 rounded-lg p-3">
            <h4 className="font-bold text-brand-60 mb-2 text-sm">
              Chú thích màu sắc Zalo:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-brand-10 rounded ring-1 ring-brand-10/40" />
                <span className="text-brand-60">
                  <span className="font-mono font-bold">**Text**</span> — Tiêu đề đỏ đậm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#1FA856] rounded ring-1 ring-[#1FA856]/40" />
                <span className="text-brand-60">
                  <span className="font-mono font-bold italic">*Text*</span> — Lưu ý xanh nghiêng
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-brand-30 rounded ring-1 ring-brand-30/60" />
                <span className="text-brand-60">
                  <span className="font-mono font-bold">&apos;Compass&apos;</span> — Vàng đậm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-brand-60 rounded ring-1 ring-brand-60/40" />
                <span className="text-brand-60">
                  <span className="font-mono font-bold">***Text***</span> — Tiêu đề lớn
                </span>
              </div>
            </div>
            <p className="text-[10px] text-brand-60/70 mt-2 italic">
              * Đây là màu sắc thật khi gửi qua Zalo, không phải theme UI.
            </p>
          </div>

          {/* Preview body — white surface (brand-60 dominant) */}
          <div className="bg-card border-2 border-brand-60/15 rounded-lg p-4 max-h-96 overflow-y-auto shadow-[inset_0_2px_8px_-2px_rgba(0,0,86,0.06)]">
            <div
              className="space-y-2 text-sm text-brand-60"
              dangerouslySetInnerHTML={{ __html: buildInnerHtml(comment) }}
            />
          </div>
        </div>

        <DialogFooter className="border-t-2 border-brand-10/10 pt-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-brand-60/40 text-brand-60 hover:bg-brand-60 hover:text-white"
          >
            Đóng
          </Button>
          <Button
            onClick={onCopy}
            className="bg-brand-10 hover:bg-brand-10/90 text-white shadow-[0_2px_8px_-2px_rgba(227,31,38,0.45)]"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy ngay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}