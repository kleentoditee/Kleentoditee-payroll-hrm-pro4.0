import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, type PDFPage, type PDFFont, rgb } from "pdf-lib";
import type { buildStatutoryForms } from "./statutory-forms.js";

type FormsData = ReturnType<typeof buildStatutoryForms>;
type FormRow = FormsData["rows"][number];
type FormKind = "nhi" | "ssb";

const PAGE_WIDTH = 1008;
const PAGE_HEIGHT = 612;
const PX_SCALE = 0.6;
const ink = rgb(0.02, 0.02, 0.02);

function assetPath(name: string): string {
  return fileURLToPath(new URL(`../../assets/forms/${name}`, import.meta.url));
}

function money(value: number): string {
  return value ? value.toFixed(2) : "";
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
}

function monthName(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
}

function signedDateLabel(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function signedDateParts(value: string): { day: string; month: string; year: string } {
  if (!value) return { day: "", month: "", year: "" };
  const [year, month, day] = value.split("-");
  return { day, month, year: year.slice(-2) };
}

function signatureBytes(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return match ? Buffer.from(match[1], "base64") : null;
}

/** Render-time guard for SVG previews: only a well-formed PNG data URL may
 *  reach an <image href> (same rule as signatureBytes / settings input). */
function safeSignatureDataUrl(dataUrl: string | null | undefined): string {
  const value = (dataUrl ?? "").trim();
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
}

function drawAt(page: PDFPage, font: PDFFont, text: string, xPx: number, baselinePx: number, size = 7.5) {
  if (!text) return;
  page.drawText(text, { x: xPx * PX_SCALE, y: PAGE_HEIGHT - baselinePx * PX_SCALE, size, font, color: ink });
}

function drawFit(
  page: PDFPage,
  font: PDFFont,
  text: string,
  xPx: number,
  baselinePx: number,
  widthPx: number,
  size = 7.5
) {
  if (!text) return;
  const maxWidth = widthPx * PX_SCALE;
  let actualSize = size;
  while (actualSize > 5 && font.widthOfTextAtSize(text, actualSize) > maxWidth) actualSize -= 0.25;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(value, actualSize) > maxWidth) value = `${value.slice(0, -2)}.`;
  drawAt(page, font, value, xPx, baselinePx, actualSize);
}

function drawFitCentered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerXPx: number,
  baselinePx: number,
  widthPx: number,
  size = 7.5
) {
  if (!text) return;
  const maxWidth = widthPx * PX_SCALE;
  let actualSize = size;
  while (actualSize > 5 && font.widthOfTextAtSize(text, actualSize) > maxWidth) actualSize -= 0.25;
  const textWidth = font.widthOfTextAtSize(text, actualSize);
  drawAt(page, font, text, centerXPx - textWidth / (2 * PX_SCALE), baselinePx, actualSize);
}

