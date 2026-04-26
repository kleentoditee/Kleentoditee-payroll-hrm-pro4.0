// Smoke test for Task 10 sub-slice A (invoices + bills).
// Run with:  node scripts/smoke-finance-a.mjs
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
  const products = await j("GET", "/finance/products", token);
  const accounts = await j("GET", "/finance/accounts", token);

  const customer = customers.data.items[0];
  const supplier = suppliers.data.items[0];
  const product = products.data.items[0];
  const cashAccount = accounts.data.items.find((a) => a.code === "1000");

  console.log(
    `Seed lookups — customer=${customer.displayName}, supplier=${supplier.displayName}, product=${product.sku}`
  );

  console.log("\n== invoice happy path ==");
  const create = await j("POST", "/finance/invoices", token, {
    customerId: customer.id,
    issueDate: "2026-04-24",
    dueDate: "2026-05-24",
    memo: "Smoke test",
    lines: [
      {
        productId: product.id,
        quantity: 2,
        unitPrice: 150,
        incomeAccountId: product.incomeAccount.id,
        description: "Two weekly visits"
      },
      {
        quantity: 1,
        unitPrice: 40,
        incomeAccountId: product.incomeAccount.id,
        description: "Supplies surcharge"
      }
    ]
  });
  assert(create.status === 201, "create draft invoice returns 201");
  const invoice = create.data.invoice;
  assert(invoice.status === "draft", "new invoice status is draft");
  assert(invoice.total === 340, `invoice total rolls up to 340 (got ${invoice.total})`);
  assert(invoice.balance === 340, "invoice balance equals total");
  assert(/^INV-\d{4}-\d{4}$/.test(invoice.number), `invoice number auto-formatted (${invoice.number})`);
  assert(invoice.lines.length === 2, "two line items persisted");

  const send = await j("POST", `/finance/invoices/${invoice.id}/send`, token);
  assert(send.status === 200, "send invoice returns 200");
  assert(send.data.invoice.status === "open", "invoice flips to open");
  assert(!!send.data.invoice.sentAt, "sentAt is set");

  const editOpen = await j("PATCH", `/finance/invoices/${invoice.id}`, token, { memo: "nope" });
  assert(editOpen.status === 409, "patching open invoice returns 409");

  console.log("\n== invoice validation ==");
  const wrongAcct = await j("POST", "/finance/invoices", token, {
    customerId: customer.id,
    issueDate: "2026-04-24",
    lines: [{ quantity: 1, unitPrice: 10, incomeAccountId: cashAccount.id }]
  });
  assert(wrongAcct.status === 400, "asset account on invoice line returns 400");
  assert(
    typeof wrongAcct.data.error === "string" && /revenue/i.test(wrongAcct.data.error),
    "error message mentions revenue"
  );

  const noLines = await j("POST", "/finance/invoices", token, {
    customerId: customer.id,
    issueDate: "2026-04-24",
    lines: []
  });
  assert(noLines.status === 400, "empty lines returns 400");

  const noCustomer = await j("POST", "/finance/invoices", token, {
    issueDate: "2026-04-24",
    lines: [{ quantity: 1, unitPrice: 10, incomeAccountId: product.incomeAccount.id }]
  });
  assert(noCustomer.status === 400, "missing customerId returns 400");

  console.log("\n== bill happy path ==");
  const expenseAcctId = product.expenseAccount?.id ?? accounts.data.items.find((a) => a.type === "expense").id;
  const bcreate = await j("POST", "/finance/bills", token, {
    supplierId: supplier.id,
    billDate: "2026-04-22",
    dueDate: "2026-05-22",
    memo: "April supplies",
    lines: [
      {
        quantity: 1,
        unitCost: 95,
        expenseAccountId: expenseAcctId,
        description: "Consumables box"
      },
      {
        quantity: 4,
        unitCost: 12.5,
        expenseAccountId: expenseAcctId,
        description: "Mop heads"
      }
    ]
  });
  assert(bcreate.status === 201, "create draft bill returns 201");
  const bill = bcreate.data.bill;
  assert(bill.total === 145, `bill total rolls up to 145 (got ${bill.total})`);
  assert(/^BILL-\d{4}-\d{4}$/.test(bill.number), `bill number auto-formatted (${bill.number})`);

  const receive = await j("POST", `/finance/bills/${bill.id}/receive`, token);
  assert(receive.status === 200 && receive.data.bill.status === "open", "bill received and open");

  console.log("\n== bill validation ==");
  const cashBill = await j("POST", "/finance/bills", token, {
    supplierId: supplier.id,
    billDate: "2026-04-22",
    lines: [{ quantity: 1, unitCost: 10, expenseAccountId: cashAccount.id }]
  });
  assert(cashBill.status === 400, "asset account on bill line returns 400");

  if (process.exitCode) {
    console.error("\nSmoke FAILED");
  } else {
    console.log("\nSmoke PASS");
  }
})().catch((err) => {
  console.error("Smoke script crashed:", err);
  process.exit(2);
});
