import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
      @page { size: A4; margin: 10mm; }
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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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