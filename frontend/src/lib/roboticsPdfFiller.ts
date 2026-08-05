import { PDFTemplateFiller } from "./pdfTemplateHelper";
import type { RoboticsReportData } from "@/types/trialReport";
import type { PDFPage } from "pdf-lib";

/**
 * Robotics PDF Filler - Fill template với tọa độ chính xác
 * Template có 3 pages:
 * - PAGE 1: Header + Capability I (5 levels)
 * - PAGE 2: Capabilities II, III, IV (each 5 levels)
 * - PAGE 3: Average Score + Teacher Comments + Recommendation
 */
export class RoboticsPDFFiller extends PDFTemplateFiller {
  /**
   * Fill Robotics template với data
   */
  async fillRoboticsReport(data: RoboticsReportData): Promise<Uint8Array> {
    await this.loadTemplate("/templates/robotic_trial.pdf");

    const pages = this.pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages[1];
    const page3 = pages[2];

    // Fill header (PAGE 1)
    this.fillHeader(page1, data);

    // Fill capabilities (PAGE 1 & 2)
    this.fillCapabilities(page1, page2, data);

    // Fill average score + comments (PAGE 3)
    const averageScore = this.calculateAverage(data);
    this.fillSummary(page3, averageScore, data);

    return await this.save();
  }

  private fillHeader(page: PDFPage, data: RoboticsReportData): void {
    const fontSize = 10;
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    page.drawText(data.studentName || "", {
      x: 177,
      y: toY(186),
      size: fontSize,
      font: this.font,
    });

    if (data.age_grade) {
      page.drawText(String(data.age_grade), { x: 373, y: toY(186), size: fontSize, font: this.font });
    }

    page.drawText(data.subject || "Robotics", {
      x: 166,
      y: toY(218),
      size: fontSize,
      font: this.font,
    });

    if (data.date) {
      const [day, month, year] = data.date.split("/");
      if (day && month && year) {
        const dateFontSize = 8;
        const drawRightAligned = (text: string, rightEdge: number) => {
          const width = this.font.widthOfTextAtSize(text, dateFontSize);
          page.drawText(text, {
            x: rightEdge - width,
            y: toY(218),
            size: dateFontSize,
            font: this.font,
          });
        };

        drawRightAligned(day, 423.07);
        drawRightAligned(month, 436.15);
        drawRightAligned(year, 455.657);
      }
    }

    page.drawText(data.teacher || "", {
      x: 186,
      y: toY(250),
      size: fontSize,
      font: this.font,
    });
  }

  private fillCapabilities(
    page1: PDFPage,
    page2: PDFPage,
    data: RoboticsReportData,
  ): void {
    const pageHeight1 = page1.getHeight();
    const pageHeight2 = page2.getHeight();
    const toY1 = (userY: number) => pageHeight1 - userY;
    const toY2 = (userY: number) => pageHeight2 - userY;

    if (data.recognition?.score) {
      const yPositions = [480, 514, 546, 580, 618].map(toY1);
      const selectedLevel = data.recognition.score;
      this.drawLevelMark(page1, 500, yPositions[selectedLevel - 1]);
    }

    if (data.assembly?.score) {
      const yPositions = [182, 214, 246, 280, 318].map(toY2);
      const selectedLevel = data.assembly.score;
      this.drawLevelMark(page2, 500, yPositions[selectedLevel - 1]);
    }

    if (data.programming?.score) {
      const yPositions = [403, 436, 467, 499, 530].map(toY2);
      const selectedLevel = data.programming.score;
      this.drawLevelMark(page2, 500, yPositions[selectedLevel - 1]);
    }

    if (data.communication?.score) {
      const yPositions = [611, 643, 673, 703, 736].map(toY2);
      const selectedLevel = data.communication.score;
      this.drawLevelMark(page2, 500, yPositions[selectedLevel - 1]);
    }
  }

  private drawLevelMark(page: PDFPage, x: number, y: number): void {
    page.drawText("X", { x, y, size: 9, font: this.font });
  }

  private calculateAverage(data: RoboticsReportData): number {
    const scores = [
      data.recognition?.score,
      data.assembly?.score,
      data.programming?.score,
      data.communication?.score,
    ].filter((s) => s !== undefined) as number[];

    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private fillSummary(
    page: PDFPage,
    averageScore: number,
    data: RoboticsReportData,
  ): void {
    const fontSize = 11;
    const pageHeight = page.getHeight();
    const toY = (userY: number) => pageHeight - userY;

    page.drawText(averageScore.toFixed(2), {
      x: 398,
      y: toY(469),
      size: fontSize,
      font: this.font,
    });

    if (data.teacherComment) {
      const maxWidth = 461;
      const lines = this.wrapText(data.teacherComment, maxWidth, fontSize);
      const maxLines = 11;
      const startY = 533;
      const lineSpacing = 19;

      lines.slice(0, maxLines).forEach((line, index) => {
        page.drawText(line, {
          x: 73,
          y: toY(startY + index * lineSpacing),
          size: fontSize,
          font: this.font,
        });
      });
    }

    if (data.recommendation) {
      page.drawText(data.recommendation, {
        x: 229,
        y: toY(756),
        size: fontSize,
        font: this.font,
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

export async function generateRoboticsPDF(
  data: RoboticsReportData,
): Promise<Blob> {
  const filler = new RoboticsPDFFiller();
  const pdfBytes = await filler.fillRoboticsReport(data);
  return new Blob([pdfBytes as unknown as BlobPart], {
    type: "application/pdf",
  });
}

export function generateRoboticsFilename(data: RoboticsReportData): string {
  const studentName = data.studentName?.replaceAll(/\s+/g, "_") || "Student";
  const subject = data.subject?.replaceAll(/\s+/g, "_") || "Robotics";
  const date = data.date?.replaceAll("/", "-") || "NoDate";
  return `${subject}_${studentName}_${date}.pdf`;
}