function addBackgroundPage(document: PDFDocument, background: Uint8Array) {
  return document.embedPng(background).then((image) => {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    return page;
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function sumRows(rows: FormRow[], kind: FormKind) {
  return rows.reduce(
    (total, row) => ({
      earnings: total.earnings + row[kind].earnings,
      contribution: total.contribution + row[kind].total,
      weeks: total.weeks + row.weeksWorked,
      spouse: total.spouse + (kind === "nhi" ? row.nhi.unemployedSpouse : 0)
    }),
    { earnings: 0, contribution: 0, weeks: 0, spouse: 0 }
  );
}

function fillNhiRow(page: PDFPage, font: PDFFont, row: FormRow, top: number, groupHeight: number) {
  const lineGap = groupHeight / 4;
  drawFit(page, font, row.nhiNumber, 42, top + groupHeight / 2, 118, 7.5);
  drawFit(page, font, row.employeeName, 166, top + groupHeight / 2, 286, 7.5);
  drawAt(page, font, row.sex, 474, top + groupHeight / 2, 7.5);

  const weekX = [750, 833, 917, 1003, 1087];
  for (let week = 0; week < 5; week += 1) {
    drawAt(page, font, money(row.weeklyEarnings[week]), weekX[week], top + lineGap * 0.72, 6.5);
    drawAt(page, font, money(row.nhi.weeklyEmployee[week]), weekX[week], top + lineGap * 1.72, 6.5);
    drawAt(page, font, money(row.nhi.weeklyEmployer[week]), weekX[week], top + lineGap * 2.72, 6.5);
    drawAt(page, font, money(row.nhi.weeklyUnemployedSpouse[week]), weekX[week], top + lineGap * 3.72, 6.5);
  }

  drawAt(page, font, money(row.nhi.earnings), 1170, top + groupHeight / 2, 7);
  drawAt(page, font, money(row.nhi.total), 1292, top + groupHeight / 2, 7);
  drawAt(page, font, money(row.nhi.unemployedSpouse), 1410, top + groupHeight / 2, 7);
}

async function buildNhiPdf(data: FormsData, signedDate: string): Promise<Uint8Array> {
  const [pageOneImage, continuationImage] = await Promise.all([
    readFile(assetPath("nhi-form-k-page-1.png")),
    readFile(assetPath("nhi-form-k-page-2.png"))
  ]);
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const firstRows = data.rows.slice(0, 4);
  const remainingPages = chunk(data.rows.slice(4), 6);
  const pageGroups = [firstRows, ...remainingPages];

  for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex += 1) {
    const rows = pageGroups[pageIndex];
    const first = pageIndex === 0;
    const page = await addBackgroundPage(document, first ? pageOneImage : continuationImage);
    drawFit(page, font, data.company.companyLegalName, 40, first ? 108 : 89, 350, 8);
    drawFit(page, font, data.company.nhiEmployerNumber, 40, first ? 181 : 164, 350, 8);
    if (first) drawFit(page, font, monthLabel(data.month), 1290, 156, 345, 8);

    const top = first ? 296 : 270;
    const groupHeight = first ? 120 : 115;
    rows.forEach((row, index) => fillNhiRow(page, font, row, top + index * groupHeight, groupHeight));

    const totals = sumRows(rows, "nhi");
    const totalY = first ? 779 : 985;
    drawAt(page, font, money(totals.earnings), 1170, totalY, 7);
    drawAt(page, font, money(totals.contribution), 1292, totalY, 7);
    drawAt(page, font, money(totals.spouse), 1410, totalY, 7);
    if (first) {
      const signature = signatureBytes(data.company.statutorySignatureDataUrl);
      if (signature) {
        const image = await document.embedPng(signature);
        page.drawImage(image, { x: 225 * PX_SCALE, y: PAGE_HEIGHT - 855 * PX_SCALE, width: 250 * PX_SCALE, height: 70 * PX_SCALE });
        const date = signedDateParts(signedDate);
        drawAt(page, font, date.day, 575, 837, 10.5);
        drawAt(page, font, date.month, 643, 837, 10.5);
        drawAt(page, font, date.year, 710, 837, 10.5);
      }
    }
  }

  document.setTitle(`NHI Form K - ${data.month}`);
  document.setAuthor(data.company.companyLegalName);
  return document.save();
}

function fillSsbRow(page: PDFPage, font: PDFFont, row: FormRow, top: number) {
  const groupHeight = 77;
  drawFit(page, font, row.ssbNumber, 33, top + groupHeight / 2, 97, 7);
  drawFit(page, font, row.employeeName, 150, top + groupHeight / 2, 335, 7.5);
  drawAt(page, font, row.sex, 504, top + groupHeight / 2, 7.5);

  const weekX = [660, 765, 870, 975, 1080];
  for (let week = 0; week < 5; week += 1) {
    drawAt(page, font, money(row.weeklyEarnings[week]), weekX[week], top + 20, 6.5);
    drawAt(page, font, money(row.ssb.weeklyEmployee[week]), weekX[week], top + 46, 6.5);
    drawAt(page, font, money(row.ssb.weeklyEmployer[week]), weekX[week], top + 70, 6.5);
  }
  drawAt(page, font, money(row.ssb.earnings), 1200, top + groupHeight / 2, 7);
  drawAt(page, font, money(row.ssb.total), 1333, top + groupHeight / 2, 7);
  drawAt(page, font, row.weeksWorked ? String(row.weeksWorked) : "", 1450, top + groupHeight / 2, 7);
}

async function buildSsbPdf(data: FormsData, signedDate: string): Promise<Uint8Array> {
  const [pageOneImage, continuationImage] = await Promise.all([
    readFile(assetPath("ssb-form-1.png")),
    readFile(assetPath("ssb-form-2.png"))
  ]);
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const [year] = data.month.split("-");
  const firstRows = data.rows.slice(0, 6);
  const remainingPages = chunk(data.rows.slice(6), 9);
  const pageGroups = [firstRows, ...(remainingPages.length ? remainingPages : [[]])];

  for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex += 1) {
    const rows = pageGroups[pageIndex];
    const first = pageIndex === 0;
    const page = await addBackgroundPage(document, first ? pageOneImage : continuationImage);
    drawFit(page, font, data.company.companyLegalName, 410, 106, 350, 8);
    drawFit(page, font, data.company.ssbEmployerNumber, 830, 126, 200, 8);
    drawFitCentered(page, font, monthName(data.month), 1378, 126, 116, 9);
    drawAt(page, font, year, 1510, 126, 9);

    rows.forEach((row, index) => fillSsbRow(page, font, row, 234 + index * 77));
    const totals = sumRows(rows, "ssb");
    const totalY = first ? 741 : 955;
    drawAt(page, font, money(totals.earnings), 1200, totalY, 7);
    drawAt(page, font, money(totals.contribution), 1333, totalY, 7);
    drawAt(page, font, totals.weeks ? String(totals.weeks) : "", 1450, totalY, 7);
    if (first) {
      drawAt(page, font, money(totals.earnings), 1200, 814, 7);
      drawAt(page, font, money(totals.contribution), 1333, 814, 7);
      drawAt(page, font, totals.weeks ? String(totals.weeks) : "", 1450, 814, 7);
      const signature = signatureBytes(data.company.statutorySignatureDataUrl);
      if (signature) {
        const image = await document.embedPng(signature);
        page.drawImage(image, { x: 255 * PX_SCALE, y: PAGE_HEIGHT - 855 * PX_SCALE, width: 330 * PX_SCALE, height: 75 * PX_SCALE });
        drawAt(page, font, signedDateLabel(signedDate), 700, 837, 10.5);
      }
    }
  }

  document.setTitle(`SSB Forms I-II - ${data.month}`);
  document.setAuthor(data.company.companyLegalName);
  return document.save();
}

export async function buildOfficialStatutoryPdf(kind: FormKind, data: FormsData, signedDate = ""): Promise<Uint8Array> {
  return kind === "nhi" ? buildNhiPdf(data, signedDate) : buildSsbPdf(data, signedDate);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[character] ?? character);
}

