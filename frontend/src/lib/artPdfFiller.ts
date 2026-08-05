import { PDFPage, rgb } from "pdf-lib";
import { PDFTemplateFiller } from "./pdfTemplateHelper";
import type { ArtReportData } from "@/types/trialReport";

/**
 * Art PDF Filler - Fill art_trial.pdf template
 */
export class ArtPDFFiller extends PDFTemplateFiller {
  async fillArtReport(data: ArtReportData): Promise<Uint8Array> {
    const templatePath = "/templates/art_trial.pdf";
    await this.loadTemplate(templatePath);

    const pages = this.pdfDoc.getPages();
    const page = pages[0];

    this.fillHeader(page, data);
    this.fillCapabilities(page, data);

    let page2: PDFPage;
    if (pages.length >= 2) {
      page2 = pages[1];
    } else {
      const pageSize = page.getSize();
      page2 = this.pdfDoc.addPage([pageSize.width, pageSize.height]);
    }
    this.fillComments(page2, data);

    return await this.pdfDoc.save();
  }

  private fillHeader(page: PDFPage, data: ArtReportData): void {
    const fontSize = 10;
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    page.drawText(data.studentName || "", { x: 48, y: toY(204), size: fontSize, font: this.font });

    if (data.age_grade) {
      page.drawText(String(data.age_grade), { x: 214, y: toY(204), size: fontSize, font: this.font });
    }

    page.drawText(data.date || "", { x: 268, y: toY(204), size: fontSize, font: this.font });
    page.drawText(data.teacher || "", { x: 414, y: toY(204), size: fontSize, font: this.font });
    page.drawText(data.campus || "", { x: 75, y: toY(221), size: fontSize, font: this.font });
    page.drawText(data.subject || "", { x: 345, y: toY(221), size: fontSize, font: this.font });
  }

  private fillCapabilities(page: PDFPage, data: ArtReportData): void {
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    if (data.technology?.score) {
      const yPositions = [360, 388, 416, 444].map(toY);
      this.drawLevelMark(page, 50, yPositions[data.technology.score - 1]);
    }

    if (data.creativity?.score) {
      const yPositions = [360, 388, 416, 444].map(toY);
      this.drawLevelMark(page, 322, yPositions[data.creativity.score - 1]);
    }

    if (data.designPrinciples?.score) {
      const yPositions = [546, 574, 600, 628].map(toY);
      this.drawLevelMark(page, 50, yPositions[data.designPrinciples.score - 1]);
    }

    if (data.communication?.score) {
      const yPositions = [546, 574, 600, 628].map(toY);
      this.drawLevelMark(page, 322, yPositions[data.communication.score - 1]);
    }

    if (data.selfLearning?.score) {
      const xPositions = [197, 291, 384, 474];
      this.drawLevelMark(page, xPositions[data.selfLearning.score - 1], toY(682));
    }
  }

  private drawLevelMark(page: PDFPage, x: number, y: number): void {
    page.drawText("X", { x, y, size: 11, font: this.font });
  }

  private fillComments(page: PDFPage, data: ArtReportData): void {
    const fontSize = 9;
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    page.drawText("Nhận xét từ giáo viên:", { x: 40, y: toY(40), size: fontSize, font: this.font, color: rgb(1, 0, 0) });

    if (data.teacherComment) {
      const maxWidth = 500;
      const lines = this.wrapText(data.teacherComment, maxWidth, fontSize);
      const maxLines = 10;
      const startY = 65;
      const lineSpacing = 20;

      lines.slice(0, maxLines).forEach((line, index) => {
        page.drawText(line, { x: 40, y: toY(startY + index * lineSpacing), size: fontSize, font: this.font });
      });
    }

    page.drawText("Định hướng dành cho học viên:", { x: 40, y: toY(300), size: fontSize, font: this.font, color: rgb(1, 0, 0) });

    if (data.recommendation) {
      const maxWidth = 500;
      const lines = this.wrapText(data.recommendation, maxWidth, fontSize);
      const maxLines = 5;
      const startY = 325;
      const lineSpacing = 20;

      lines.slice(0, maxLines).forEach((line, index) => {
        page.drawText(line, { x: 40, y: toY(startY + index * lineSpacing), size: fontSize, font: this.font });
      });
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

export async function generateArtPDF(data: ArtReportData): Promise<Blob> {
  const filler = new ArtPDFFiller();
  const pdfBytes = await filler.fillArtReport(data);
  return new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
}

export function generateArtFilename(data: ArtReportData): string {
  const studentName = data.studentName?.replaceAll(/\s+/g, "_") || "Student";
  const subject = data.subject?.replaceAll(/\s+/g, "_") || "Art";
  const date = data.date?.replaceAll("/", "-") || "NoDate";
  return `${subject}_${studentName}_${date}.pdf`;
}
