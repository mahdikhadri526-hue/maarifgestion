import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
 * Capture the given DOM node and download a PDF that visually matches
 * the on-screen rendering.
 */
export async function downloadElementAsPdf(node: HTMLElement, filename: string) {
  // Force light background so the PDF is readable regardless of theme.
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: node.scrollWidth,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;

  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else {
    // Slice the canvas into A4 page-sized chunks.
    const pageHeightPx = ((pageHeight - margin * 2) * canvas.width) / imgWidth;
    let renderedHeight = 0;
    let pageIndex = 0;
    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        renderedHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );
      const sliceImg = pageCanvas.toDataURL("image/png");
      const sliceImgHeight = (sliceHeight * imgWidth) / canvas.width;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceImg, "PNG", margin, margin, imgWidth, sliceImgHeight);
      renderedHeight += sliceHeight;
      pageIndex += 1;
    }
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}