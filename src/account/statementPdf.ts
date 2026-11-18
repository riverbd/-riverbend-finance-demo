/**
 * Statement PDF rendering.
 *
 * Kept apart from the component and from the arithmetic so it can be exercised
 * on its own. Uses jsPDF + autoTable, which produce a real PDF in the browser
 * with no server round trip — the app is a static build, so a server-rendered
 * PDF was not an option, and a print stylesheet would have produced a
 * "print the page" experience rather than a file the customer receives.
 *
 * Everything drawn here is derived from the supplied StatementData. No figure is
 * invented and nothing is fetched.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "./format";
import type { StatementData } from "./statement";

/** Riverbend palette, matching the tailwind `river` scale in index.css. */
const RIVER_900 = [22, 78, 99] as const;
const RIVER_700 = [14, 116, 144] as const;
const SLATE_900 = [15, 23, 42] as const;
const SLATE_500 = [100, 116, 139] as const;
const SLATE_200 = [226, 232, 240] as const;
const EMERALD_600 = [5, 150, 105] as const;

const MARGIN = 14;

export const DISCLOSURE = "Illustrative demonstration statement";

/**
 * Make a string safe for the PDF's built-in Helvetica, which uses WinAnsi
 * encoding and silently drops or mangles anything outside it.
 *
 * This matters in practice, not in theory: a merchant named "Vilnius → Riga
 * train" is real data in this ledger, and without this the arrow rendered as a
 * stray "!" in the first draft of this file. Every substitution below keeps the
 * meaning of the original rather than deleting it.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/\u2192/g, "-")     // → right arrow, not in WinAnsi
    .replace(/\u2190/g, "-")     // ← left arrow
    .replace(/\u2014/g, " - ")   // — em dash
    .replace(/\u2013/g, "-")     // – en dash
    .replace(/\u2022/g, "-")     // • bullet, used by the masked account number
    .replace(/\u2026/g, "...")   // … ellipsis
    .replace(/\u00a0/g, " ")     // non-breaking space
    // Anything still outside printable Latin-1 becomes a plain "?" rather than
    // being dropped, so a gap is never mistaken for missing data.
    .replace(/[^\u0020-\u00ff]/g, "?");
}

/** "19 Apr 2019" — the same date format the activity list uses. */
export function pdfDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A money amount with an explicit minus for debits and no currency symbol clash. */
export function pdfMoney(value: number): string {
  const s = formatMoney(Math.abs(value));
  return value < 0 ? `-${s}` : s;
}

/**
 * Draw the Riverbend mark at x,y: two waves and a dot, the same geometry as the
 * site's logo component.
 */
function drawLogo(doc: jsPDF, x: number, y: number, scale = 1) {
  doc.setDrawColor(...RIVER_700);
  doc.setLineWidth(0.5 * scale);
  const wave = (dy: number) => {
    doc.lines(
      [[1, -1], [2, 0], [2, 1], [2, -1], [2, 0], [2, 1]],
      x,
      y + dy,
      [scale, scale],
      "S",
      false
    );
  };
  wave(0);
  wave(-1.6 * scale);
  doc.setFillColor(...RIVER_700);
  doc.circle(x + 4 * scale, y + 3 * scale, 0.45 * scale, "F");
}

/**
 * Build the statement document. Returns the jsPDF instance so the caller can
 * save it or hand it back as a blob.
 */
