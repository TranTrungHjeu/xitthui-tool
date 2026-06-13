"use client";

import { useState } from "react";
import { TableProperties, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/button";

export default function SpreadsheetPage() {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleResetZoom = () => setZoom(100);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen p-6 md:p-8 space-y-4 bg-[#f8fafc]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TableProperties className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Book Trial</h1>
            <p className="text-sm text-slate-500">Xem trực tiếp bảng tính (chỉ đọc)</p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
          <span className="text-xs font-mono px-2 text-slate-500">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md"
            onClick={handleZoomOut}
            title="Thu nhỏ"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md"
            onClick={handleResetZoom}
            title="Đặt lại zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md"
            onClick={handleZoomIn}
            title="Phóng to"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
        <iframe
          src="https://docs.google.com/spreadsheets/d/127e4Xljxfbar_GSpWeV4K_ntgYXEGTIHOKKOx8UNymM/htmlview?gid=1467386010#gid=761678822"
          className="absolute inset-0 w-full h-full border-0 origin-top-left transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100})`,
            width: `${100 * (100 / zoom)}%`,
            height: `${100 * (100 / zoom)}%`,
          }}
          title="Google Sheet Embed"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
