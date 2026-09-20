import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildOfficialStatutoryPdf, buildOfficialStatutoryPreview } from "./official-statutory-pdf.js";
import { buildStatutoryForms, type StatutoryFormRun } from "./statutory-forms.js";

function sampleData(employeeCount: number) {
  const items: StatutoryFormRun["items"] = Array.from({ length: employeeCount }, (_, index) => ({
    employeeId: `employee-${index}`,
    employeeName: `Employee ${index + 1}`,
    gross: 1000,
    nhi: 37.5,
    ssb: 40,
    employerNhi: 37.5,
    employerSsb: 45,
    daysWorked: 20,
    employee: {
      fullName: `Employee ${index + 1}`,
      sex: index % 2 ? "M" : "F",
      socialSecurityNumber: `SSB-${index + 1}`,
      nationalHealthInsuranceNumber: `NHI-${index + 1}`,
      nhiUnemployedSpouse: false
    }
  }));
  return buildStatutoryForms(
    {
      companyLegalName: "KleenToDiTee Limited",
      companyAddress: "Road Town, Tortola, BVI",
      ssbEmployerNumber: "SSB-100",
      nhiEmployerNumber: "NHI-100",
      statutorySignatureDataUrl: ""
    },
    [{
      id: "run-1",
      period: { schedule: "monthly", endDate: new Date("2026-09-30T00:00:00Z"), payDate: null },
      items
    }],
    "2026-09"
  );
}

test("official NHI output uses Form K page 1 and continuation templates", async () => {
  const pdf = await PDFDocument.load(await buildOfficialStatutoryPdf("nhi", sampleData(11)));
  assert.equal(pdf.getPageCount(), 3);
  assert.deepEqual(pdf.getPages().map((page) => page.getSize()), [
    { width: 1008, height: 612 },
    { width: 1008, height: 612 },
    { width: 1008, height: 612 }
  ]);
});

test("official SSB output uses Form I and Form II continuation templates", async () => {
  const pdf = await PDFDocument.load(await buildOfficialStatutoryPdf("ssb", sampleData(11)));
  assert.equal(pdf.getPageCount(), 2);
  assert.deepEqual(pdf.getPages().map((page) => page.getSize()), [
    { width: 1008, height: 612 },
    { width: 1008, height: 612 }
  ]);
});

test("official SSB output always includes Form II", async () => {
  const pdf = await PDFDocument.load(await buildOfficialStatutoryPdf("ssb", sampleData(1)));
  assert.equal(pdf.getPageCount(), 2);
});

test("official SSB preview shows the written month and both forms", async () => {
  const preview = await buildOfficialStatutoryPreview("ssb", sampleData(1), "");
  assert.match(preview, />SEPTEMBER<\/text>/);
  assert.match(preview, /viewBox="0 0 1680 2080"/);
  assert.equal((preview.match(/<image href="data:image\/png;base64/g) ?? []).length, 2);
});

test("official preview includes a saved signature and selected signing date", async () => {
  const data = sampleData(1);
  data.company.statutorySignatureDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwW5WQAAAABJRU5ErkJggg==";
  const preview = await buildOfficialStatutoryPreview("ssb", data, "2026-09-18");
  assert.match(preview, /x="255" y="780"/);
  assert.match(preview, />18\/09\/2026<\/text>/);
});

test("NHI preview places day, month, and year in their separate date spaces", async () => {
  const data = sampleData(1);
  data.company.statutorySignatureDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwW5WQAAAABJRU5ErkJggg==";
  const preview = await buildOfficialStatutoryPreview("nhi", data, "2026-09-18");
  assert.match(preview, /x="575" y="837"[^>]*>18<\/text>/);
  assert.match(preview, /x="643" y="837"[^>]*>09<\/text>/);
  assert.match(preview, /x="710" y="837"[^>]*>26<\/text>/);
});