export function renderStatementPdf(data: StatementData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - MARGIN;

  // ---- header -------------------------------------------------------------
  drawLogo(doc, MARGIN, 18, 1.15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...RIVER_900);
  doc.text("RIVERBEND", MARGIN + 12, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_500);
  doc.text("F I N A N C E", MARGIN + 12, 22.4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...SLATE_900);
  doc.text("Account statement", right, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_500);
  doc.text(
    pdfSafe(`${pdfDate(data.period.start)} - ${pdfDate(data.period.end)}`),
    right,
    22.5,
    { align: "right" }
  );

  doc.setDrawColor(...SLATE_200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 27, right, 27);

  // ---- account and customer identity --------------------------------------
  const boxTop = 32;
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_500);
  doc.text("ACCOUNT", MARGIN, boxTop);
  doc.text("CUSTOMER", pageW / 2 + 4, boxTop);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SLATE_900);
  doc.text(pdfSafe(data.accountLabel), MARGIN, boxTop + 5.6);
  doc.text(pdfSafe(data.customerName), pageW / 2 + 4, boxTop + 5.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_500);
  doc.text(pdfSafe(`Account ${data.accountNumber}`), MARGIN, boxTop + 10.8);
  doc.text(pdfSafe(`Member ID ${data.memberId}`), pageW / 2 + 4, boxTop + 10.8);
  doc.text(
    pdfSafe(`Statement period ${pdfDate(data.period.start)} - ${pdfDate(data.period.end)}`),
    MARGIN,
    boxTop + 15.6
  );

  // ---- the four summary figures -------------------------------------------
  const sumTop = boxTop + 22;
  const figures: [string, string, [number, number, number]][] = [
    ["Opening balance", pdfMoney(data.openingBalance), [...SLATE_900] as [number, number, number]],
    ["Money received", pdfMoney(data.totalReceived), [...EMERALD_600] as [number, number, number]],
    ["Money spent", pdfMoney(-data.totalSpent), [...SLATE_900] as [number, number, number]],
    ["Closing balance", pdfMoney(data.closingBalance), [...RIVER_700] as [number, number, number]],
  ];
  const colW = (right - MARGIN) / 4;
  figures.forEach(([label, value, colour], i) => {
    const x = MARGIN + i * colW;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, sumTop, colW - 2, 16, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...SLATE_500);
    doc.text(label.toUpperCase(), x + 3, sumTop + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...colour);
    doc.text(value, x + 3, sumTop + 11.8);
  });

  // ---- transactions -------------------------------------------------------
  const body =
    data.lines.length > 0
      ? data.lines.map((l) => [
          pdfDate(l.date),
          pdfSafe(l.description),
          pdfSafe(l.type),
          l.debit === null ? "" : pdfMoney(l.debit),
          l.credit === null ? "" : pdfMoney(l.credit),
          pdfMoney(l.balance),
        ])
      : [["", "No transactions in this period", "", "", "", ""]];

  autoTable(doc, {
    startY: sumTop + 21,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Date", "Description", "Type", "Debit", "Credit", "Balance"]],
    body,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      textColor: [...SLATE_900],
      lineColor: [...SLATE_200],
      lineWidth: { bottom: 0.15, top: 0, left: 0, right: 0 },
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [...RIVER_900],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.6,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 },
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 26 },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (hook) => {
      // Debits read as money out; credits pick up the site's income green.
      if (hook.section === "body" && hook.column.index === 4 && hook.cell.raw) {
        hook.cell.styles.textColor = [...EMERALD_600];
      }
      if (hook.section === "body" && hook.column.index === 0) {
        hook.cell.styles.textColor = [...SLATE_500];
      }
    },
  });

  // ---- totals line under the table ---------------------------------------
  const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? sumTop + 21;
  let y = tableEnd + 7;
  if (y > pageH - 30) {
    doc.addPage();
    y = 24;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...SLATE_500);
  doc.text(
    `Closing balance carried forward: ${pdfMoney(data.closingBalance)}`,
    right,
    y,
    { align: "right" }
  );

  // ---- footer on every page ----------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = pageH - 12;
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, fy - 5, right, fy - 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    doc.text(pdfSafe(DISCLOSURE), MARGIN, fy);
    doc.text(
      pdfSafe(
        `${data.customerName} · ${data.accountLabel} · ${pdfDate(data.period.start)} - ${pdfDate(data.period.end)}`
      ),
      MARGIN,
      fy + 3.6,
      { maxWidth: right - MARGIN - 30 }
    );
    doc.text(`Page ${p} of ${pages}`, right, fy, { align: "right" });
  }

  return doc;
}

/** A filename that sorts sensibly and names the account and period. */
export function statementFilename(data: StatementData): string {
  const kind = data.accountKind === "savings" ? "fixed-savings" : "checking";
  return `riverbend-${kind}-statement-${data.period.start}-to-${data.period.end}.pdf`;
}

/** Render and hand the browser a download. */
export function downloadStatementPdf(data: StatementData): void {
  renderStatementPdf(data).save(statementFilename(data));
}
