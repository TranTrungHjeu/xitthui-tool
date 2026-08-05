import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * Helper để kiểm tra và log thông tin về PDF template
 * Dùng để xác định xem template có fillable fields không
 */
export async function inspectPDFTemplate(templatePath: string): Promise<void> {
  try {
    const pdfBytes = await fetch(templatePath).then((res) => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Kiểm tra AcroForm fields
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      if (fields.length > 0) {
        // Has fillable fields
        fields.forEach((_field) => {
          // Field info available for debugging if needed
        });
      }
    } catch {
      // No form fields - PDF static
    }

    // Get page dimensions
    const firstPage = pdfDoc.getPages()[0];
    firstPage.getSize();
  } catch (error) {
    console.error("Error inspecting PDF:", error);
  }
}

/**
 * Base class để fill PDF template
 */
export class PDFTemplateFiller {
  protected pdfDoc!: PDFDocument;
  protected font!: PDFFont;
  protected currentPage!: PDFPage;

  /**
   * Load template và setup font
   */
  async loadTemplate(templatePath: string): Promise<void> {
    const pdfBytes = await fetch(templatePath).then((res) => res.arrayBuffer());
    this.pdfDoc = await PDFDocument.load(pdfBytes);

    // Register fontkit để hỗ trợ font custom (Vietnamese)
    this.pdfDoc.registerFontkit(fontkit);

    try {
      // Load Roboto TTF font (hỗ trợ tiếng Việt đầy đủ)
      const fontUrl = "/fonts/Roboto-Regular.ttf";

      const fontResponse = await fetch(fontUrl);
      if (!fontResponse.ok) {
        throw new Error(`Font fetch failed: ${fontResponse.status}`);
      }

      const fontBytes = await fontResponse.arrayBuffer();

      this.font = await this.pdfDoc.embedFont(fontBytes);
    } catch (error) {
      console.error("Font loading error:", error);
      // Fallback to standard font (doesn't support Vietnamese diacritics)
      console.warn("Falling back to Helvetica (limited Vietnamese support)");
      this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    this.currentPage = this.pdfDoc.getPages()[0];
  }

  /**
   * Draw text tại vị trí cụ thể
   */
  protected drawText(
    text: string,
    x: number,
    y: number,
    fontSize: number = 12,
  ): void {
    this.currentPage.drawText(text, {
      x,
      y,
      size: fontSize,
      font: this.font,
      color: rgb(0, 0, 0),
    });
  }

  /**
   * Draw checkbox (☑ hoặc ☐)
   */
  protected drawCheckbox(
    checked: boolean,
    x: number,
    y: number,
    size: number = 12,
  ): void {
    const symbol = checked ? "☑" : "☐";
    this.drawText(symbol, x, y, size);
  }

  /**
   * Fill form field nếu template có AcroForm
   */
  protected fillFormField(fieldName: string, value: string): void {
    try {
      const form = this.pdfDoc.getForm();
      const field = form.getTextField(fieldName);
      field.setText(value);
    } catch {
      console.warn(`Field "${fieldName}" not found or not a text field`);
    }
  }

  /**
   * Save và trả về PDF bytes
   */
  async save(): Promise<Uint8Array> {
    return await this.pdfDoc.save();
  }

  /**
   * Tạo blob để download
   */
  async saveAsBlob(): Promise<Blob> {
    const pdfBytes = await this.save();
    return new Blob([pdfBytes as unknown as BlobPart], {
      type: "application/pdf",
    });
  }
}
