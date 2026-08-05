"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Copy, Download, Loader2 } from "lucide-react";
import { lessonService } from "@/services/lessonService";
import { toast } from "@/components/ui/toast";

interface QRCodeModalProps {
  open: boolean;
  lessonId: string | null;
  lessonTitle?: string;
  onClose: () => void;
}

const DEFAULT_URL = (id: string) =>
  typeof window !== "undefined"
    ? `${window.location.origin}/lesson/${id}`
    : `https://example.com/lesson/${id}`;

export function QRCodeModal({ open, lessonId, lessonTitle, onClose }: QRCodeModalProps) {
  const [url, setUrl] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !lessonId) return;
    setUrl(DEFAULT_URL(lessonId));
    setQrUrl(null);
    handleGenerate(DEFAULT_URL(lessonId));
  }, [open, lessonId]);

  const handleGenerate = async (targetUrl: string) => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const res = await lessonService.generateQR(lessonId, targetUrl);
      if (res.success && res.data?.qrUrl) {
        setQrUrl(res.data.qrUrl);
      } else {
        toast.error("Không thể tạo QR code");
      }
    } catch (err: any) {
      toast.error("Lỗi tạo QR", {
        description: err.response?.data?.error || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã copy đường link");
    } catch {
      toast.error("Không thể copy");
    }
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${lessonId}-qr.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR Code bài học
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {lessonTitle && (
            <p className="text-sm font-medium">{lessonTitle}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="qr-url">Đường link</Label>
            <Input
              id="qr-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(url)}
              disabled={loading || !url.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Tạo QR
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!url}>
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          </div>
          {qrUrl && (
            <div className="flex flex-col items-center gap-3 p-3 rounded-md border border-border/60 bg-muted/30">
              <img
                src={qrUrl}
                alt="QR Code"
                width={240}
                height={240}
                className="bg-white rounded-md p-2"
              />
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Tải QR
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
