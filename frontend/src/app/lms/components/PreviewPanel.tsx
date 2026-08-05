"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export interface PreviewPanelProps {
  preview: string;
  onChange: (value: string) => void;
  textareaRef?: import("react").RefObject<HTMLTextAreaElement | null>;
}

export function PreviewPanel({ preview, onChange, textareaRef }: PreviewPanelProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (textareaRef?.current) {
      textareaRef.current.value = preview;
    } else if (internalRef.current) {
      internalRef.current.value = preview;
    }
  }, [preview, textareaRef]);

  const handleCopy = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Nội dung nhận xét:</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {preview.length > 0 ? `${preview.length}/10000 ký tự` : "0/10000 ký tự"}
          </span>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!preview} className="h-7 px-2">
            <Copy className="h-3.5 w-3.5" />
            <span className="ml-1 text-xs">{copied ? "Đã copy!" : "Copy"}</span>
          </Button>
        </div>
      </div>
      <Textarea
        ref={textareaRef || internalRef}
        value={preview}
        onChange={(e) => onChange(e.target.value)}
        maxLength={10000}
        placeholder="Nhận xét sẽ xuất hiện ở đây..."
        className="flex-1 min-h-[280px] resize-none font-sys leading-relaxed"
        style={{ lineHeight: 1.5 }}
      />
    </div>
  );
}

export default PreviewPanel;
