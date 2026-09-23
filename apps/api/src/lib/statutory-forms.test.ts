import assert from "node:assert/strict";
import test from "node:test";
import { buildStatutoryForms, type StatutoryFormRun } from "./statutory-forms.js";

const settings = {
  companyLegalName: "KleenToDiTee",
  companyAddress: "Tortola, BVI",
  ssbEmployerNumber: "SSB-100",
  nhiEmployerNumber: "NHI-100",
  statutorySignatureDataUrl: ""
};

test("government forms total finalized payroll values per employee", () => {
  const runs: StatutoryFormRun[] = [{
    id: "run-1",
    period: { schedule: "weekly", endDate: new Date("2026-09-04T00:00:00Z"), payDate: new Date("2026-09-04T00:00:00Z") },
    items: [{
      employeeId: "employee-1",
      employeeName: "Maria Monthly",
      gross: 1000,
      nhi: 37.5,
      ssb: 40,
      employerNhi: 37.5,
      employerSsb: 45,
      daysWorked: 5,
      employee: {
        fullName: "Maria Monthly",
        sex: "F",
        socialSecurityNumber: "501-600-0101",
        nationalHealthInsuranceNumber: "NHI-0101",
        nhiUnemployedSpouse: true
      }
    }]
  }];

  const form = buildStatutoryForms(settings, runs, "2026-09");
  assert.equal(form.rows.length, 1);
  assert.deepEqual(form.rows[0].weeklyEarnings, [1000, 0, 0, 0, 0]);
  assert.equal(form.rows[0].ssb.total, 85);
  assert.equal(form.rows[0].nhi.total, 75);
  assert.equal(form.rows[0].nhi.unemployedSpouse, 37.5);
  assert.deepEqual(form.rows[0].missing, []);
  assert.equal(form.totals.ssb.total, 85);
});

test("government forms flag missing staff registration fields without inventing values", () => {
  const runs: StatutoryFormRun[] = [{
    id: "run-2",
    period: { schedule: "monthly", endDate: new Date("2026-09-30T00:00:00Z"), payDate: null },
    items: [{
      employeeId: "employee-2",
      employeeName: "New Employee",
      gross: 800,
      nhi: 30,
      ssb: 32,
      employerNhi: 30,
      employerSsb: 36,
      daysWorked: 20,
      employee: {
        fullName: "New Employee",
        sex: "",
        socialSecurityNumber: "",
        nationalHealthInsuranceNumber: "",
        nhiUnemployedSpouse: false
      }
    }]
  }];

  const form = buildStatutoryForms(settings, runs, "2026-09");
  assert.deepEqual(form.rows[0].weeklyEarnings, [0, 0, 0, 0, 800]);
  assert.deepEqual(form.rows[0].missing, ["Sex", "SSB number", "NHI number"]);
});

test("government forms include every current employee before payroll is finalized", () => {
  const form = buildStatutoryForms(settings, [], "2026-09", [
    {
      id: "employee-1",
      fullName: "Maria Monthly",
      sex: "F",
      socialSecurityNumber: "501-600-0101",
      nationalHealthInsuranceNumber: "NHI-0101",
      nhiUnemployedSpouse: false
    },
    {
      id: "employee-2",
      fullName: "Wendy Weekly",
      sex: "F",
      socialSecurityNumber: "501-600-0102",
      nationalHealthInsuranceNumber: "NHI-0102",
      nhiUnemployedSpouse: true
    }
  ]);

  assert.equal(form.sourceRunCount, 0);
  assert.deepEqual(form.rows.map((row) => row.employeeName), ["Maria Monthly", "Wendy Weekly"]);
  assert.equal(form.rows[0].ssb.earnings, 0);
  assert.equal(form.rows[1].nhi.total, 0);
  assert.deepEqual(form.rows[0].missing, []);
});
