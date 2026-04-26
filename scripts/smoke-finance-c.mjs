// Smoke test for Task 10 sub-slice C (expenses + deposits).
// Run with:  node scripts/smoke-finance-c.mjs
// Assumes API is up on http://127.0.0.1:8787 and seed has run.

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:8787";
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
  const accounts = await j("GET", "/finance/accounts", token);

  const customer = customers.data.items[0];
  const supplier = suppliers.data.items[0];
  const cash = accounts.data.items.find((a) => a.code === "1000");
  const revenue = accounts.data.items.find((a) => a.type === "revenue");
  const expense = accounts.data.items.find((a) => a.type === "expense");

  console.log(
    `Seed lookups — customer=${customer.displayName}, cash=${cash.code}, expense=${expense.code}`
  );

  console.log("\n== expense happy path ==");
  const exp = await j("POST", "/finance/expenses", token, {
    expenseDate: "2026-04-25",
    method: "card",
    payeeName: "Costco Wholesale",
    paymentAccountId: cash.id,
    reference: "card-4321",
    memo: "April supplies run",
    lines: [
      {
        description: "Trash bags case",
        quantity: 4,
        unitCost: 22.5,
        expenseAccountId: expense.id
      },
      {
        description: "Cleaning solution",
        quantity: 2,
        unitCost: 15,
        expenseAccountId: expense.id
      }
    ]
  });
  assert(exp.status === 201, "create draft expense returns 201");
  assert(exp.data.expense.total === 120, `expense total rolls up to 120 (got ${exp.data.expense.total})`);
  assert(/^EXP-\d{4}-\d{4}$/.test(exp.data.expense.number), `expense number auto`);
  assert(exp.data.expense.status === "draft", "expense status draft");

  const post = await j("POST", `/finance/expenses/${exp.data.expense.id}/post`, token);
  assert(post.status === 200 && post.data.expense.status === "open", "expense posts to open");

  const editPosted = await j("PATCH", `/finance/expenses/${exp.data.expense.id}`, token, {
    memo: "nope"
  });
  assert(editPosted.status === 409, "patch posted expense returns 409");

  console.log("\n== expense validation ==");
  const wrongAcct = await j("POST", "/finance/expenses", token, {
    expenseDate: "2026-04-25",
    paymentAccountId: cash.id,
    payeeName: "Bad",
    lines: [{ description: "x", quantity: 1, unitCost: 1, expenseAccountId: revenue.id }]
  });
  assert(wrongAcct.status === 400, "revenue line account rejected");

  const liabilityPay = await j("POST", "/finance/expenses", token, {
    expenseDate: "2026-04-25",
    paymentAccountId: revenue.id,
    payeeName: "Bad",
    lines: [{ description: "x", quantity: 1, unitCost: 1, expenseAccountId: expense.id }]
  });
  assert(liabilityPay.status === 400, "non-asset payment account rejected");

  console.log("\n== deposit happy path ==");
  // Create + open + pay an invoice so we have a payment to deposit
  const invRes = await j("POST", "/finance/invoices", token, {
    customerId: customer.id,
    issueDate: "2026-04-26",
    lines: [{ quantity: 1, unitPrice: 250, incomeAccountId: revenue.id, description: "Smoke C" }]
  });
  assert(invRes.status === 201, "invoice for deposit smoke created");
  const invoice = invRes.data.invoice;
  await j("POST", `/finance/invoices/${invoice.id}/send`, token);

  const pmtRes = await j("POST", "/finance/payments", token, {
    customerId: customer.id,
    paymentDate: "2026-04-27",
    method: "cash",
    amount: 250,
    depositAccountId: cash.id,
    applications: [{ invoiceId: invoice.id, amount: 250 }]
  });
  assert(pmtRes.status === 201, "payment for deposit smoke created");
  const payment = pmtRes.data.payment;

  const avail = await j(
    "GET",
    `/finance/deposits/available-payments?bankAccountId=${cash.id}`,
    token
  );
  assert(avail.status === 200, "available-payments returns 200");
  assert(
    avail.data.items.some((p) => p.id === payment.id),
    "new payment shows in undeposited list"
  );

  const dep = await j("POST", "/finance/deposits", token, {
    bankAccountId: cash.id,
    depositDate: "2026-04-28",
    memo: "End-of-week deposit",
    lines: [{ paymentId: payment.id, amount: 250 }]
  });
  assert(dep.status === 201, "create deposit returns 201");
  assert(/^DEP-\d{4}-\d{4}$/.test(dep.data.deposit.number), "deposit number auto");
  assert(dep.data.deposit.total === 250, "deposit total matches lines");

  const postDep = await j("POST", `/finance/deposits/${dep.data.deposit.id}/post`, token);
  assert(postDep.status === 200 && postDep.data.deposit.status === "open", "deposit posts to open");

  const paymentAfter = await j("GET", `/finance/payments/${payment.id}`, token);
  assert(!!paymentAfter.data.payment.depositedAt, "payment.depositedAt set after deposit post");

  console.log("\n== deposit guards ==");
  const dupDep = await j("POST", "/finance/deposits", token, {
    bankAccountId: cash.id,
    depositDate: "2026-04-28",
    lines: [{ paymentId: payment.id, amount: 250 }]
  });
  assert(dupDep.status === 400, "redeposit of already-deposited payment rejected");

  const tryDeletePayment = await j("DELETE", `/finance/payments/${payment.id}`, token);
  assert(tryDeletePayment.status === 409, "deleting deposited payment refused");

  const reverseDep = await j("POST", `/finance/deposits/${dep.data.deposit.id}/void`, token);
  assert(reverseDep.status === 200 && reverseDep.data.deposit.status === "void", "deposit voided");

  const paymentRestored = await j("GET", `/finance/payments/${payment.id}`, token);
  assert(
    paymentRestored.data.payment.depositedAt === null,
    "payment.depositedAt cleared after void"
  );

  if (process.exitCode) {
    console.error("\nSmoke FAILED");
  } else {
    console.log("\nSmoke PASS");
  }
})().catch((err) => {
  console.error("Smoke script crashed:", err);
  process.exit(2);
});
