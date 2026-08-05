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
import { Info } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
};

export default function InstructionModal({ open, onClose, isMobile }: Props) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          isMobile
            ? "w-[95vw] max-w-[95vw] border-brand-60/20"
            : "max-w-lg border-brand-60/20"
        }
      >
        <DialogHeader className="border-b-2 border-brand-60/10 pb-3">
          <DialogTitle className="flex items-center gap-2 text-brand-60">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md mindx-badge-stratos">
              <Info className="h-4 w-4" />
            </span>
            Hướng dẫn định dạng
          </DialogTitle>
          <DialogDescription className="hidden">
            Hướng dẫn cách định dạng nhận xét cho Zalo
          </DialogDescription>
        </DialogHeader>

        {/* Brand 60 dominant surface */}
        <div className="bg-brand-60-soft/70 border-2 border-brand-60/15 rounded-lg p-4">
          <div className="text-sm text-brand-60 space-y-2.5 leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="inline-block mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-10 shrink-0" />
              <span>
                <strong className="font-bold">**Text**</strong> — Chữ đỏ đậm
                <span className="text-brand-10 font-bold"> (tiêu đề)</span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-block mt-1.5 w-1.5 h-1.5 rounded-full bg-[#1FA856] shrink-0" />
              <span>
                <strong className="font-bold italic">*Text*</strong> — Chữ xanh nghiêng
                <span className="text-[#1FA856] font-semibold"> (lưu ý)</span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-block mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-30 shrink-0" />
              <span>
                <strong className="font-bold mindx-badge-sunglow px-1.5 py-0.5 rounded">
                  &apos;Học bạ trực tuyến - Compass&apos;
                </strong>
                <span className="text-brand-30 font-semibold"> — Chữ vàng đậm</span>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-block mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-60 shrink-0" />
              <span>
                Text thường — Chữ <span className="font-semibold">đen</span> bình thường
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t-2 border-brand-10/10 pt-3">
          <Button
            onClick={onClose}
            className="bg-brand-10 hover:bg-brand-10/90 text-white shadow-[0_2px_8px_-2px_rgba(227,31,38,0.45)]"
          >
            Đã hiểu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
