// Smoke test for Task 10 sub-slice B (payments + bill payments).
// Run with:  node scripts/smoke-finance-b.mjs
// Assumes API is up on http://127.0.0.1:8797 and seed has run at least once.
// Creates its own transactions — does not rely on seed invoice/bill state.

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:8797";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@kleentoditee.local";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "ChangeMe!Dev123";

async function j(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function assert(cond, label) {
  if (!cond) {
    console.error(`  FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  pass: ${label}`);
  }
}

(async () => {
  const login = await j("POST", "/auth/login", null, { email: EMAIL, password: PASSWORD });
  if (login.status !== 200 || !login.data?.token) {
    console.error("Login failed:", login);
    process.exit(1);
  }
  const token = login.data.token;
  console.log("Login OK");

  const customers = await j("GET", "/finance/customers", token);
  const suppliers = await j("GET", "/finance/suppliers", token);
  const products = await j("GET", "/finance/products", token);
  const accounts = await j("GET", "/finance/accounts", token);

  const customer = customers.data.items[0];
  const supplier = suppliers.data.items[0];
  const product = products.data.items[0];
  const cash = accounts.data.items.find((a) => a.code === "1000");
  const revenue = accounts.data.items.find((a) => a.type === "revenue");
  const expense = accounts.data.items.find((a) => a.type === "expense");

  console.log(
    `Seed lookups — customer=${customer.displayName}, supplier=${supplier.displayName}, cash=${cash.code}`
  );

  // Create + open a fresh invoice for this run
  const inv = await j("POST", "/finance/invoices", token, {
    customerId: customer.id,
    issueDate: "2026-04-24",
    lines: [
      { quantity: 1, unitPrice: 500, incomeAccountId: revenue.id, description: "Smoke B invoice" }
    ]
  });
  assert(inv.status === 201, "seed invoice created");
  const invoice = inv.data.invoice;
  const sent = await j("POST", `/finance/invoices/${invoice.id}/send`, token);
  assert(sent.status === 200 && sent.data.invoice.status === "open", "invoice opened");

  // Create + open a fresh bill for this run
  const bil = await j("POST", "/finance/bills", token, {
    supplierId: supplier.id,
    billDate: "2026-04-22",
    lines: [
      { quantity: 1, unitCost: 200, expenseAccountId: expense.id, description: "Smoke B bill" }
    ]
  });
  assert(bil.status === 201, "seed bill created");
  const bill = bil.data.bill;
  const rcv = await j("POST", `/finance/bills/${bill.id}/receive`, token);
  assert(rcv.status === 200 && rcv.data.bill.status === "open", "bill opened");

  console.log("\n== partial payment happy path ==");
  const partial = await j("POST", "/finance/payments", token, {
    customerId: customer.id,
    paymentDate: "2026-04-25",
    method: "check",
    reference: "check 1001",
    amount: 200,
    depositAccountId: cash.id,
    applications: [{ invoiceId: invoice.id, amount: 200 }]
  });
  assert(partial.status === 201, "create partial payment returns 201");
  const payment1 = partial.data.payment;
  assert(/^PMT-\d{4}-\d{4}$/.test(payment1.number), `payment number auto (${payment1.number})`);
  assert(payment1.applied === 200 && payment1.unapplied === 0, "applied/unapplied computed");

  // Invoice should flip to partial with balance 300
  const afterPartial = await j("GET", `/finance/invoices/${invoice.id}`, token);
  assert(afterPartial.data.invoice.status === "partial", "invoice moved to partial");
  assert(afterPartial.data.invoice.amountPaid === 200, "invoice amountPaid=200");
  assert(afterPartial.data.invoice.balance === 300, "invoice balance=300");

  console.log("\n== over-applied rejection ==");
  const over = await j("POST", "/finance/payments", token, {
    customerId: customer.id,
    paymentDate: "2026-04-25",
    amount: 100,
    depositAccountId: cash.id,
    applications: [{ invoiceId: invoice.id, amount: 9999 }]
  });
  assert(over.status === 400, "over-applied returns 400");

  console.log("\n== pay-in-full + status flip ==");
  const full = await j("POST", "/finance/payments", token, {
    customerId: customer.id,
    paymentDate: "2026-04-26",
    amount: 300,
    depositAccountId: cash.id,
    applications: [{ invoiceId: invoice.id, amount: 300 }]
  });
  assert(full.status === 201, "second payment returns 201");

  const afterFull = await j("GET", `/finance/invoices/${invoice.id}`, token);
  assert(afterFull.data.invoice.status === "paid", "invoice moved to paid");
  assert(afterFull.data.invoice.balance === 0, "invoice balance=0");

  console.log("\n== unapply reverses ==");
  const paymentDetail = await j("GET", `/finance/payments/${payment1.id}`, token);
  const firstApp = paymentDetail.data.payment.applications[0];
  const unapplied = await j(
    "POST",
    `/finance/payments/${payment1.id}/unapply/${firstApp.id}`,
    token
  );
  assert(unapplied.status === 200, "unapply returns 200");
  assert(
    unapplied.data.payment.applied === 0 && unapplied.data.payment.unapplied === 200,
    "payment applied rolled back"
  );
  const afterUnapply = await j("GET", `/finance/invoices/${invoice.id}`, token);
  assert(afterUnapply.data.invoice.status === "partial", "invoice status rebalanced to partial");
  assert(afterUnapply.data.invoice.balance === 200, "invoice balance rebalanced to 200");

  console.log("\n== bill payment happy path ==");
  const bpay = await j("POST", "/finance/bill-payments", token, {
    supplierId: supplier.id,
    paymentDate: "2026-04-27",
    method: "ach",
    amount: 200,
    sourceAccountId: cash.id,
    applications: [{ billId: bill.id, amount: 200 }]
  });
  assert(bpay.status === 201, "bill payment returns 201");
  assert(/^BPT-\d{4}-\d{4}$/.test(bpay.data.billPayment.number), `bpt number auto`);

  const afterBPay = await j("GET", `/finance/bills/${bill.id}`, token);
  assert(afterBPay.data.bill.status === "paid", "bill moved to paid");
  assert(afterBPay.data.bill.balance === 0, "bill balance=0");

  console.log("\n== bill-payment validation ==");
  const wrongSupplier = await j("POST", "/finance/bill-payments", token, {
    supplierId: customer.id, // wrong id entirely
    paymentDate: "2026-04-27",
    amount: 50,
    sourceAccountId: cash.id,
    applications: []
  });
  assert(wrongSupplier.status === 400, "unknown supplier id rejected");

  const wrongSource = await j("POST", "/finance/bill-payments", token, {
    supplierId: supplier.id,
    paymentDate: "2026-04-27",
    amount: 50,
    sourceAccountId: revenue.id,
    applications: []
  });
  assert(wrongSource.status === 400, "revenue account as source rejected");

  if (process.exitCode) {
    console.error("\nSmoke FAILED");
  } else {
    console.log("\nSmoke PASS");
  }
})().catch((err) => {
  console.error("Smoke script crashed:", err);
  process.exit(2);
});
