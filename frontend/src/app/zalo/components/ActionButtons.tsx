"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Eye } from "lucide-react";

type Props = {
  isMobile: boolean;
  commentEmpty: boolean;
  onCopy: () => void;
  onClear: () => void;
  onPreview: () => void;
};

export default function ActionButtons({
  isMobile,
  commentEmpty,
  onCopy,
  onClear,
  onPreview,
}: Props) {
  const [copyState, setCopyState] = useState<"idle" | "success">("idle");

  // Auto-reset success state sau 2 giây để button quay về trạng thái bình thường
  useEffect(() => {
    if (copyState !== "success") return;
    const t = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(t);
  }, [copyState]);

  const handleCopyClick = () => {
    onCopy();
    setCopyState("success");
  };

  return (
    <div className="space-y-4 pt-2 border-t-2 border-brand-10/10">
      <div
        className={`flex ${
          isMobile ? "flex-col space-y-3" : "justify-between items-center"
        }`}
      >
        <div className={`flex ${isMobile ? "flex-col space-y-3" : "gap-3"}`}>
          {/* CTA chính — Alizarin Crimson (brand 10%) */}
          <Button
            onClick={handleCopyClick}
            disabled={commentEmpty}
            size={isMobile ? "lg" : "default"}
            aria-label={
              copyState === "success" ? "Đã copy" : "Copy nhận xét"
            }
            className={
              isMobile
                ? "w-full transition-all duration-300 bg-brand-10 hover:bg-brand-10/90 text-white shadow-[0_2px_8px_-2px_rgba(227,31,38,0.45)]"
                : "min-w-[140px] transition-all duration-300 bg-brand-10 hover:bg-brand-10/90 text-white shadow-[0_2px_8px_-2px_rgba(227,31,38,0.45)]"
            }
            data-copy-state={copyState}
          >
            {copyState === "success" ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copyState === "success"
              ? isMobile
                ? "Đã copy"
                : "Đã copy thành công"
              : isMobile
                ? "Copy nhận xét"
                : "Copy với định dạng"}
          </Button>

          {/* Destructive — cùng brand-10 */}
          <Button
            variant="destructive"
            onClick={onClear}
            disabled={commentEmpty}
            size={isMobile ? "lg" : "default"}
            className={isMobile ? "w-full" : "min-w-[120px]"}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isMobile ? "Xóa nội dung" : "Xóa tất cả"}
          </Button>
        </div>

        {/* Preview — Stratos Navy (brand 60%) */}
        {!commentEmpty && (
          <Button
            variant="outline"
            onClick={onPreview}
            size={isMobile ? "lg" : "default"}
            className={
              isMobile
                ? "w-full border-brand-60/40 text-brand-60 hover:bg-brand-60 hover:text-white dark:text-indigo-300 dark:border-indigo-300/40 dark:hover:bg-indigo-300/10 dark:hover:text-indigo-300"
                : "min-w-[140px] border-brand-60/40 text-brand-60 hover:bg-brand-60 hover:text-white dark:text-indigo-300 dark:border-indigo-300/40 dark:hover:bg-indigo-300/10 dark:hover:text-indigo-300"
            }
          >
            <Eye className="h-4 w-4 mr-2" />
            {isMobile ? "Xem trước định dạng" : "Xem trước"}
          </Button>
        )}
      </div>
    </div>
  );
}
