import { PDFTemplateFiller } from "./pdfTemplateHelper";
import type { CodingReportData } from "@/types/trialReport";
import type { PDFPage } from "pdf-lib";

/**
 * Coding PDF Filler - Fill template với tọa độ chính xác
 * Template có 3 pages
 */
export class CodingPDFFiller extends PDFTemplateFiller {
  async fillCodingReport(data: CodingReportData): Promise<Uint8Array> {
    await this.loadTemplate("/templates/coding_trial.pdf");

    const pages = this.pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages[1];
    const page3 = pages[2];

    this.fillHeader(page1, data);
    const totalScore = this.fillCriteria(page1, page2, data);
    this.fillGrandTotal(page2, totalScore);
    this.fillComments(page3, data);

    return await this.save();
  }

  private fillHeader(page: PDFPage, data: CodingReportData): void {
    const fontSize = 11;
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    page.drawText(data.studentName || "", { x: 210, y: toY(140), size: fontSize, font: this.font });

    if (data.age_grade) {
      page.drawText(String(data.age_grade), { x: 210, y: toY(157), size: fontSize, font: this.font });
    }

    page.drawText(data.teacher || "", { x: 210, y: toY(172), size: fontSize, font: this.font });
    page.drawText(data.subject || "Coding", { x: 210, y: toY(188), size: fontSize, font: this.font });
    page.drawText(data.date || "", { x: 210, y: toY(203), size: fontSize, font: this.font });
  }

  private fillCriteria(page1: PDFPage, page2: PDFPage, data: CodingReportData): number {
    let totalScore = 0;
    const pageHeight1 = page1.getHeight();
    const pageHeight2 = page2.getHeight();
    const toY1 = (userY: number) => pageHeight1 - userY;
    const toY2 = (userY: number) => pageHeight2 - userY;

    // Group I
    const group1YPositions = [311, 328, 343, 362].map(toY1);
    const group1Data = data.computationalThinking;
    if (group1Data) {
      const keys = ["understand_digital_products", "explain_knowledge", "apply_knowledge", "develop_features"];
      keys.forEach((key, index) => {
        const score = group1Data[key] || 0;
        totalScore += score;
        this.drawCriterionRow(page1, 400, 500, group1YPositions[index], score);
      });
    }

    // Group II
    const group2YPositions = [411, 428, 443, 462].map(toY1);
    const group2Data = data.creativity;
    if (group2Data) {
      const keys = ["follow_instructions", "suggest_ideas", "create_features", "build_new_projects"];
      keys.forEach((key, index) => {
        const score = group2Data[key] || 0;
        totalScore += score;
        this.drawCriterionRow(page1, 400, 500, group2YPositions[index], score);
      });
    }

    // Group III
    const group3YPositions = [503, 520, 543, 568].map(toY1);
    const group3Data = data.communication;
    if (group3Data) {
      const keys = ["interact_with_teacher", "share_problems", "propose_ideas", "present_product"];
      keys.forEach((key, index) => {
        const score = group3Data[key] || 0;
        totalScore += score;
        this.drawCriterionRow(page1, 400, 500, group3YPositions[index], score);
      });
    }

    // Group IV
    const group4YPositions = [611, 628, 643, 662].map(toY1);
    const group4Data = data.problemSolving;
    if (group4Data) {
      const keys = ["aware_of_problems", "find_problems", "suggest_solutions", "solve_problems"];
      keys.forEach((key, index) => {
        const score = group4Data[key] || 0;
        totalScore += score;
        this.drawCriterionRow(page1, 400, 500, group4YPositions[index], score);
      });
    }

    // Group V
    const group5Data = data.computerSkills;
    if (group5Data) {
      const keys = ["use_mouse_keyboard", "know_programming_app", "use_programming_app", "use_internet"];
      const score1 = group5Data[keys[0]] || 0;
      totalScore += score1;
      this.drawCriterionRow(page1, 400, 500, toY1(702), score1);

      const page2YPositions = [98, 115, 138].map(toY2);
      [keys[1], keys[2], keys[3]].forEach((key, index) => {
        const score = group5Data[key] || 0;
        totalScore += score;
        this.drawCriterionRow(page2, 400, 500, page2YPositions[index], score);
      });
    }

    return totalScore;
  }

  private drawCriterionRow(page: PDFPage, assessmentX: number, scoreX: number, y: number, score: number): void {
    const fontSize = 10;
    const assessmentText = score >= 0.125 ? "Đạt" : "Chưa đạt";
    page.drawText(assessmentText, { x: assessmentX, y, size: fontSize, font: this.font });
    const scoreText = typeof score === "number" && !Number.isNaN(score) ? score.toFixed(2) : "0.00";
    page.drawText(scoreText, { x: scoreX, y, size: fontSize, font: this.font });
  }

  private fillGrandTotal(page: PDFPage, totalScore: number): void {
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;
    page.drawText(totalScore.toFixed(1), { x: 115, y: toY(239), size: 12, font: this.font });
  }

  private fillComments(page: PDFPage, data: CodingReportData): void {
    const fontSize = 9;
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    if (data.teacherComment) {
      const maxWidth = 424;
      const lines = this.wrapText(data.teacherComment, maxWidth, fontSize);
      const maxLines = 10;
      const startY = 197;
      const lineSpacing = 25;

      lines.slice(0, maxLines).forEach((line, index) => {
        page.drawText(line, { x: 109, y: toY(startY + index * lineSpacing), size: fontSize, font: this.font });
      });
    }

    if (data.recommendation) {
      page.drawText(data.recommendation, { x: 245, y: toY(672), size: 9, font: this.font });
    }
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split(/\r?\n/);

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = this.font.widthOfTextAtSize(testLine, fontSize);

        if (width <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }

      if (currentLine) lines.push(currentLine);
    }

    return lines;
  }
}

export async function generateCodingPDF(data: CodingReportData): Promise<Blob> {
  const filler = new CodingPDFFiller();
  const pdfBytes = await filler.fillCodingReport(data);
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

export function generateCodingFilename(data: CodingReportData): string {
  const studentName = data.studentName?.replaceAll(/\s+/g, "_") || "Student";
  const subject = data.subject?.replaceAll(/\s+/g, "_") || "Coding";
  const date = data.date?.replaceAll("/", "-") || "NoDate";
  return `${subject}_${studentName}_${date}.pdf`;
}
