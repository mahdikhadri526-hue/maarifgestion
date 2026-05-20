import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PdfTone = "entry" | "exit" | "lot" | "warning";

export type PdfColumn = {
  header: string;
  dataKey: string;
  width?: number;
  halign?: "left" | "center" | "right";
  tone?: PdfTone;
};

export type PdfTableSection = {
  title: string;
  columns: PdfColumn[];
  rows: Record<string, string | number | null | undefined>[];
};

export type StructuredPdfOptions = {
  filename: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  sections: PdfTableSection[];
};

const BRAND_BLUE: [number, number, number] = [30, 64, 124];
const SOFT_BLUE: [number, number, number] = [235, 243, 255];
const GRID: [number, number, number] = [204, 214, 226];
const ENTRY_GREEN: [number, number, number] = [22, 101, 52];
const ENTRY_BG: [number, number, number] = [236, 253, 245];
const EXIT_RED: [number, number, number] = [153, 27, 27];
const EXIT_BG: [number, number, number] = [254, 242, 242];

function addHeaderAndFooter(doc: jsPDF, title: string, subtitle?: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(0, 0, pageWidth, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 10, 10.5);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(subtitle, pageWidth - 10, 10.5, { align: "right" });
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 104, 122);
    doc.text(`Page ${i}/${pageCount}`, pageWidth - 12, pageHeight - 6, { align: "right" });
  }
}

/**
 * Generate a professional A4 landscape PDF from structured data.
 * This is fully vector-based: selectable text, real paginated tables, no screenshots.
 */
export async function downloadStructuredPdf(options: StructuredPdfOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  doc.setProperties({ title: options.title, subject: options.subtitle ?? options.title });
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageWidth, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(options.title, margin, 10.5);

  y = 22;
  if (options.subtitle) {
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(options.subtitle, margin, y);
    y += 5;
  }
  if (options.meta?.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const meta = options.meta.filter(Boolean).join("  •  ");
    doc.text(meta, margin, y);
    y += 6;
  }

  for (const section of options.sections) {
    if (y > pageHeight - 32) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(...SOFT_BLUE);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 7, 1.5, 1.5, "F");
    doc.setTextColor(...BRAND_BLUE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(section.title, margin + 2, y + 4.8);
    y += 9;

    const columnStyles = section.columns.reduce<Record<string, any>>((acc, col) => {
      acc[col.dataKey] = {
        cellWidth: col.width ?? "auto",
        halign: col.halign ?? "left",
      };
      return acc;
    }, {});
    const tones = new Map(section.columns.map((col) => [col.dataKey, col.tone]));

    autoTable(doc, {
      columns: section.columns.map((col) => ({ header: col.header, dataKey: col.dataKey })),
      body: section.rows.map((row) =>
        Object.fromEntries(section.columns.map((col) => [col.dataKey, row[col.dataKey] ?? "—"])),
      ),
      startY: y,
      margin: { left: margin, right: margin, top: 22, bottom: 12 },
      styles: {
        font: "helvetica",
        fontSize: 7.2,
        cellPadding: { top: 1.3, right: 1.3, bottom: 1.3, left: 1.3 },
        overflow: "linebreak",
        valign: "middle",
        lineColor: GRID,
        lineWidth: 0.15,
        textColor: [15, 23, 42],
        minCellHeight: 5.2,
      },
      headStyles: {
        fillColor: BRAND_BLUE,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      theme: "grid",
      pageBreak: "auto",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const tone = tones.get(String(data.column.dataKey));
        if (tone === "entry") {
          data.cell.styles.textColor = ENTRY_GREEN;
          data.cell.styles.fillColor = ENTRY_BG;
          data.cell.styles.fontStyle = "bold";
        }
        if (tone === "exit") {
          data.cell.styles.textColor = EXIT_RED;
          data.cell.styles.fillColor = EXIT_BG;
          data.cell.styles.fontStyle = "bold";
        }
        if (tone === "lot") {
          data.cell.styles.textColor = BRAND_BLUE;
        }
        if (tone === "warning") {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
  }

  addHeaderAndFooter(doc, options.title, options.subtitle);
  doc.save(options.filename.endsWith(".pdf") ? options.filename : `${options.filename}.pdf`);
}

/**
 * Opens the browser print dialog with ONLY the given element visible.
 * Keeps the exact same design (CSS) thanks to a print stylesheet that
 * hides everything outside the printed node.
 */
export function printElement(node: HTMLElement) {
  const PRINT_ID = "lovable-print-target";
  const STYLE_ID = "lovable-print-style";

  const previousId = node.id;
  node.id = PRINT_ID;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.innerHTML = `
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      body * { visibility: hidden !important; }
      #${PRINT_ID}, #${PRINT_ID} * { visibility: visible !important; }
      #${PRINT_ID} {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        background: white !important;
      }
      .no-print { display: none !important; }
    }
  `;

  const cleanup = () => {
    window.removeEventListener("afterprint", cleanup);
    if (previousId) node.id = previousId;
    else node.removeAttribute("id");
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}

/**
 * Generate a TRUE vector PDF (selectable text, real tables) from a DOM node.
 * Walks the node sequentially and renders headings/paragraphs as text and
 * <table> elements via jspdf-autotable, which handles multi-page A4 layout
 * with proper page breaks. No screenshots involved.
 */
export async function downloadElementAsPdf(node: HTMLElement, filename: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = margin;

  const ensureSpace = (needed = 8) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
    const { size = 9, bold = false, gap = 1.5 } = opts;
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lineHeight = size * 0.42;
    const lines = doc.splitTextToSize(clean, pageWidth - margin * 2);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += gap;
  };

  const renderTable = (table: HTMLTableElement) => {
    ensureSpace(20);
    autoTable(doc, {
      html: table,
      startY: y,
      margin: { left: margin, right: margin, top: margin, bottom: margin },
      styles: { fontSize: 7.5, cellPadding: 1.4, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [30, 64, 124], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: "grid",
      tableWidth: "auto",
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 4;
  };

  const SKIP_CLASSES = ["no-print", "no-pdf"];
  const shouldSkip = (el: Element) =>
    SKIP_CLASSES.some((c) => el.classList?.contains(c));

  const walk = (el: Element) => {
    if (shouldSkip(el)) return;
    const tag = el.tagName;

    if (tag === "TABLE") {
      renderTable(el as HTMLTableElement);
      return;
    }

    if (/^H[1-6]$/.test(tag)) {
      const size = tag === "H1" ? 15 : tag === "H2" ? 13 : tag === "H3" ? 11 : 10;
      writeText(el.textContent ?? "", { size, bold: true, gap: 2 });
      return;
    }

    // If the element contains structured children, recurse to preserve order.
    const hasStructured = el.querySelector(
      ":scope table, :scope h1, :scope h2, :scope h3, :scope h4, :scope h5, :scope h6, :scope ul, :scope ol, :scope > div, :scope > section, :scope > article",
    );
    if (hasStructured && el.children.length > 0) {
      Array.from(el.children).forEach((c) => walk(c));
      return;
    }

    if (tag === "UL" || tag === "OL") {
      Array.from(el.children).forEach((li) => writeText("• " + (li.textContent ?? "")));
      return;
    }

    // Leaf text content
    const text = el.textContent ?? "";
    if (text.trim()) writeText(text);
  };

  Array.from(node.children).forEach((c) => walk(c));

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}