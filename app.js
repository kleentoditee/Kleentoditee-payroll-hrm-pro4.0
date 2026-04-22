(function () {
  const STORAGE_KEY = "kleentoditee-payroll-pro-v1";

  const seedState = {
    company: {
      name: "Kleentoditee",
      currency: "BZD",
      locale: "en-BZ"
    },
    settings: {
      focusMonth: "2026-03"
    },
    deductionTemplates: [
      {
        id: "tpl-standard",
        name: "Standard deductions",
        nhiRate: 0.0375,
        ssbRate: 0.04,
        incomeTaxRate: 0,
        defaults: { applyNhi: true, applySsb: true, applyIncomeTax: false }
      },
      {
        id: "tpl-taxed",
        name: "NHI + SSB + income tax",
        nhiRate: 0.0375,
        ssbRate: 0.04,
        incomeTaxRate: 0.08,
        defaults: { applyNhi: true, applySsb: true, applyIncomeTax: true }
      },
      {
        id: "tpl-manual",
        name: "Manual deductions only",
        nhiRate: 0,
        ssbRate: 0,
        incomeTaxRate: 0,
        defaults: { applyNhi: false, applySsb: false, applyIncomeTax: false }
      }
    ],
    employees: [
      {
        id: "emp-damian",
        fullName: "Damian Harney",
        role: "Night cleaner",
        defaultSite: "Harney's",
        phone: "",
        basePayType: "daily",
        dailyRate: 30,
        hourlyRate: 0,
        overtimeRate: 10,
        fixedPay: 0,
        standardDays: 21,
        standardHours: 63,
        templateId: "tpl-taxed",
        active: true,
        notes: "Sample employee from March 2026 payroll."
      },
      {
        id: "emp-jody",
        fullName: "Jody Lewis",
        role: "Cleaner",
        defaultSite: "Harney's / Police / Flow / Carpet",
        phone: "",
        basePayType: "fixed",
        dailyRate: 0,
        hourlyRate: 0,
        overtimeRate: 0,
        fixedPay: 910,
        standardDays: 20,
        standardHours: 60,
        templateId: "tpl-manual",
        active: true,
        notes: "Manual monthly total for mixed-site work."
      },
      {
        id: "emp-nadine",
        fullName: "Nadine Tadian",
        role: "Cleaner",
        defaultSite: "Republic Bank",
        phone: "",
        basePayType: "daily",
        dailyRate: 20,
        hourlyRate: 0,
        overtimeRate: 0,
        fixedPay: 0,
        standardDays: 20,
        standardHours: 0,
        templateId: "tpl-taxed",
        active: true,
        notes: ""
      },
      {
        id: "emp-akeisha",
        fullName: "Akeisha Roberts",
        role: "Part-time cleaner",
        defaultSite: "Republic Bank",
        phone: "",
        basePayType: "daily",
        dailyRate: 20,
        hourlyRate: 0,
        overtimeRate: 0,
        fixedPay: 0,
        standardDays: 20,
        standardHours: 0,
        templateId: "tpl-taxed",
        active: true,
        notes: ""
      },
      {
        id: "emp-michael",
        fullName: "Michael Blackwood",
        role: "Grounds support",
        defaultSite: "AGC",
        phone: "",
        basePayType: "hourly",
        dailyRate: 0,
        hourlyRate: 11.58,
        overtimeRate: 11.58,
        fixedPay: 0,
        standardDays: 0,
        standardHours: 47.5,
        templateId: "tpl-manual",
        active: true,
        notes: ""
      },
      {
        id: "emp-dawneil",
        fullName: "Dawneil Gordon",
        role: "Multi-site cleaner",
        defaultSite: "Harney's / AGC / SSB / Donald",
        phone: "",
        basePayType: "fixed",
        dailyRate: 0,
        hourlyRate: 0,
        overtimeRate: 0,
        fixedPay: 460,
        standardDays: 0,
        standardHours: 0,
        templateId: "tpl-manual",
        active: true,
        notes: ""
      }
    ],
    timeEntries: [
      {
        id: "entry-damian-2026-03",
        employeeId: "emp-damian",
        month: "2026-03",
        site: "Harney's",
        status: "submitted",
        daysWorked: 21,
        hoursWorked: 63,
        overtimeHours: 0,
        flatGross: 0,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: "tpl-taxed",
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: true,
        notes: "Night shift sample entry."
      },
      {
        id: "entry-jody-2026-03",
        employeeId: "emp-jody",
        month: "2026-03",
        site: "Harney's / Police / Flow / Carpet",
        status: "approved",
        daysWorked: 20,
        hoursWorked: 60,
        overtimeHours: 0,
        flatGross: 910,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: "tpl-manual",
        applyNhi: false,
        applySsb: false,
        applyIncomeTax: false,
        notes: "Mixed site manual total."
      },
      {
        id: "entry-nadine-2026-03",
        employeeId: "emp-nadine",
        month: "2026-03",
        site: "Republic Bank",
        status: "submitted",
        daysWorked: 20,
        hoursWorked: 0,
        overtimeHours: 0,
        flatGross: 0,
        bonus: 50,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: "tpl-taxed",
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: true,
        notes: "Monthly sample row with bonus."
      },
      {
        id: "entry-akeisha-2026-03",
        employeeId: "emp-akeisha",
        month: "2026-03",
        site: "Republic Bank",
        status: "draft",
        daysWorked: 20,
        hoursWorked: 0,
        overtimeHours: 0,
        flatGross: 0,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: "tpl-taxed",
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: true,
        notes: ""
      },
      {
        id: "entry-michael-2026-03",
        employeeId: "emp-michael",
        month: "2026-03",
        site: "AGC",
        status: "approved",
        daysWorked: 0,
        hoursWorked: 47.5,
        overtimeHours: 0,
        flatGross: 0,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: "tpl-manual",
        applyNhi: false,
        applySsb: false,
        applyIncomeTax: false,
        notes: ""
      },
      {
        id: "entry-dawneil-2026-03",
        employeeId: "emp-dawneil",
        month: "2026-03",
        site: "Harney's / AGC / SSB / Donald",
        status: "approved",
        daysWorked: 0,
        hoursWorked: 0,
        overtimeHours: 0,
        flatGross: 0,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: "tpl-manual",
        applyNhi: false,
        applySsb: false,
        applyIncomeTax: false,
        notes: ""
      }
    ],
    payrollRuns: [
      {
        id: "run-2026-02",
        month: "2026-02",
        createdAt: "2026-03-01T09:15:00",
        status: "paid",
        paidAt: "2026-03-02T11:00:00",
        totals: { employees: 5, gross: 3285, deductions: 185.25, net: 3099.75 },
        items: [
          { employeeId: "emp-damian", employeeName: "Damian Harney", sites: "Harney's", gross: 600, deductions: 94.5, net: 505.5, status: "paid" },
          { employeeId: "emp-jody", employeeName: "Jody Lewis", sites: "Harney's / Police", gross: 810, deductions: 0, net: 810, status: "paid" },
          { employeeId: "emp-nadine", employeeName: "Nadine Tadian", sites: "Republic Bank", gross: 400, deductions: 63, net: 337, status: "paid" },
          { employeeId: "emp-michael", employeeName: "Michael Blackwood", sites: "AGC", gross: 515, deductions: 0, net: 515, status: "paid" },
          { employeeId: "emp-dawneil", employeeName: "Dawneil Gordon", sites: "Harney's / AGC / SSB / Donald", gross: 460, deductions: 27.75, net: 432.25, status: "paid" }
        ]
      }
    ]
  };

  let state = loadState();
  const ui = {
    activeView: "overviewView",
    selectedRunId: state.payrollRuns[0] ? state.payrollRuns[0].id : null,
    installPrompt: null,
    toastTimer: null
  };

  const els = {
    monthFocus: document.getElementById("monthFocus"),
    createDraftButton: document.getElementById("createDraftButton"),
    openEntryButton: document.getElementById("openEntryButton"),
    openEmployeeButton: document.getElementById("openEmployeeButton"),
    installAppButton: document.getElementById("installAppButton"),
    exportBackupButton: document.getElementById("exportBackupButton"),
    importDataInput: document.getElementById("importDataInput"),
    tabButtons: Array.from(document.querySelectorAll(".tab-button")),
    views: Array.from(document.querySelectorAll(".view")),
    jumpToTimesheetsButton: document.getElementById("jumpToTimesheetsButton"),
    jumpToPayrollButton: document.getElementById("jumpToPayrollButton"),
    overviewTitle: document.getElementById("overviewTitle"),
    overviewSummary: document.getElementById("overviewSummary"),
    metricGrid: document.getElementById("metricGrid"),
    attentionList: document.getElementById("attentionList"),
    siteList: document.getElementById("siteList"),
    runStatusList: document.getElementById("runStatusList"),
    timesheetSearchInput: document.getElementById("timesheetSearchInput"),
    timesheetStatusFilter: document.getElementById("timesheetStatusFilter"),
    addTimesheetButton: document.getElementById("addTimesheetButton"),
    timesheetList: document.getElementById("timesheetList"),
    employeeSearchInput: document.getElementById("employeeSearchInput"),
    addEmployeeButton: document.getElementById("addEmployeeButton"),
    employeeList: document.getElementById("employeeList"),
    payrollSummary: document.getElementById("payrollSummary"),
    payrollTableWrap: document.getElementById("payrollTableWrap"),
    finalizePayrollButton: document.getElementById("finalizePayrollButton"),
    markPaidButton: document.getElementById("markPaidButton"),
    downloadCsvButton: document.getElementById("downloadCsvButton"),
    printPayrollButton: document.getElementById("printPayrollButton"),
    historyRunList: document.getElementById("historyRunList"),
    historyRunDetail: document.getElementById("historyRunDetail"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    employeeModal: document.getElementById("employeeModal"),
    employeeModalTitle: document.getElementById("employeeModalTitle"),
    employeeForm: document.getElementById("employeeForm"),
    employeeId: document.getElementById("employeeId"),
    employeeName: document.getElementById("employeeName"),
    employeeRole: document.getElementById("employeeRole"),
    employeeSite: document.getElementById("employeeSite"),
    employeePhone: document.getElementById("employeePhone"),
    employeePayType: document.getElementById("employeePayType"),
    employeeDailyRate: document.getElementById("employeeDailyRate"),
    employeeHourlyRate: document.getElementById("employeeHourlyRate"),
    employeeOvertimeRate: document.getElementById("employeeOvertimeRate"),
    employeeFixedPay: document.getElementById("employeeFixedPay"),
    employeeStandardDays: document.getElementById("employeeStandardDays"),
    employeeStandardHours: document.getElementById("employeeStandardHours"),
    employeeTemplateId: document.getElementById("employeeTemplateId"),
    employeeActive: document.getElementById("employeeActive"),
    employeeNotes: document.getElementById("employeeNotes"),
    entryModal: document.getElementById("entryModal"),
    entryModalTitle: document.getElementById("entryModalTitle"),
    timeEntryForm: document.getElementById("timeEntryForm"),
    timeEntryId: document.getElementById("timeEntryId"),
    entryEmployeeId: document.getElementById("entryEmployeeId"),
    entryMonth: document.getElementById("entryMonth"),
    entrySite: document.getElementById("entrySite"),
    entryStatus: document.getElementById("entryStatus"),
    entryDaysWorked: document.getElementById("entryDaysWorked"),
    entryHoursWorked: document.getElementById("entryHoursWorked"),
    entryOvertimeHours: document.getElementById("entryOvertimeHours"),
    entryFlatGross: document.getElementById("entryFlatGross"),
    entryBonus: document.getElementById("entryBonus"),
    entryAllowance: document.getElementById("entryAllowance"),
    entryAdvanceDeduction: document.getElementById("entryAdvanceDeduction"),
    entryWithdrawalDeduction: document.getElementById("entryWithdrawalDeduction"),
    entryLoanDeduction: document.getElementById("entryLoanDeduction"),
    entryOtherDeduction: document.getElementById("entryOtherDeduction"),
    entryTemplateId: document.getElementById("entryTemplateId"),
    entryApplyNhi: document.getElementById("entryApplyNhi"),
    entryApplySsb: document.getElementById("entryApplySsb"),
    entryApplyIncomeTax: document.getElementById("entryApplyIncomeTax"),
    entryNotes: document.getElementById("entryNotes"),
    entryPreview: document.getElementById("entryPreview"),
    closeButtons: Array.from(document.querySelectorAll("[data-close-modal]")),
    toast: document.getElementById("toast")
  };

  init();

  function init() {
    populateTemplateOptions();
    populateEmployeeOptions();
    bindEvents();
    resetEmployeeForm();
    resetEntryForm();
    render();
    registerServiceWorker();
  }

  function bindEvents() {
    els.monthFocus.addEventListener("change", function () {
      state.settings.focusMonth = els.monthFocus.value || state.settings.focusMonth;
      saveState();
      resetEntryForm();
      render();
    });

    els.tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.viewTarget);
      });
    });

    els.jumpToTimesheetsButton.addEventListener("click", function () {
      setView("timesheetsView");
    });

    els.jumpToPayrollButton.addEventListener("click", function () {
      setView("payrollView");
    });

    els.openEntryButton.addEventListener("click", function () {
      openEntryModal();
    });

    els.addTimesheetButton.addEventListener("click", function () {
      openEntryModal();
    });

    els.openEmployeeButton.addEventListener("click", function () {
      openEmployeeModal();
    });

    els.addEmployeeButton.addEventListener("click", function () {
      openEmployeeModal();
    });

    els.createDraftButton.addEventListener("click", createDraftMonth);
    els.exportBackupButton.addEventListener("click", exportBackup);
    els.importDataInput.addEventListener("change", importBackup);
    els.installAppButton.addEventListener("click", installApp);

    els.timesheetSearchInput.addEventListener("input", renderTimesheets);
    els.timesheetStatusFilter.addEventListener("change", renderTimesheets);
    els.employeeSearchInput.addEventListener("input", renderEmployees);

    els.employeeForm.addEventListener("submit", handleEmployeeSubmit);
    els.timeEntryForm.addEventListener("submit", handleTimeEntrySubmit);

    els.employeeList.addEventListener("click", handleEmployeeListActions);
    els.timesheetList.addEventListener("click", handleTimesheetListActions);

    els.finalizePayrollButton.addEventListener("click", finalizePayrollRun);
    els.markPaidButton.addEventListener("click", markPayrollPaid);
    els.downloadCsvButton.addEventListener("click", downloadPayrollCsv);
    els.printPayrollButton.addEventListener("click", function () {
      setView("payrollView");
      window.print();
    });

    els.historyRunList.addEventListener("click", function (event) {
      const button = event.target.closest("[data-run-id]");
      if (!button) {
        return;
      }
      ui.selectedRunId = button.dataset.runId;
      renderHistory();
    });

    els.entryEmployeeId.addEventListener("change", function () {
      applyEmployeeDefaultsToEntry({ ifNewOnly: !els.timeEntryId.value });
      renderEntryPreview();
    });

    els.entryTemplateId.addEventListener("change", function () {
      applyTemplateDefaultsToEntry();
      renderEntryPreview();
    });

    [
      els.entryEmployeeId,
      els.entryMonth,
      els.entrySite,
      els.entryStatus,
      els.entryDaysWorked,
      els.entryHoursWorked,
      els.entryOvertimeHours,
      els.entryFlatGross,
      els.entryBonus,
      els.entryAllowance,
      els.entryAdvanceDeduction,
      els.entryWithdrawalDeduction,
      els.entryLoanDeduction,
      els.entryOtherDeduction,
      els.entryTemplateId,
      els.entryApplyNhi,
      els.entryApplySsb,
      els.entryApplyIncomeTax,
      els.entryNotes
    ].forEach(function (field) {
      field.addEventListener("input", renderEntryPreview);
      field.addEventListener("change", renderEntryPreview);
    });

    els.closeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        closeModal(button.dataset.closeModal);
      });
    });

    els.modalBackdrop.addEventListener("click", closeAllModals);

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllModals();
      }
    });

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      ui.installPrompt = event;
      els.installAppButton.classList.remove("hidden");
    });
  }

  function render() {
    els.monthFocus.value = state.settings.focusMonth;
    renderTabs();
    renderOverview();
    renderTimesheets();
    renderEmployees();
    renderPayroll();
    renderHistory();
  }

  function renderTabs() {
    els.views.forEach(function (view) {
      view.classList.toggle("active", view.id === ui.activeView);
    });

    els.tabButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.viewTarget === ui.activeView);
    });
  }

  function setView(viewId) {
    ui.activeView = viewId;
    renderTabs();
  }

  function renderOverview() {
    const month = state.settings.focusMonth;
    const preview = buildPayrollPreview(month);
    const activeEmployees = getActiveEmployees();
    const entries = getEntriesForMonth(month);
    const run = getPayrollRunForMonth(month);
    const missing = activeEmployees.filter(function (employee) {
      return !entries.some(function (entry) { return entry.employeeId === employee.id; });
    });
    const draftCount = entries.filter(function (entry) { return entry.status === "draft"; }).length;
    const submittedCount = entries.filter(function (entry) { return entry.status === "submitted"; }).length;

    els.overviewTitle.textContent = formatMonth(month);
    els.overviewSummary.textContent = preview.items.length
      ? "This month currently includes " + preview.items.length + " payroll lines with an expected net payout of " + formatCurrency(preview.totals.net) + "."
      : "No timesheets exist yet for this month. Create a draft month or add a timesheet to begin payroll.";

    els.metricGrid.innerHTML = [
      metricCard("Active employees", activeEmployees.length, missing.length + " still need timesheets"),
      metricCard("Timesheets entered", entries.length, draftCount + " still in draft"),
      metricCard("Gross payroll", formatCurrency(preview.totals.gross), preview.items.length + " payroll lines"),
      metricCard("Net payroll", formatCurrency(preview.totals.net), run ? "Run status: " + capitalize(run.status) : "Preview only")
    ].join("");

    const attention = [];
    if (missing.length) {
      attention.push(stackItem("Missing timesheets", missing.map(function (employee) { return employee.fullName; }).join(", ")));
    }
    if (draftCount) {
      attention.push(stackItem("Drafts to review", draftCount + " timesheets are still in draft."));
    }
    if (submittedCount) {
      attention.push(stackItem("Awaiting approval", submittedCount + " timesheets were submitted and should be reviewed."));
    }
    if (!run && preview.items.length) {
      attention.push(stackItem("Run not finalized", "The payroll preview is ready, but no run has been saved yet."));
    }
    if (!attention.length) {
      attention.push(stackItem("Everything is on track", "No urgent follow-up is blocking this payroll cycle."));
    }
    els.attentionList.innerHTML = attention.join("");

    if (!preview.siteTotals.length) {
      els.siteList.innerHTML = emptyState("Site cost totals will appear once timesheets are entered.");
    } else {
      els.siteList.innerHTML = preview.siteTotals.slice(0, 6).map(function (site) {
        return stackItem(site.site, formatCurrency(site.gross) + " gross across " + site.entries + " entr" + (site.entries === 1 ? "y" : "ies"));
      }).join("");
    }

    const runStatus = [];
    if (run) {
      runStatus.push(stackItem("Saved payroll run", formatMonth(run.month) + " is saved with status " + capitalize(run.status) + "."));
      runStatus.push(stackItem("Employees in run", run.totals.employees + " employees totaling " + formatCurrency(run.totals.net) + " net."));
      if (run.paidAt) {
        runStatus.push(stackItem("Paid date", formatDate(run.paidAt)));
      }
    } else {
      runStatus.push(stackItem("No saved run yet", "Use Finalize run after reviewing the payroll register."));
      runStatus.push(stackItem("Preview totals", formatCurrency(preview.totals.gross) + " gross and " + formatCurrency(preview.totals.net) + " net."));
    }
    els.runStatusList.innerHTML = runStatus.join("");
  }

  function renderTimesheets() {
    const search = (els.timesheetSearchInput.value || "").trim().toLowerCase();
    const statusFilter = els.timesheetStatusFilter.value;

    const entries = getEntriesForMonth(state.settings.focusMonth)
      .slice()
      .sort(function (a, b) {
        return getEmployeeName(a.employeeId).localeCompare(getEmployeeName(b.employeeId));
      })
      .filter(function (entry) {
        const matchesSearch = !search || [getEmployeeName(entry.employeeId), entry.site, entry.notes].join(" ").toLowerCase().includes(search);
        const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
        return matchesSearch && matchesStatus;
      });

    if (!entries.length) {
      els.timesheetList.innerHTML = emptyState("No timesheets match the current month and filters.");
      return;
    }

    els.timesheetList.innerHTML = entries.map(function (entry) {
      const employee = getEmployee(entry.employeeId);
      const calc = calculateEntry(entry);
      return [
        '<article class="record-card">',
        '<div class="record-header">',
        '<div>',
        '<div class="record-title">' + escapeHtml(employee ? employee.fullName : "Unknown employee") + "</div>",
        '<p class="record-meta">' + escapeHtml(entry.site || (employee && employee.defaultSite) || "No site") + " • " + formatMonth(entry.month) + "</p>",
        "</div>",
        '<span class="pill status-' + escapeHtml(entry.status) + '">' + escapeHtml(capitalize(entry.status)) + "</span>",
        "</div>",
        '<div class="pill-row">',
        '<span class="pill">' + escapeHtml((entry.daysWorked || 0) + " days") + "</span>",
        '<span class="pill">' + escapeHtml((entry.hoursWorked || 0) + " hours") + "</span>",
        '<span class="pill">' + escapeHtml((entry.overtimeHours || 0) + " OT hours") + "</span>",
        "</div>",
        '<div class="amount-grid">',
        amountBox("Gross", formatCurrency(calc.gross)),
        amountBox("Deductions", formatCurrency(calc.totalDeductions)),
        amountBox("Net", formatCurrency(calc.net)),
        "</div>",
        '<p class="record-meta">' + escapeHtml(entry.notes || "No notes") + "</p>",
        '<div class="record-actions">',
        '<button class="mini-button" type="button" data-action="edit-timesheet" data-id="' + entry.id + '">Edit</button>',
        '<button class="mini-button danger-button" type="button" data-action="delete-timesheet" data-id="' + entry.id + '">Delete</button>',
        "</div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderEmployees() {
    const search = (els.employeeSearchInput.value || "").trim().toLowerCase();
    const employees = state.employees
      .slice()
      .sort(function (a, b) { return a.fullName.localeCompare(b.fullName); })
      .filter(function (employee) {
        return !search || [employee.fullName, employee.role, employee.defaultSite].join(" ").toLowerCase().includes(search);
      });

    if (!employees.length) {
      els.employeeList.innerHTML = emptyState("No employees match your search.");
      return;
    }

    els.employeeList.innerHTML = employees.map(function (employee) {
      const template = getTemplate(employee.templateId);
      return [
        '<article class="record-card">',
        '<div class="record-header">',
        '<div>',
        '<div class="record-title">' + escapeHtml(employee.fullName) + "</div>",
        '<p class="record-meta">' + escapeHtml(employee.role || "No role set") + " • " + escapeHtml(employee.defaultSite || "No site") + "</p>",
        "</div>",
        '<span class="pill status-' + (employee.active ? "approved" : "draft") + '">' + (employee.active ? "Active" : "Paused") + "</span>",
        "</div>",
        '<div class="pill-row">',
        '<span class="pill">' + escapeHtml(describePay(employee)) + "</span>",
        '<span class="pill">' + escapeHtml(template ? template.name : "No deductions template") + "</span>",
        "</div>",
        '<p class="record-meta">' + escapeHtml(employee.notes || "Ready for payroll use.") + "</p>",
        '<div class="record-actions">',
        '<button class="mini-button" type="button" data-action="edit-employee" data-id="' + employee.id + '">Edit</button>',
        '<button class="mini-button" type="button" data-action="toggle-employee" data-id="' + employee.id + '">' + (employee.active ? "Pause" : "Activate") + "</button>',
        "</div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderPayroll() {
    const month = state.settings.focusMonth;
    const preview = buildPayrollPreview(month);
    const run = getPayrollRunForMonth(month);

    els.payrollSummary.innerHTML = [
      metricCard("Employees", preview.items.length, run ? "Saved run available" : "Preview only"),
      metricCard("Gross total", formatCurrency(preview.totals.gross), "Before deductions"),
      metricCard("Deductions", formatCurrency(preview.totals.deductions), "Automatic and manual"),
      metricCard("Net total", formatCurrency(preview.totals.net), run ? "Status: " + capitalize(run.status) : "Ready to finalize")
    ].join("");

    if (!preview.items.length) {
      els.payrollTableWrap.innerHTML = emptyState("No payroll items are ready for this month.");
    } else {
      els.payrollTableWrap.innerHTML = [
        '<table class="payroll-table">',
        "<thead><tr><th>Employee</th><th>Sites</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead>",
        "<tbody>",
        preview.items.map(function (item) {
          return [
            "<tr>",
            "<td><strong>" + escapeHtml(item.employeeName) + "</strong><br><span class=\"record-meta\">" + escapeHtml(item.entryCount + " entr" + (item.entryCount === 1 ? "y" : "ies")) + "</span></td>",
            "<td>" + escapeHtml(item.sites) + "</td>",
            "<td>" + formatCurrency(item.gross) + "</td>",
            "<td>" + formatCurrency(item.deductions) + "</td>",
            "<td>" + formatCurrency(item.net) + "</td>",
            '<td><span class="pill status-' + escapeHtml(item.status) + '">' + escapeHtml(capitalize(item.status)) + "</span></td>",
            "</tr>"
          ].join("");
        }).join(""),
        "</tbody></table>"
      ].join("");
    }

    els.finalizePayrollButton.disabled = !preview.items.length;
    els.markPaidButton.disabled = !(run && run.status !== "paid");
  }

  function renderHistory() {
    const runs = state.payrollRuns.slice().sort(function (a, b) {
      return b.month.localeCompare(a.month);
    });

    if (!runs.length) {
      els.historyRunList.innerHTML = emptyState("No payroll runs have been saved yet.");
      els.historyRunDetail.innerHTML = emptyState("Finalize a month to capture its payroll history.");
      return;
    }

    if (!runs.some(function (run) { return run.id === ui.selectedRunId; })) {
      ui.selectedRunId = runs[0].id;
    }

    els.historyRunList.innerHTML = runs.map(function (run) {
      return [
        '<article class="record-card">',
        '<div class="record-header">',
        '<div>',
        '<div class="record-title">' + formatMonth(run.month) + "</div>",
        '<p class="record-meta">' + formatCurrency(run.totals.net) + " net • " + run.totals.employees + " employees</p>",
        "</div>",
        '<span class="pill status-' + escapeHtml(run.status) + '">' + escapeHtml(capitalize(run.status)) + "</span>",
        "</div>",
        '<div class="record-actions">',
        '<button class="mini-button" type="button" data-run-id="' + run.id + '">View detail</button>',
        "</div>",
        "</article>"
      ].join("");
    }).join("");

    const selectedRun = runs.find(function (run) { return run.id === ui.selectedRunId; });
    if (!selectedRun) {
      els.historyRunDetail.innerHTML = emptyState("Select a payroll run to see the snapshot.");
      return;
    }

    els.historyRunDetail.innerHTML = [
      '<div class="pill-row">',
      '<span class="pill">Created ' + formatDate(selectedRun.createdAt) + "</span>",
      '<span class="pill">Status: ' + escapeHtml(capitalize(selectedRun.status)) + "</span>",
      selectedRun.paidAt ? '<span class="pill">Paid ' + formatDate(selectedRun.paidAt) + "</span>" : "",
      "</div>",
      '<div class="amount-grid">',
      amountBox("Gross", formatCurrency(selectedRun.totals.gross)),
      amountBox("Deductions", formatCurrency(selectedRun.totals.deductions)),
      amountBox("Net", formatCurrency(selectedRun.totals.net)),
      "</div>",
      '<div class="table-wrap">',
      '<table class="payroll-table">',
      "<thead><tr><th>Employee</th><th>Sites</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead>",
      "<tbody>",
      selectedRun.items.map(function (item) {
        return "<tr><td>" + escapeHtml(item.employeeName) + "</td><td>" + escapeHtml(item.sites) + "</td><td>" + formatCurrency(item.gross) + "</td><td>" + formatCurrency(item.deductions) + "</td><td>" + formatCurrency(item.net) + "</td></tr>";
      }).join(""),
      "</tbody></table>",
      "</div>"
    ].join("");
  }

  function openEmployeeModal(employeeId) {
    populateTemplateOptions();
    if (employeeId) {
      const employee = getEmployee(employeeId);
      if (!employee) {
        return;
      }
      populateEmployeeForm(employee);
    } else {
      resetEmployeeForm();
    }
    openModal("employeeModal");
  }

  function openEntryModal(entryId) {
    populateEmployeeOptions();
    populateTemplateOptions();
    if (entryId) {
      const entry = getTimeEntry(entryId);
      if (!entry) {
        return;
      }
      populateEntryForm(entry);
    } else {
      resetEntryForm();
    }
    renderEntryPreview();
    openModal("entryModal");
  }

  function openModal(modalId) {
    els.modalBackdrop.classList.remove("hidden");
    els[modalId].classList.remove("hidden");
    els[modalId].setAttribute("aria-hidden", "false");
  }

  function closeModal(modalId) {
    const modal = els[modalId];
    if (!modal) {
      return;
    }
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    if (els.employeeModal.classList.contains("hidden") && els.entryModal.classList.contains("hidden")) {
      els.modalBackdrop.classList.add("hidden");
    }
  }

  function closeAllModals() {
    closeModal("employeeModal");
    closeModal("entryModal");
  }

  function handleEmployeeListActions(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const employee = getEmployee(button.dataset.id);
    if (!employee) {
      return;
    }

    if (button.dataset.action === "edit-employee") {
      openEmployeeModal(employee.id);
      return;
    }

    if (button.dataset.action === "toggle-employee") {
      employee.active = !employee.active;
      saveState();
      render();
      showToast(employee.fullName + (employee.active ? " activated." : " paused."));
    }
  }

  function handleTimesheetListActions(event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const entry = getTimeEntry(button.dataset.id);
    if (!entry) {
      return;
    }

    if (button.dataset.action === "edit-timesheet") {
      openEntryModal(entry.id);
      return;
    }

    if (button.dataset.action === "delete-timesheet") {
      const confirmed = window.confirm("Delete this timesheet?");
      if (!confirmed) {
        return;
      }
      state.timeEntries = state.timeEntries.filter(function (item) { return item.id !== entry.id; });
      saveState();
      render();
      showToast("Timesheet deleted.");
    }
  }

  function handleEmployeeSubmit(event) {
    event.preventDefault();

    const employee = {
      id: els.employeeId.value || uid("emp"),
      fullName: els.employeeName.value.trim(),
      role: els.employeeRole.value.trim(),
      defaultSite: els.employeeSite.value.trim(),
      phone: els.employeePhone.value.trim(),
      basePayType: els.employeePayType.value,
      dailyRate: toNumber(els.employeeDailyRate.value),
      hourlyRate: toNumber(els.employeeHourlyRate.value),
      overtimeRate: toNumber(els.employeeOvertimeRate.value),
      fixedPay: toNumber(els.employeeFixedPay.value),
      standardDays: toNumber(els.employeeStandardDays.value),
      standardHours: toNumber(els.employeeStandardHours.value),
      templateId: els.employeeTemplateId.value,
      active: els.employeeActive.checked,
      notes: els.employeeNotes.value.trim()
    };

    const existingIndex = state.employees.findIndex(function (item) { return item.id === employee.id; });
    if (existingIndex >= 0) {
      state.employees[existingIndex] = employee;
    } else {
      state.employees.push(employee);
    }

    saveState();
    populateEmployeeOptions();
    render();
    closeModal("employeeModal");
    showToast(employee.fullName + " saved.");
  }

  function handleTimeEntrySubmit(event) {
    event.preventDefault();
    const entry = readEntryForm();

    if (!entry.employeeId) {
      window.alert("Please choose an employee.");
      return;
    }

    const existingIndex = state.timeEntries.findIndex(function (item) { return item.id === entry.id; });
    if (existingIndex >= 0) {
      state.timeEntries[existingIndex] = entry;
    } else {
      state.timeEntries.push(entry);
    }

    saveState();
    render();
    closeModal("entryModal");
    showToast("Timesheet saved.");
  }

  function populateEmployeeForm(employee) {
    els.employeeModalTitle.textContent = "Edit employee";
    els.employeeId.value = employee.id;
    els.employeeName.value = employee.fullName;
    els.employeeRole.value = employee.role || "";
    els.employeeSite.value = employee.defaultSite || "";
    els.employeePhone.value = employee.phone || "";
    els.employeePayType.value = employee.basePayType || "daily";
    els.employeeDailyRate.value = employee.dailyRate || 0;
    els.employeeHourlyRate.value = employee.hourlyRate || 0;
    els.employeeOvertimeRate.value = employee.overtimeRate || 0;
    els.employeeFixedPay.value = employee.fixedPay || 0;
    els.employeeStandardDays.value = employee.standardDays || 0;
    els.employeeStandardHours.value = employee.standardHours || 0;
    els.employeeTemplateId.value = employee.templateId || state.deductionTemplates[0].id;
    els.employeeActive.checked = employee.active !== false;
    els.employeeNotes.value = employee.notes || "";
  }

  function resetEmployeeForm() {
    els.employeeModalTitle.textContent = "New employee";
    els.employeeForm.reset();
    els.employeeId.value = "";
    els.employeeActive.checked = true;
    els.employeePayType.value = "daily";
    els.employeeDailyRate.value = 0;
    els.employeeHourlyRate.value = 0;
    els.employeeOvertimeRate.value = 0;
    els.employeeFixedPay.value = 0;
    els.employeeStandardDays.value = 20;
    els.employeeStandardHours.value = 0;
    els.employeeTemplateId.value = state.deductionTemplates[0] ? state.deductionTemplates[0].id : "";
  }

  function populateEntryForm(entry) {
    els.entryModalTitle.textContent = "Edit timesheet";
    els.timeEntryId.value = entry.id;
    els.entryEmployeeId.value = entry.employeeId;
    els.entryMonth.value = entry.month;
    els.entrySite.value = entry.site || "";
    els.entryStatus.value = entry.status;
    els.entryDaysWorked.value = entry.daysWorked || 0;
    els.entryHoursWorked.value = entry.hoursWorked || 0;
    els.entryOvertimeHours.value = entry.overtimeHours || 0;
    els.entryFlatGross.value = entry.flatGross || 0;
    els.entryBonus.value = entry.bonus || 0;
    els.entryAllowance.value = entry.allowance || 0;
    els.entryAdvanceDeduction.value = entry.advanceDeduction || 0;
    els.entryWithdrawalDeduction.value = entry.withdrawalDeduction || 0;
    els.entryLoanDeduction.value = entry.loanDeduction || 0;
    els.entryOtherDeduction.value = entry.otherDeduction || 0;
    els.entryTemplateId.value = entry.templateId || getEmployee(entry.employeeId).templateId;
    els.entryApplyNhi.checked = !!entry.applyNhi;
    els.entryApplySsb.checked = !!entry.applySsb;
    els.entryApplyIncomeTax.checked = !!entry.applyIncomeTax;
    els.entryNotes.value = entry.notes || "";
  }

  function resetEntryForm() {
    els.entryModalTitle.textContent = "New timesheet";
    els.timeEntryForm.reset();
    els.timeEntryId.value = "";
    els.entryMonth.value = state.settings.focusMonth;
    els.entryStatus.value = "draft";
    const firstEmployee = getActiveEmployees()[0] || state.employees[0];
    if (firstEmployee) {
      els.entryEmployeeId.value = firstEmployee.id;
      applyEmployeeDefaultsToEntry({ ifNewOnly: false });
    }
    renderEntryPreview();
  }

  function applyEmployeeDefaultsToEntry(options) {
    const employee = getEmployee(els.entryEmployeeId.value);
    if (!employee) {
      return;
    }
    if (options && options.ifNewOnly && els.timeEntryId.value) {
      return;
    }
    els.entrySite.value = employee.defaultSite || "";
    els.entryTemplateId.value = employee.templateId || "";
    els.entryDaysWorked.value = employee.standardDays || 0;
    els.entryHoursWorked.value = employee.standardHours || 0;
    applyTemplateDefaultsToEntry();
  }

  function applyTemplateDefaultsToEntry() {
    const template = getTemplate(els.entryTemplateId.value);
    if (!template) {
      return;
    }
    els.entryApplyNhi.checked = !!template.defaults.applyNhi;
    els.entryApplySsb.checked = !!template.defaults.applySsb;
    els.entryApplyIncomeTax.checked = !!template.defaults.applyIncomeTax;
  }

  function readEntryForm() {
    return {
      id: els.timeEntryId.value || uid("entry"),
      employeeId: els.entryEmployeeId.value,
      month: els.entryMonth.value || state.settings.focusMonth,
      site: els.entrySite.value.trim(),
      status: els.entryStatus.value,
      daysWorked: toNumber(els.entryDaysWorked.value),
      hoursWorked: toNumber(els.entryHoursWorked.value),
      overtimeHours: toNumber(els.entryOvertimeHours.value),
      flatGross: toNumber(els.entryFlatGross.value),
      bonus: toNumber(els.entryBonus.value),
      allowance: toNumber(els.entryAllowance.value),
      advanceDeduction: toNumber(els.entryAdvanceDeduction.value),
      withdrawalDeduction: toNumber(els.entryWithdrawalDeduction.value),
      loanDeduction: toNumber(els.entryLoanDeduction.value),
      otherDeduction: toNumber(els.entryOtherDeduction.value),
      templateId: els.entryTemplateId.value,
      applyNhi: els.entryApplyNhi.checked,
      applySsb: els.entryApplySsb.checked,
      applyIncomeTax: els.entryApplyIncomeTax.checked,
      notes: els.entryNotes.value.trim()
    };
  }

  function renderEntryPreview() {
    const employee = getEmployee(els.entryEmployeeId.value);
    if (!employee) {
      els.entryPreview.innerHTML = emptyState("Choose an employee to preview payroll calculations.");
      return;
    }
    const preview = calculateEntry(readEntryForm());
    els.entryPreview.innerHTML = [
      '<div class="record-card">',
      '<div class="record-title">' + escapeHtml(employee.fullName) + "</div>",
      '<p class="record-meta">' + escapeHtml(els.entrySite.value || employee.defaultSite || "No site") + "</p>",
      '<div class="amount-grid">',
      amountBox("Gross", formatCurrency(preview.gross)),
      amountBox("Deductions", formatCurrency(preview.totalDeductions)),
      amountBox("Net", formatCurrency(preview.net)),
      "</div>",
      '<div class="pill-row">',
      '<span class="pill">NHI ' + formatCurrency(preview.breakdown.nhi) + "</span>",
      '<span class="pill">SSB ' + formatCurrency(preview.breakdown.ssb) + "</span>",
      '<span class="pill">Tax ' + formatCurrency(preview.breakdown.incomeTax) + "</span>",
      '<span class="pill">Manual ' + formatCurrency(preview.breakdown.manual) + "</span>",
      "</div>",
      "</div>"
    ].join("");
  }

  function createDraftMonth() {
    const month = state.settings.focusMonth;
    const employees = getActiveEmployees();
    let created = 0;

    employees.forEach(function (employee) {
      const exists = state.timeEntries.some(function (entry) {
        return entry.month === month && entry.employeeId === employee.id;
      });
      if (exists) {
        return;
      }
      const template = getTemplate(employee.templateId);
      state.timeEntries.push({
        id: uid("entry"),
        employeeId: employee.id,
        month: month,
        site: employee.defaultSite || "",
        status: "draft",
        daysWorked: employee.standardDays || 0,
        hoursWorked: employee.standardHours || 0,
        overtimeHours: 0,
        flatGross: 0,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId: employee.templateId,
        applyNhi: !!(template && template.defaults.applyNhi),
        applySsb: !!(template && template.defaults.applySsb),
        applyIncomeTax: !!(template && template.defaults.applyIncomeTax),
        notes: ""
      });
      created += 1;
    });

    saveState();
    render();
    setView("timesheetsView");
    showToast(created ? "Created " + created + " draft timesheet" + (created === 1 ? "." : "s.") : "All active employees already have timesheets for this month.");
  }

  function finalizePayrollRun() {
    const month = state.settings.focusMonth;
    const preview = buildPayrollPreview(month);
    if (!preview.items.length) {
      window.alert("No payroll items are ready for this month.");
      return;
    }
    if (!window.confirm("Finalize payroll for " + formatMonth(month) + "?")) {
      return;
    }

    const existingRun = getPayrollRunForMonth(month);
    const run = {
      id: existingRun ? existingRun.id : uid("run"),
      month: month,
      createdAt: new Date().toISOString(),
      status: "approved",
      paidAt: "",
      totals: {
        employees: preview.items.length,
        gross: preview.totals.gross,
        deductions: preview.totals.deductions,
        net: preview.totals.net
      },
      items: preview.items.map(function (item) {
        return {
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          sites: item.sites,
          gross: item.gross,
          deductions: item.deductions,
          net: item.net,
          status: "approved"
        };
      })
    };

    const existingIndex = state.payrollRuns.findIndex(function (item) { return item.month === month; });
    if (existingIndex >= 0) {
      state.payrollRuns[existingIndex] = run;
    } else {
      state.payrollRuns.push(run);
    }

    state.timeEntries = state.timeEntries.map(function (entry) {
      if (entry.month !== month) {
        return entry;
      }
      return Object.assign({}, entry, {
        status: entry.status === "paid" ? "paid" : "approved"
      });
    });

    ui.selectedRunId = run.id;
    saveState();
    render();
    setView("historyView");
    showToast("Payroll run finalized.");
  }

  function markPayrollPaid() {
    const run = getPayrollRunForMonth(state.settings.focusMonth);
    if (!run) {
      window.alert("Finalize the payroll run first.");
      return;
    }

    run.status = "paid";
    run.paidAt = new Date().toISOString();
    run.items = run.items.map(function (item) {
      return Object.assign({}, item, { status: "paid" });
    });

    state.timeEntries = state.timeEntries.map(function (entry) {
      if (entry.month !== state.settings.focusMonth) {
        return entry;
      }
      return Object.assign({}, entry, { status: "paid" });
    });

    saveState();
    render();
    showToast("Payroll marked as paid.");
  }

  function downloadPayrollCsv() {
    const month = state.settings.focusMonth;
    const data = getPayrollRunForMonth(month) || buildPayrollPreview(month);
    const items = data.items || [];

    if (!items.length) {
      window.alert("There is no payroll data to export for this month.");
      return;
    }

    const csv = [
      ["Employee", "Sites", "Gross", "Deductions", "Net", "Status"].join(","),
      items.map(function (item) {
        return [item.employeeName, item.sites, item.gross, item.deductions, item.net, item.status].map(csvCell).join(",");
      }).join("\n")
    ].join("\n");

    downloadFile(csv, "kleentoditee-payroll-" + month + ".csv", "text/csv;charset=utf-8");
  }

  function exportBackup() {
    downloadFile(JSON.stringify(state, null, 2), "kleentoditee-payroll-pro-backup.json", "application/json;charset=utf-8");
  }

  function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.employees) || !Array.isArray(parsed.timeEntries)) {
          throw new Error("invalid");
        }
        state = {
          company: parsed.company || clone(seedState.company),
          settings: Object.assign({}, clone(seedState.settings), parsed.settings || {}),
          deductionTemplates: Array.isArray(parsed.deductionTemplates) ? parsed.deductionTemplates : clone(seedState.deductionTemplates),
          employees: parsed.employees,
          timeEntries: parsed.timeEntries,
          payrollRuns: Array.isArray(parsed.payrollRuns) ? parsed.payrollRuns : []
        };
        ui.selectedRunId = state.payrollRuns[0] ? state.payrollRuns[0].id : null;
        populateTemplateOptions();
        populateEmployeeOptions();
        resetEmployeeForm();
        resetEntryForm();
        saveState();
        render();
        showToast("Backup imported.");
      } catch (error) {
        window.alert("That backup file could not be imported.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function installApp() {
    if (!ui.installPrompt) {
      window.alert("Install works when the app is opened from localhost or a secure website.");
      return;
    }
    ui.installPrompt.prompt();
    await ui.installPrompt.userChoice;
    ui.installPrompt = null;
    els.installAppButton.classList.add("hidden");
  }

  function calculateEntry(entry) {
    const employee = getEmployee(entry.employeeId);
    const template = getTemplate(entry.templateId || (employee && employee.templateId));
    if (!employee) {
      return { gross: 0, totalDeductions: 0, net: 0, breakdown: { nhi: 0, ssb: 0, incomeTax: 0, manual: 0 } };
    }

    let gross = 0;
    const usesFlatGross = toNumber(entry.flatGross) > 0;

    if (usesFlatGross) {
      gross = toNumber(entry.flatGross);
    } else if (employee.basePayType === "daily") {
      gross += toNumber(entry.daysWorked) * toNumber(employee.dailyRate);
      gross += toNumber(entry.hoursWorked) * toNumber(employee.hourlyRate);
    } else if (employee.basePayType === "hourly") {
      gross += toNumber(entry.hoursWorked) * toNumber(employee.hourlyRate);
    } else {
      gross += toNumber(employee.fixedPay);
    }

    gross += toNumber(entry.overtimeHours) * (toNumber(employee.overtimeRate) || toNumber(employee.hourlyRate) || 0);
    gross += toNumber(entry.bonus);
    gross += toNumber(entry.allowance);

    const breakdown = {
      nhi: entry.applyNhi && template ? gross * template.nhiRate : 0,
      ssb: entry.applySsb && template ? gross * template.ssbRate : 0,
      incomeTax: entry.applyIncomeTax && template ? gross * template.incomeTaxRate : 0,
      manual: toNumber(entry.advanceDeduction) + toNumber(entry.withdrawalDeduction) + toNumber(entry.loanDeduction) + toNumber(entry.otherDeduction)
    };

    const totalDeductions = roundMoney(breakdown.nhi + breakdown.ssb + breakdown.incomeTax + breakdown.manual);
    const net = roundMoney(gross - totalDeductions);

    return {
      gross: roundMoney(gross),
      totalDeductions: totalDeductions,
      net: net,
      breakdown: {
        nhi: roundMoney(breakdown.nhi),
        ssb: roundMoney(breakdown.ssb),
        incomeTax: roundMoney(breakdown.incomeTax),
        manual: roundMoney(breakdown.manual)
      }
    };
  }

  function buildPayrollPreview(month) {
    const grouped = new Map();
    const siteTotals = new Map();

    getEntriesForMonth(month).forEach(function (entry) {
      const employee = getEmployee(entry.employeeId);
      if (!employee) {
        return;
      }
      const calc = calculateEntry(entry);
      const site = entry.site || employee.defaultSite || "Unassigned";

      if (!grouped.has(employee.id)) {
        grouped.set(employee.id, {
          employeeId: employee.id,
          employeeName: employee.fullName,
          sites: new Set(),
          gross: 0,
          deductions: 0,
          net: 0,
          entryCount: 0,
          status: entry.status
        });
      }

      const group = grouped.get(employee.id);
      group.sites.add(site);
      group.gross += calc.gross;
      group.deductions += calc.totalDeductions;
      group.net += calc.net;
      group.entryCount += 1;
      group.status = prioritizeStatus(group.status, entry.status);

      if (!siteTotals.has(site)) {
        siteTotals.set(site, { site: site, gross: 0, entries: 0 });
      }
      const siteGroup = siteTotals.get(site);
      siteGroup.gross += calc.gross;
      siteGroup.entries += 1;
    });

    const items = Array.from(grouped.values())
      .map(function (group) {
        return {
          employeeId: group.employeeId,
          employeeName: group.employeeName,
          sites: Array.from(group.sites).join(", "),
          gross: roundMoney(group.gross),
          deductions: roundMoney(group.deductions),
          net: roundMoney(group.net),
          entryCount: group.entryCount,
          status: group.status
        };
      })
      .sort(function (a, b) { return a.employeeName.localeCompare(b.employeeName); });

    const totals = items.reduce(function (acc, item) {
      acc.gross += item.gross;
      acc.deductions += item.deductions;
      acc.net += item.net;
      return acc;
    }, { gross: 0, deductions: 0, net: 0 });

    return {
      items: items,
      totals: {
        gross: roundMoney(totals.gross),
        deductions: roundMoney(totals.deductions),
        net: roundMoney(totals.net)
      },
      siteTotals: Array.from(siteTotals.values()).sort(function (a, b) { return b.gross - a.gross; })
    };
  }

  function populateTemplateOptions() {
    const options = state.deductionTemplates.map(function (template) {
      return '<option value="' + template.id + '">' + escapeHtml(template.name) + "</option>";
    }).join("");
    els.employeeTemplateId.innerHTML = options;
    els.entryTemplateId.innerHTML = options;
  }

  function populateEmployeeOptions() {
    const options = state.employees
      .slice()
      .sort(function (a, b) { return a.fullName.localeCompare(b.fullName); })
      .map(function (employee) {
        return '<option value="' + employee.id + '">' + escapeHtml(employee.fullName) + "</option>";
      }).join("");
    els.entryEmployeeId.innerHTML = options;
  }

  function getActiveEmployees() {
    return state.employees.filter(function (employee) { return employee.active; });
  }

  function getEntriesForMonth(month) {
    return state.timeEntries.filter(function (entry) { return entry.month === month; });
  }

  function getEmployee(id) {
    return state.employees.find(function (employee) { return employee.id === id; }) || null;
  }

  function getEmployeeName(id) {
    const employee = getEmployee(id);
    return employee ? employee.fullName : "Unknown employee";
  }

  function getTimeEntry(id) {
    return state.timeEntries.find(function (entry) { return entry.id === id; }) || null;
  }

  function getTemplate(id) {
    return state.deductionTemplates.find(function (template) { return template.id === id; }) || null;
  }

  function getPayrollRunForMonth(month) {
    return state.payrollRuns.find(function (run) { return run.month === month; }) || null;
  }

  function saveState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return clone(seedState);
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        company: parsed.company || clone(seedState.company),
        settings: Object.assign({}, clone(seedState.settings), parsed.settings || {}),
        deductionTemplates: Array.isArray(parsed.deductionTemplates) ? parsed.deductionTemplates : clone(seedState.deductionTemplates),
        employees: Array.isArray(parsed.employees) ? parsed.employees : clone(seedState.employees),
        timeEntries: Array.isArray(parsed.timeEntries) ? parsed.timeEntries : clone(seedState.timeEntries),
        payrollRuns: Array.isArray(parsed.payrollRuns) ? parsed.payrollRuns : clone(seedState.payrollRuns)
      };
    } catch (error) {
      return clone(seedState);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    if (!window.location.protocol.startsWith("http")) {
      return;
    }
    navigator.serviceWorker.register("./service-worker.js").catch(function () {
      return null;
    });
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    if (ui.toastTimer) {
      window.clearTimeout(ui.toastTimer);
    }
    ui.toastTimer = window.setTimeout(function () {
      els.toast.classList.add("hidden");
    }, 2600);
  }

  function metricCard(label, value, note) {
    return [
      '<article class="metric-card">',
      '<span class="metric-label">' + escapeHtml(label) + "</span>",
      '<span class="metric-value">' + escapeHtml(String(value)) + "</span>",
      '<p class="metric-note">' + escapeHtml(note) + "</p>",
      "</article>"
    ].join("");
  }

  function stackItem(title, body) {
    return [
      '<article class="stack-item">',
      "<strong>" + escapeHtml(title) + "</strong>",
      "<span>" + escapeHtml(body) + "</span>",
      "</article>"
    ].join("");
  }

  function amountBox(label, value) {
    return [
      '<div class="amount-box">',
      '<span class="amount-label">' + escapeHtml(label) + "</span>",
      '<span class="amount-value">' + escapeHtml(value) + "</span>",
      "</div>"
    ].join("");
  }

  function emptyState(message) {
    return '<div class="empty-state">' + escapeHtml(message) + "</div>";
  }

  function describePay(employee) {
    if (employee.basePayType === "daily") {
      return formatCurrency(employee.dailyRate) + " per day";
    }
    if (employee.basePayType === "hourly") {
      return formatCurrency(employee.hourlyRate) + " per hour";
    }
    return formatCurrency(employee.fixedPay) + " fixed monthly";
  }

  function prioritizeStatus(currentStatus, nextStatus) {
    const rank = { draft: 0, submitted: 1, approved: 2, paid: 3 };
    return rank[nextStatus] > rank[currentStatus] ? nextStatus : currentStatus;
  }

  function downloadFile(contents, filename, mimeType) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 10);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function capitalize(value) {
    if (!value) {
      return "";
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatMonth(value) {
    if (!value) {
      return "Unknown month";
    }
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(value + "-01T00:00:00"));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  }

  function formatCurrency(value) {
    try {
      return new Intl.NumberFormat(state.company.locale || "en-BZ", {
        style: "currency",
        currency: state.company.currency || "BZD",
        minimumFractionDigits: 2
      }).format(value || 0);
    } catch (error) {
      return "BZD " + roundMoney(value || 0).toFixed(2);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
