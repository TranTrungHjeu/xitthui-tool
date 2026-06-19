"use client";

import { useState, useEffect } from "react";
import { TableProperties, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import CatLoader from "../../../components/CatLoader";
import api from "../../../services/api";
import { useMinLoading } from "@/hooks/useMinLoading";

interface SheetData {
  headers: string[];
  data: Record<string, string>[];
  sheetName: string;
  availableSheets?: string[];
}

export default function SpreadsheetPage() {
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showLoading = useMinLoading(isLoading, 1000);

  const fetchSheetData = async (sheetName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = sheetName
        ? `/spreadsheet/data?range=${encodeURIComponent(sheetName)}`
        : "/spreadsheet/data";
      const response = await api.get(url);
      if (response.data.success) {
        setSheetData(response.data);
      } else {
        throw new Error(response.data.error || "Không thể tải dữ liệu.");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Lỗi kết nối máy chủ.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetData(activeSheet || undefined);
  }, [activeSheet]);

  // Các cột muốn ẩn khỏi giao diện (kiểm tra bằng contains string)
  const HIDDEN_COLUMNS = [
    "Link phòng",
    "Column_12",
    "Tình trạng FILL",
    "FILL sheet",
    "Hủy",
    "Approved",
  ];
  const visibleHeaders =
    sheetData?.headers
      ?.slice(1) // Bỏ cột đầu tiên
      .filter(
        (header) => !HIDDEN_COLUMNS.some((hidden) => header.includes(hidden)),
      ) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen p-6 md:p-8 space-y-4 bg-[#f8fafc]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TableProperties className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Book Trial{" "}
              {sheetData?.sheetName ? `- ${sheetData.sheetName}` : ""}
            </h1>
            <p className="text-sm text-slate-500">
              Dữ liệu được đồng bộ từ Google Sheets qua API
            </p>
          </div>
        </div>

        <Button
          onClick={() => fetchSheetData(activeSheet || undefined)}
          disabled={isLoading}
          variant="outline"
          className="gap-2 bg-white"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {error && (
        <div className="p-4 text-sm text-white bg-destructive rounded-lg shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 border border-[#cbd5e1] bg-white shadow-sm overflow-hidden relative flex flex-col">
        {showLoading && !sheetData ? (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center min-h-[60vh]">
            <CatLoader />
          </div>
        ) : (
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full border-collapse text-[13px] table-fixed">
              <thead className="sticky top-0 z-40 bg-slate-200 shadow-[0_1px_0_#cbd5e1]">
                <tr>
                  {/* Row index header - Sticky left */}
                  <th className="border-r border-b border-[#cbd5e1] bg-slate-200 w-12 text-center text-slate-600 font-bold py-2 px-2 sticky left-0 z-50">
                    #
                  </th>
                  {visibleHeaders.map((header, idx) => {
                    const headerColors = [
                      "bg-blue-100",
                      "bg-indigo-100",
                      "bg-purple-100",
                      "bg-fuchsia-100",
                      "bg-pink-100",
                      "bg-rose-100",
                      "bg-orange-100",
                      "bg-amber-100",
                      "bg-yellow-100",
                      "bg-lime-100",
                      "bg-green-100",
                      "bg-emerald-100",
                      "bg-teal-100",
                      "bg-cyan-100",
                      "bg-sky-100",
                    ];
                    const colorClass = headerColors[idx % headerColors.length];
                    return (
                      <th
                        key={idx}
                        className={`border-r border-b border-[#cbd5e1] text-slate-800 font-bold py-2 px-3 ${colorClass}`}
                      >
                        {header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white">
                {sheetData?.data?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleHeaders.length + 1}
                      className="text-center py-12 text-slate-500 border-b border-[#cbd5e1]"
                    >
                      Không có dữ liệu trong bảng tính này.
                    </td>
                  </tr>
                ) : (
                  sheetData?.data
                    ?.filter((row) =>
                      visibleHeaders.some(
                        (h) => row[h] && row[h].trim() !== "",
                      ),
                    )
                    .map((row, rowIdx) => {
                      // Nhận diện dòng ngày (ví dụ: cột đầu tiên có dữ liệu, nhưng Ca trực và Bộ môn rỗng)
                      const firstColData = row[visibleHeaders[0]] || "";
                      const secondColData = row[visibleHeaders[1]] || "";
                      const thirdColData = row[visibleHeaders[2]] || "";
                      const isDayRow =
                        (/\d{1,2}\/\d{1,2}/.test(firstColData) ||
                          firstColData.trim().length > 0) &&
                        secondColData.trim() === "" &&
                        thirdColData.trim() === "";

                      return (
                        <tr
                          key={rowIdx}
                          className={`transition-colors ${
                            isDayRow
                              ? "bg-blue-100/50" // Dòng ngày có màu nền khác biệt
                              : rowIdx % 2 === 0
                                ? "bg-white hover:bg-slate-200/50"
                                : "bg-slate-50 hover:bg-slate-200/50"
                          }`}
                        >
                          {/* Row index cell - Sticky left */}
                          <td
                            className={`border-r border-b border-[#cbd5e1] text-center font-bold py-1.5 px-2 sticky left-0 z-30 ${
                              isDayRow
                                ? "bg-blue-200 text-blue-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {rowIdx + 1}
                          </td>
                          {visibleHeaders.map((header, colIdx) => {
                            const cellData = row[header] || "";
                            // Column background color mapping
                            const cellColors = [
                              "bg-blue-50/50",
                              "bg-indigo-50/50",
                              "bg-purple-50/50",
                              "bg-fuchsia-50/50",
                              "bg-pink-50/50",
                              "bg-rose-50/50",
                              "bg-orange-50/50",
                              "bg-amber-50/50",
                              "bg-yellow-50/50",
                              "bg-lime-50/50",
                              "bg-green-50/50",
                              "bg-emerald-50/50",
                              "bg-teal-50/50",
                              "bg-cyan-50/50",
                              "bg-sky-50/50",
                            ];
                            const bgColorClass =
                              cellColors[colIdx % cellColors.length];

                            let displayData = cellData;
                            let cellClass = `border-r border-b border-[#cbd5e1] py-1.5 px-3 text-slate-900 font-medium break-words ${
                              isDayRow ? "" : bgColorClass
                            }`;

                            // Check if this cell is exactly a date format (like "19/06/26" or "19/06")
                            const isDateCell =
                              /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(
                                cellData.trim(),
                              );

                            if (isDayRow || isDateCell) {
                              cellClass +=
                                " font-extrabold text-[15px] text-blue-900 bg-blue-100/60";
                            } else if (
                              cellData === "TRUE" ||
                              cellData === "TRUE " ||
                              cellData === "true"
                            ) {
                              displayData = "✓";
                              cellClass = `border-r border-b border-[#cbd5e1] py-1.5 px-3 text-emerald-600 font-bold text-center bg-emerald-100/60`;
                            } else if (
                              cellData === "FALSE" ||
                              cellData === "FALSE " ||
                              cellData === "false"
                            ) {
                              displayData = "✗";
                              cellClass = `border-r border-b border-[#cbd5e1] py-1.5 px-3 text-rose-500 font-bold text-center bg-rose-100/60`;
                            }

                            return (
                              <td
                                key={colIdx}
                                className={cellClass}
                                title={cellData}
                              >
                                {displayData}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
