import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register fonts to support Vietnamese characters
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: "bold",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Roboto",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#111827",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1e293b",
    borderBottomStyle: "solid",
    paddingBottom: 15,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    textTransform: "uppercase",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  infoLabel: {
    width: "25%",
    fontWeight: "bold",
    textAlign: "right",
    paddingRight: 10,
  },
  infoValue: {
    width: "25%",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
    borderBottomStyle: "solid",
    paddingBottom: 4,
    marginBottom: 10,
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: "#cbd5e1",
    marginBottom: 20,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row",
  },
  tableHeader: {
    backgroundColor: "#f1f5f9",
    fontWeight: "bold",
  },
  tableCol1: {
    width: "20%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#cbd5e1",
  },
  tableCol2: {
    width: "10%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#cbd5e1",
  },
  tableCol3: {
    width: "15%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#cbd5e1",
  },
  tableCol4: {
    width: "55%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: "#cbd5e1",
  },
  tableCell: {
    margin: 5,
    fontSize: 10,
  },
  tableCellBold: {
    margin: 5,
    fontSize: 10,
    fontWeight: "bold",
  },
  tableCellCenter: {
    margin: 5,
    fontSize: 10,
    textAlign: "center",
  },
  tableCellCenterBold: {
    margin: 5,
    fontSize: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  trendProgress: {
    color: "#16a34a",
  },
  trendDecline: {
    color: "#dc2626",
  },
  trendStable: {
    color: "#64748b",
  },
  overallText: {
    textAlign: "justify",
    marginBottom: 10,
  },
  suggestionItem: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bulletPoint: {
    width: 15,
    textAlign: "center",
  },
  suggestionText: {
    flex: 1,
    textAlign: "justify",
  },
});

interface AIReportPDFProps {
  selectedStudent: any;
  classData: any;
  aiReport: any;
}

export const AIReportPDF = ({
  selectedStudent,
  classData,
  aiReport,
}: AIReportPDFProps) => {
  if (!aiReport) return null;

  const criteriaArray = Array.isArray(aiReport.criteria)
    ? aiReport.criteria
    : Object.entries(aiReport.criteria || {}).map(([k, v]: [string, any]) => ({
        ...v,
        label:
          v.label ||
          (k === "attitude"
            ? "Thái độ học tập"
            : k === "assembly"
              ? "Kỹ năng lắp ráp / Thiết bị"
              : k === "programming"
                ? "Tư duy lập trình"
                : k),
      }));

  const renderOverallProgress = () => {
    if (!aiReport.overall_progress) return null;

    const segments = String(aiReport.overall_progress)
      .split(/(?=\[(?:L|T|Đ)\])/g)
      .filter((s) => s.trim() !== "");

    return segments.map((segment, idx) => {
      const text = segment.trim();
      const match = text.match(/^\[(L|T|Đ)\]\s*([\s\S]*)$/);
      const label = match?.[1];
      const content = (match?.[2] || text).trim();

      const titleMap: Record<string, string> = {
        L: "Lý do / Tư duy hoặc kiến thức nền",
        T: "Thao tác / Lập trình",
        Đ: "Đề xuất / Phương án hỗ trợ",
      };

      return (
        <Text key={idx} style={styles.overallText}>
          {label ? (
            <>
              <Text style={{ fontWeight: "bold" }}>
                {titleMap[label] || `[${label}]`}:{" "}
              </Text>
              {content}
            </>
          ) : (
            content
          )}
        </Text>
      );
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC HỌC VIÊN</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Học viên:</Text>
            <Text style={styles.infoValue}>{selectedStudent?.fullName}</Text>
            <Text style={styles.infoLabel}>Ngày xuất báo cáo:</Text>
            <Text style={styles.infoValue}>
              {new Date().toLocaleDateString("vi-VN")}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lớp:</Text>
            <Text style={styles.infoValue}>{classData?.name}</Text>
            <Text style={styles.infoLabel}>Khóa học:</Text>
            <Text style={styles.infoValue}>{classData?.course?.name}</Text>
          </View>
        </View>

        {/* I. Tiêu chí đánh giá */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>I. Tiêu chí đánh giá</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={styles.tableCol1}>
                <Text style={styles.tableCellBold}>Tiêu chí</Text>
              </View>
              <View style={styles.tableCol2}>
                <Text style={styles.tableCellCenterBold}>Điểm</Text>
              </View>
              <View style={styles.tableCol3}>
                <Text style={styles.tableCellCenterBold}>Xu hướng</Text>
              </View>
              <View style={styles.tableCol4}>
                <Text style={styles.tableCellBold}>Nhận xét</Text>
              </View>
            </View>
            {/* Table Body */}
            {criteriaArray.map((item: any, index: number) => (
              <View style={styles.tableRow} key={index} wrap={false}>
                <View style={styles.tableCol1}>
                  <Text style={styles.tableCellBold}>{item.label}</Text>
                </View>
                <View style={styles.tableCol2}>
                  <Text style={styles.tableCellCenterBold}>
                    {item.score}/10
                  </Text>
                </View>
                <View style={styles.tableCol3}>
                  <Text
                    style={[
                      styles.tableCellCenterBold,
                      item.trend === "Tiến bộ"
                        ? styles.trendProgress
                        : item.trend === "Đi xuống"
                          ? styles.trendDecline
                          : styles.trendStable,
                    ]}
                  >
                    {item.trend}
                  </Text>
                </View>
                <View style={styles.tableCol4}>
                  <Text style={{ ...styles.tableCell, textAlign: "justify" }}>
                    {item.analysis}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* II. Đánh giá chung */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>II. Đánh giá chung</Text>
          {renderOverallProgress()}
        </View>

        {/* III. Đề xuất / Phương án hỗ trợ */}
        <View style={{ marginTop: 10 }} wrap={false}>
          <Text style={styles.sectionTitle}>
            III. Đề xuất / Phương án hỗ trợ
          </Text>
          {Array.isArray(aiReport.suggestions) &&
            aiReport.suggestions.map((suggestion: string, i: number) => (
              <View key={i} style={styles.suggestionItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            ))}
        </View>
      </Page>
    </Document>
  );
};

export default AIReportPDF;
