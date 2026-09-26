import PDFDocument from "pdfkit";
import type { InvoiceData } from "./invoice.interface.ts";

export const generateInvoicePdf = (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);


      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("CivicFlow", { align: "center" });
      doc
        .fontSize(10)
        .font("Helvetica")
        .text("Municipal Services Platform", { align: "center" });
      doc.moveDown(0.5);
      doc
        .strokeColor("#333333")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(1);


      doc.fontSize(16).font("Helvetica-Bold").text("PAYMENT INVOICE", {
        align: "center",
      });
      doc.moveDown(1);


      const leftX = 50;
      const rightX = 300;
      let y = doc.y;

      const addRow = (label: string, value: string) => {
        doc.fontSize(10).font("Helvetica-Bold").text(label, leftX, y);
        doc.fontSize(10).font("Helvetica").text(value, rightX, y);
        y += 20;
      };

      addRow("Invoice ID:", data.invoiceId);
      addRow("Payment ID:", data.paymentId);
      if (data.providerTrxId) {
        addRow("Transaction ID:", data.providerTrxId);
      }
      addRow("Date:", data.paidAt);
      addRow("Status:", data.status);

      y += 10;
      doc
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();
      y += 15;


      doc.fontSize(12).font("Helvetica-Bold").text("Bill To", leftX, y);
      y += 18;
      addRow("Name:", data.citizenName);
      addRow("Email:", data.citizenEmail);

      y += 10;
      doc
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();
      y += 15;


      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Service Request", leftX, y);
      y += 18;
      if (data.requestNumber) {
        addRow("Request #:", data.requestNumber);
      }
      if (data.requestTitle) {
        addRow("Title:", data.requestTitle);
      }

      y += 10;
      doc
        .strokeColor("#cccccc")
        .lineWidth(0.5)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();
      y += 15;


      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Payment Summary", leftX, y);
      y += 18;
      addRow("Amount:", `${data.amount} ${data.currency}`);
      addRow("Provider:", data.provider);
      addRow("Merchant Invoice:", data.merchantInvoiceNumber);


      doc.moveDown(3);
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#888888")
        .text(
          "This is a system-generated invoice. No signature is required.",
          50,
          doc.page.height - 80,
          { align: "center", width: 495 },
        );
      doc.text(`Generated on ${new Date().toISOString()}`, {
        align: "center",
        width: 495,
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