function svgText(text: string, x: number, y: number, size = 12.5, width?: number): string {
  if (!text) return "";
  const maxCharacters = width ? Math.max(1, Math.floor(width / (size * 0.55))) : text.length;
  const fitted = text.length > maxCharacters ? `${text.slice(0, Math.max(1, maxCharacters - 1))}.` : text;
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="#050505">${escapeXml(fitted)}</text>`;
}

function svgCenteredText(text: string, centerX: number, y: number, size = 12.5): string {
  if (!text) return "";
  return `<text x="${centerX}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="#050505">${escapeXml(text)}</text>`;
}

async function previewBackground(name: string): Promise<string> {
  const image = await readFile(assetPath(name));
  return `data:image/png;base64,${image.toString("base64")}`;
}

function svgDocument(background: string, content: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 1020" role="img" aria-label="${escapeXml(label)}">
  <image href="${background}" x="0" y="0" width="1680" height="1020"/>
  ${content}
</svg>`;
}

async function buildNhiPreview(data: FormsData, signedDate: string): Promise<string> {
  const background = await previewBackground("nhi-form-k-page-1.png");
  const rows = data.rows.slice(0, 4);
  const content: string[] = [
    svgText(data.company.companyLegalName, 40, 108, 13.3, 350),
    svgText(data.company.nhiEmployerNumber, 40, 181, 13.3, 350),
    svgText(monthLabel(data.month), 1290, 156, 13.3, 345)
  ];
  rows.forEach((row, index) => {
    const top = 296 + index * 120;
    content.push(
      svgText(row.nhiNumber, 42, top + 60, 12.5, 118),
      svgText(row.employeeName, 166, top + 60, 12.5, 286),
      svgText(row.sex, 474, top + 60, 12.5)
    );
    const weekX = [750, 833, 917, 1003, 1087];
    weekX.forEach((x, week) => {
      content.push(
        svgText(money(row.weeklyEarnings[week]), x, top + 21.6, 10.8),
        svgText(money(row.nhi.weeklyEmployee[week]), x, top + 51.6, 10.8),
        svgText(money(row.nhi.weeklyEmployer[week]), x, top + 81.6, 10.8),
        svgText(money(row.nhi.weeklyUnemployedSpouse[week]), x, top + 111.6, 10.8)
      );
    });
    content.push(
      svgText(money(row.nhi.earnings), 1170, top + 60, 11.7),
      svgText(money(row.nhi.total), 1292, top + 60, 11.7),
      svgText(money(row.nhi.unemployedSpouse), 1410, top + 60, 11.7)
    );
  });
  const totals = sumRows(rows, "nhi");
  content.push(
    svgText(money(totals.earnings), 1170, 779, 11.7),
    svgText(money(totals.contribution), 1292, 779, 11.7),
    svgText(money(totals.spouse), 1410, 779, 11.7)
  );
  const signatureDataUrl = safeSignatureDataUrl(data.company.statutorySignatureDataUrl);
  if (signatureDataUrl) {
    const date = signedDateParts(signedDate);
    content.push(
      `<image href="${signatureDataUrl}" x="225" y="785" width="250" height="70" preserveAspectRatio="xMidYMid meet"/>`,
      svgText(date.day, 575, 837, 17.5),
      svgText(date.month, 643, 837, 17.5),
      svgText(date.year, 710, 837, 17.5)
    );
  }
  return svgDocument(background, content.join("\n"), `NHI Form K preview for ${data.month}`);
}

async function buildSsbPreview(data: FormsData, signedDate: string): Promise<string> {
  const [pageOneBackground, continuationBackground] = await Promise.all([
    previewBackground("ssb-form-1.png"),
    previewBackground("ssb-form-2.png")
  ]);
  const [year] = data.month.split("-");
  const remainingPages = chunk(data.rows.slice(6), 9);
  const pageGroups = [data.rows.slice(0, 6), ...(remainingPages.length ? remainingPages : [[]])];
  const pageGap = 40;
  const pageHeight = 1020;
  const content: string[] = [];

  pageGroups.forEach((rows, pageIndex) => {
    const offset = pageIndex * (pageHeight + pageGap);
    const first = pageIndex === 0;
    content.push(`<image href="${first ? pageOneBackground : continuationBackground}" x="0" y="${offset}" width="1680" height="1020"/>`);
    content.push(
      svgText(data.company.companyLegalName, 410, offset + 106, 13.3, 350),
      svgText(data.company.ssbEmployerNumber, 830, offset + 126, 13.3, 200),
      svgCenteredText(monthName(data.month), 1378, offset + 126, 15),
      svgText(year, 1510, offset + 126, 15)
    );
    rows.forEach((row, index) => {
      const top = offset + 234 + index * 77;
      content.push(
        svgText(row.ssbNumber, 33, top + 38.5, 11.7, 97),
        svgText(row.employeeName, 150, top + 38.5, 12.5, 335),
        svgText(row.sex, 504, top + 38.5, 12.5)
      );
      const weekX = [660, 765, 870, 975, 1080];
      weekX.forEach((x, week) => {
        content.push(
          svgText(money(row.weeklyEarnings[week]), x, top + 20, 10.8),
          svgText(money(row.ssb.weeklyEmployee[week]), x, top + 46, 10.8),
          svgText(money(row.ssb.weeklyEmployer[week]), x, top + 70, 10.8)
        );
      });
      content.push(
        svgText(money(row.ssb.earnings), 1200, top + 38.5, 11.7),
        svgText(money(row.ssb.total), 1333, top + 38.5, 11.7),
        svgText(row.weeksWorked ? String(row.weeksWorked) : "", 1450, top + 38.5, 11.7)
      );
    });
    const totals = sumRows(rows, "ssb");
    const totalY = offset + (first ? 741 : 955);
    content.push(
      svgText(money(totals.earnings), 1200, totalY, 11.7),
      svgText(money(totals.contribution), 1333, totalY, 11.7),
      svgText(totals.weeks ? String(totals.weeks) : "", 1450, totalY, 11.7)
    );
    if (first) {
      content.push(
        svgText(money(totals.earnings), 1200, offset + 814, 11.7),
        svgText(money(totals.contribution), 1333, offset + 814, 11.7),
        svgText(totals.weeks ? String(totals.weeks) : "", 1450, offset + 814, 11.7)
      );
      const ssbSignatureDataUrl = safeSignatureDataUrl(data.company.statutorySignatureDataUrl);
      if (ssbSignatureDataUrl) {
        content.push(
          `<image href="${ssbSignatureDataUrl}" x="255" y="${offset + 780}" width="330" height="75" preserveAspectRatio="xMidYMid meet"/>`,
          svgText(signedDateLabel(signedDate), 700, offset + 837, 17.5)
        );
      }
    }
  });

  const height = pageGroups.length * pageHeight + (pageGroups.length - 1) * pageGap;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 ${height}" role="img" aria-label="${escapeXml(`SSB Forms I and II preview for ${data.month}`)}">${content.join("\n")}</svg>`;
}

export async function buildOfficialStatutoryPreview(kind: FormKind, data: FormsData, signedDate = ""): Promise<string> {
  return kind === "nhi" ? buildNhiPreview(data, signedDate) : buildSsbPreview(data, signedDate);
}
