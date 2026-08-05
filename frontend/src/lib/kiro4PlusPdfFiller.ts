import { PDFTemplateFiller } from "./pdfTemplateHelper";
import type { Kiro4PlusReportData, Kiro4PlusScore } from "@/types/trialReport";
import type { PDFPage } from "pdf-lib";

/**
 * Kiro 4+ PDF Filler
 * Template: /templates/kiro_trial.pdf (5 pages)
 */
export class Kiro4PlusPDFFiller extends PDFTemplateFiller {
  async fillKiro4PlusReport(data: Kiro4PlusReportData): Promise<Uint8Array> {
    await this.loadTemplate("/templates/kiro_trial.pdf");

    const pages = this.pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages[1];
    const page3 = pages[2];
    const page4 = pages[3];
    const page5 = pages[4];

    this.fillHeader(page1, data);
    this.fillCapabilitiesPage2(page2, data);
    this.fillCapabilitiesPage3(page3, data);
    this.fillCapabilitiesPage4(page4, data);
    this.fillSummary(page5, data);

    return await this.save();
  }

  private fillHeader(page: PDFPage, data: Kiro4PlusReportData): void {
    const fontSize = 10;
    const h = page.getHeight();
    const y = (v: number) => h - v;

    page.drawText(data.studentName || "", { x: 178, y: y(188), size: fontSize, font: this.font });

    if (data.age_grade) {
      page.drawText(String(data.age_grade), { x: 373, y: y(188), size: fontSize, font: this.font });
    }

    page.drawText(data.subject || "Kiro 4+", { x: 165, y: y(218), size: fontSize, font: this.font });

    if (data.date) {
      const [dd, mm, yyyy] = data.date.split("/");
      if (dd && mm && yyyy) {
        const dateFontSize = 8;
        const drawRightAligned = (text: string, rightEdge: number) => {
          const width = this.font.widthOfTextAtSize(text, dateFontSize);
          page.drawText(text, {
            x: rightEdge - width,
            y: y(218),
            size: dateFontSize,
            font: this.font,
          });
        };

        drawRightAligned(dd, 423.07);
        drawRightAligned(mm, 436.15);
        drawRightAligned(yyyy, 455.657);
      }
    }

    page.drawText(data.teacher || "", { x: 186, y: y(251), size: fontSize, font: this.font });

    if (data.campus) {
      page.drawText(data.campus, { x: 114, y: y(280), size: fontSize, font: this.font });
    }

    if (data.city) {
      page.drawText(data.city, { x: 410, y: y(280), size: fontSize, font: this.font });
    }
  }

  private fillCapabilitiesPage2(page: PDFPage, data: Kiro4PlusReportData): void {
    const h = page.getHeight();
    const y = (v: number) => h - v;

    if (data.recognition?.score) {
      const level = data.recognition.score;
      const yMap: Record<number, number> = { 1: 216, 2: 286, 3: 338 };
      if (level in yMap) this.mark(page, 481, y(yMap[level]));
    }

    if (data.assembly?.score) {
      const level = data.assembly.score;
      const yMap: Record<number, number> = { 1: 555, 2: 617, 3: 678 };
      if (level in yMap) this.mark(page, 481, y(yMap[level]));
    }
  }

  private fillCapabilitiesPage3(page: PDFPage, data: Kiro4PlusReportData): void {
    const h = page.getHeight();
    const y = (v: number) => h - v;

    if (data.recognition?.score) {
      const level = data.recognition.score;
      const yMap: Record<number, number> = { 4: 380, 5: 431 };
      if (level in yMap) this.mark(page, 481, y(yMap[level]));
    }

    if (data.assembly?.score) {
      const level = data.assembly.score;
      const yMap: Record<number, number> = { 4: 150, 5: 238 };
      if (level in yMap) this.mark(page, 481, y(yMap[level]));
    }

    if (data.programming?.score) {
      const level = data.programming.score;
      const yMap: Record<number, number> = { 1: 372, 2: 418, 3: 474, 4: 525, 5: 577 };
      if (level in yMap) this.mark(page, 481, y(yMap[level]));
    }

    if (data.communication?.score) {
      const level = data.communication.score;
      const yMap: Record<number, number> = { 1: 691, 2: 734 };
      if (level in yMap) this.mark(page, 481, y(yMap[level]));
    }
  }

  private fillCapabilitiesPage4(page: PDFPage, data: Kiro4PlusReportData): void {
    const h = page.getHeight();
    const y = (v: number) => h - v;

    if (!data.communication?.score) return;
    const level = data.communication.score;
    const yMap: Record<number, number> = { 3: 138, 4: 179, 5: 221 };
    if (level in yMap) this.mark(page, 481, y(yMap[level]));
  }

  private fillSummary(page: PDFPage, data: Kiro4PlusReportData): void {
    const fontSize = 9;
    const h = page.getHeight();
    const y = (v: number) => h - v;

    const avg = this.calculateAverage(data);
    page.drawText(avg.toFixed(2), { x: 421, y: y(397), size: 11, font: this.font });

    if (data.teacherComment) {
      const maxWidth = 460;
      const lineSpacing = 20;
      const startY = 440;
      const maxLines = 4;

      const lines = this.wrapText(data.teacherComment, maxWidth, fontSize);
      lines.slice(0, maxLines).forEach((line, i) => {
        page.drawText(line, { x: 72, y: y(startY + i * lineSpacing), size: fontSize, font: this.font });
      });
    }

    if (data.recommendation) {
      page.drawText(data.recommendation, { x: 127, y: y(545), size: fontSize, font: this.font });
    }
  }

  private mark(page: PDFPage, x: number, y: number): void {
    page.drawText("X", { x, y, size: 9, font: this.font });
  }

  private calculateAverage(data: Kiro4PlusReportData): number {
    const scores = [
      data.recognition?.score,
      data.assembly?.score,
      data.programming?.score,
      data.communication?.score,
    ].filter((s): s is Kiro4PlusScore => s !== undefined);

    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
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

export async function generateKiro4PlusPDF(data: Kiro4PlusReportData): Promise<Blob> {
  const filler = new Kiro4PlusPDFFiller();
  const pdfBytes = await filler.fillKiro4PlusReport(data);
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

export function generateKiro4PlusFilename(data: Kiro4PlusReportData): string {
  const studentName = data.studentName?.replaceAll(/\s+/g, "_") || "Student";
  const subject = data.subject?.replaceAll(/\s+/g, "_") || "Kiro4Plus";
  const date = data.date?.replaceAll("/", "-") || "NoDate";
  return `${subject}_${studentName}_${date}.pdf`;
}
