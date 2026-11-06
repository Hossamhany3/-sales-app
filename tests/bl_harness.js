// حزمة اختبارات منطق العمل — تشغّل BusinessLogic المستخرج من app_fixed.html
// على بيانات تجريبية في Node (بلا متصفح وبلا بيانات حقيقية).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'app_fixed.html');

function extractInline(html) {
  const m = /<script>\r?\n/.exec(html);
  if (!m) throw new Error('inline script not found');
  const s = m.index + m[0].length;
  const e = html.indexOf('</script>', s);
  if (e < 0) throw new Error('inline script end not found');
  return html.slice(s, e);
}
function sliceBalanced(text, startIdx) {
  // startIdx يشير إلى '{'
  let depth = 0, inS = null, escp = false, line = false, block = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (inS) {
      if (escp) { escp = false; continue; }
      if (c === '\\') { escp = true; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(startIdx, i + 1); }
  }
  throw new Error('unbalanced block at ' + startIdx);
}
function extractFunction(js, name) {
  const re = new RegExp('(^|\\n)[ ]{4}(async )?function ' + name + '\\s*\\(');
  const m = re.exec(js);
  if (!m) throw new Error('function not found: ' + name);
  const start = m.index + m[1].length;
  const brace = js.indexOf('{', js.indexOf(')', start));
  return js.slice(start, brace) + sliceBalanced(js, brace);
}

const html = fs.readFileSync(FILE, 'utf8');
const js = extractInline(html);
const blMarker = 'window.BusinessLogic = {';
const blStart = js.indexOf(blMarker);
if (blStart < 0) throw new Error('BusinessLogic not found');
const blObj = sliceBalanced(js, js.indexOf('{', blStart));
const blSrc = 'const BusinessLogic = ' + blObj + ';';

const FN = ['calcTransactionProfit', 'computeIncomeStatement', 'uniqueProductByName'].map(n => extractFunction(js, n)).join('\n');

const factory = new Function(`
let products = [], merchants = [], transactions = [], installments = [], msgTemplates = {};
let merchantSales = [], merchantPayments = [], merchantPurchases = [], merchantPaymentsOut = [];
let partners = [], accounts = [], stockMovements = [], arabonSales = [], employees = [];
let recurringExpenses = [], auditLog = [], expenseCategories = [], incomeCategories = [];
let openingCapital = 0, db = null, __seq = 0;
const AUDIT_LOG_MAX = 1000;
function saveData() {}
function logAudit() {}
function isAdminSession() { return true; }
function getNextContractNo() { return 'C-' + (++__seq); }
function safeParse(v, f) { try { const x = JSON.parse(v); return x == null ? f : x; } catch (e) { return f; } }
function getInstSchedule(inst) {
  const n = inst.numInstallments || (inst.schedule || []).length || 0;
  const first = new Date(inst.firstDueDate || inst.date || Date.now());
  return Array.from({ length: n }, (_, i) => { const d = new Date(first); d.setMonth(first.getMonth() + i); return { index: i + 1, dueDate: d.toISOString().split('T')[0], paidAmount: 0, isPaid: false }; });
}
function esc(v) { return String(v == null ? '' : v); }
function inRange(dateStr, range) {
  if (!range || (!range.from && !range.to)) return true;
  const d = new Date(dateStr);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}
function getTotalCommissions() { return 0; }
function refreshSelectors() {}
function renderProducts() {}
function renderTransactions() {}
function renderDashboard() {}
${blSrc}
${FN}
return {
  BL: BusinessLogic,
  calcTransactionProfit, computeIncomeStatement, uniqueProductByName,
  seed(d) {
    products = d.products || []; merchants = d.merchants || []; accounts = d.accounts || [];
    employees = d.employees || []; partners = [];
    transactions = []; installments = []; arabonSales = []; stockMovements = [];
    merchantSales = []; merchantPurchases = []; merchantPayments = []; merchantPaymentsOut = [];
    auditLog = []; openingCapital = 0; __seq = 0;
  },
  dump() {
    return JSON.parse(JSON.stringify({ products, merchants, transactions, installments, arabonSales, stockMovements, merchantSales, merchantPurchases, merchantPayments, merchantPaymentsOut, accounts }));
  },
  set(name, v) {
    if (name === 'transactions') transactions = v;
    else if (name === 'products') products = v;
    else if (name === 'merchantSales') merchantSales = v;
  },
  get(name) { return eval(name); }
};
`)();

const { BL, calcTransactionProfit, computeIncomeStatement, uniqueProductByName } = factory;

// ─────────── إطار الاختبار ───────────
const results = [];
function test(name, fn) {
  try { const note = fn(); results.push({ name, ok: true, note: note || '' }); }
  catch (e) { results.push({ name, ok: false, note: e.message }); }
}
function eq(a, b, msg) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 0.01) throw new Error(`${msg}: متوقع ${b} — فعلي ${a}`);
  } else if (a !== b) throw new Error(`${msg}: متوقع ${b} — فعلي ${a}`);
}
function ok(v, msg) { if (!v) throw new Error(msg); }

const BASE = () => ({
  products: [
    { id: 1, name: 'iPhone 13', costPrice: 10000, expenses: 500, sellPrice: 13000, stock: 10, archived: false },
    { id: 2, name: 'iPhone 13', costPrice: 9000, expenses: 0, sellPrice: 12000, stock: 5, archived: false }, // نفس الاسم، تكلفة مختلفة
    { id: 3, name: 'Samsung A54', costPrice: 6000, expenses: 0, sellPrice: 8000, stock: 4, archived: false }
  ],
  merchants: [{ id: 1, name: 'عميل أ', phone: '01000000001' }, { id: 2, name: 'تاجر ب', phone: '01000000002' }],
  accounts: [{ id: 1, name: 'الخزينة', type: 'cash', balance: 0 }, { id: 2, name: 'البنك', type: 'bank', balance: 0 }],
  employees: [{ id: 1, name: 'موظف أ', commissionType: 'percent', commissionValue: 10, role: 'employee' }]
});
const D = () => factory.dump();
const stockOf = id => D().products.find(p => p.id == id).stock;
function stockMatchesMovements(productId, initial) {
  const d = D();
  const ins = d.stockMovements.filter(m => m.productId == productId && m.type === 'in').reduce((s, m) => s + m.qty, 0);
  const outs = d.stockMovements.filter(m => m.productId == productId && m.type === 'out').reduce((s, m) => s + m.qty, 0);
  return initial + ins - outs;
}

// ═══════════ 1) اختبارات التقسيط ═══════════
function newInst(over) {
  const r = BL.createInstallment(Object.assign({
    merchantId: 1, productId: 1, deviceName: 'iPhone 13', purchasePrice: 13000, paidUpfront: 3000,
    interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05', accountId: 1, employeeId: 1,
    date: '2026-01-01T10:00:00.000Z'
  }, over || {}));
  ok(r.success, 'فشل إنشاء العقد: ' + r.reason);
  return r;
}

test('تقسيط: إنشاء عقد بمقدم نقدي', () => {
  factory.seed(BASE());
  const r = newInst();
  const d = D(); const inst = d.installments[0];
  eq(inst.totalAfterInterest, 10000, 'إجمالي التمويل');
  eq(inst.remainingBalance, 10000, 'المتبقي');
  eq(inst.monthlyAmount, 1000, 'القسط الشهري');
  eq(stockOf(1), 9, 'المخزون');
  const up = d.transactions.filter(t => t.operationType === 'upfront');
  eq(up.length, 1, 'عدد قيود المقدم');
  eq(up[0].amount, 3000, 'قيمة المقدم');
  eq(up[0].type, 'payment_in', 'نوع القيد');
  eq(stockMatchesMovements(1, 10), 9, 'مطابقة المخزون للحركات');
  return 'عقد #' + inst.id;
});

test('تقسيط: إنشاء عقد بمقدم بنكي', () => {
  factory.seed(BASE());
  newInst({ accountId: 2 });
  const up = D().transactions.find(t => t.operationType === 'upfront');
  eq(up.accountId, 2, 'حساب المقدم');
  return 'accountId=2';
});

test('تقسيط: سداد قسط نقدي', () => {
  factory.seed(BASE());
  const r = newInst();
  const pay = BL.recordInstallmentPayment({ installmentId: r.installmentId, amount: 1000, accountId: 1, date: '2026-02-05T10:00:00.000Z' });
  ok(pay.success, 'فشل السداد: ' + pay.reason);
  const inst = D().installments[0];
  eq(inst.remainingBalance, 9000, 'المتبقي');
  eq(inst.schedule[0].paidAmount, 1000, 'القسط الأول');
  ok(inst.schedule[0].isPaid, 'القسط الأول مسدد');
  return 'متبقي 9000';
});

test('تقسيط: سداد قسط بنكي', () => {
  factory.seed(BASE());
  const r = newInst();
  const pay = BL.recordSlotPayment({ installmentId: r.installmentId, slotIdx: 0, amount: 1000, bankAmount: 1000, bankAccountId: 2, date: '2026-02-05T10:00:00.000Z' });
  ok(pay.success, 'فشل السداد: ' + pay.reason);
  const t = D().transactions.filter(t => t.sourceType === 'installment_payment');
  eq(t.length, 1, 'عدد القيود');
  eq(t[0].accountId, 2, 'حساب السداد');
  return 'بنك';
});

test('تقسيط: سداد مقسّم نقدي + بنكي', () => {
  factory.seed(BASE());
  const r = newInst();
  const pay = BL.recordInstallmentPayment({
    installmentId: r.installmentId, amount: 1000, cashAmount: 600, bankAmount: 400,
    cashAccountId: 1, bankAccountId: 2, date: '2026-02-05T10:00:00.000Z'
  });
  ok(pay.success, 'فشل السداد: ' + pay.reason);
  const t = D().transactions.filter(t => t.sourceType === 'installment_payment');
  eq(t.length, 2, 'عدد القيود');
  eq(t.reduce((s, x) => s + x.amount, 0), 1000, 'مجموع القيود');
  eq(D().installments[0].remainingBalance, 9000, 'المتبقي');
  return '600 + 400';
});

test('تقسيط: تعديل عقد بعد سداد عدة أقساط', () => {
  factory.seed(BASE());
  const r = newInst();
  BL.recordInstallmentPayment({ installmentId: r.installmentId, amount: 1000, accountId: 1, date: '2026-02-05T10:00:00.000Z' });
  BL.recordInstallmentPayment({ installmentId: r.installmentId, amount: 1000, accountId: 1, date: '2026-03-05T10:00:00.000Z' });
  const e = BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 1, purchasePrice: 15000,
    paidUpfront: 3000, interestRate: 10, numInstallments: 12, firstDueDate: '2026-01-05', deviceName: 'iPhone 13'
  });
  ok(e.success, 'فشل التعديل: ' + e.reason);
  const inst = D().installments[0];
  eq(inst.totalAfterInterest, 13200, 'إجمالي التمويل الجديد');
  eq(inst.remainingBalance, 11200, 'المتبقي = الإجمالي - المدفوع');
  const paidInSchedule = inst.schedule.reduce((s, sl) => s + sl.paidAmount, 0);
  eq(paidInSchedule, 2000, 'المدفوع محفوظ في الجدول');
  eq(inst.remainingBalance + paidInSchedule, inst.totalAfterInterest, 'رصيد العقد = الإجمالي');
  return 'مدفوع 2000 محفوظ';
});

test('تقسيط: تعديل قيمة المقدم', () => {
  factory.seed(BASE());
  const r = newInst();
  BL.recordInstallmentPayment({ installmentId: r.installmentId, amount: 1000, accountId: 1, date: '2026-02-05T10:00:00.000Z' });
  const e = BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 1, purchasePrice: 13000,
    paidUpfront: 5000, interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05'
  });
  ok(e.success, 'فشل التعديل: ' + e.reason);
  const d = D();
  const ups = d.transactions.filter(t => t.operationType === 'upfront');
  eq(ups.length, 1, 'قيد مقدم واحد فقط (بلا تكرار)');
  eq(ups[0].amount, 5000, 'قيمة المقدم الجديدة');
  eq(d.installments[0].totalAfterInterest, 8000, 'إجمالي التمويل بعد المقدم 5000');
  eq(d.installments[0].remainingBalance, 7000, 'المتبقي = 8000 - 1000 مسدد');
  return 'مقدم 3000 → 5000';
});

test('تقسيط: تعديل العقد إلى مقدم صفر', () => {
  factory.seed(BASE());
  const r = newInst();
  const e = BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 1, purchasePrice: 13000,
    paidUpfront: 0, interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05'
  });
  ok(e.success, 'فشل التعديل: ' + e.reason);
  const d = D();
  eq(d.transactions.filter(t => t.operationType === 'upfront').length, 0, 'قيد المقدم أُزيل');
  eq(d.installments[0].paidUpfront, 0, 'المقدم صفر');
  eq(d.installments[0].remainingBalance, 13000, 'المتبقي = كامل السعر');
  eq(d.transactions.filter(t => t.type === 'payment_in').length, 0, 'لا قيود دخل يتيمة');
  return 'حُذف القيد مع العقد صحيح';
});

test('تقسيط: حذف عقد له دفعات سابقة مرفوض', () => {
  factory.seed(BASE());
  const r = newInst();
  BL.recordInstallmentPayment({ installmentId: r.installmentId, amount: 1000, accountId: 1, date: '2026-02-05T10:00:00.000Z' });
  const del = BL.deleteInstallment(r.installmentId);
  eq(del.success, false, 'الحذف يجب أن يُرفض');
  eq(del.reason, 'has_payments', 'سبب الرفض');
  eq(D().installments.length, 1, 'العقد باقٍ');
  return 'has_payments';
});

test('تقسيط: تطابق رصيد كل عقد مع مجموع الأقساط', () => {
  factory.seed(BASE());
  newInst();
  newInst({ productId: 3, purchasePrice: 8000, paidUpfront: 1000, interestRate: 5, numInstallments: 6, deviceName: 'Samsung A54' });
  const bad = D().installments.filter(i => {
    const paid = (i.schedule || []).reduce((s, sl) => s + sl.paidAmount, 0);
    return Math.abs((i.totalAfterInterest - paid) - i.remainingBalance) > 0.01;
  });
  eq(bad.length, 0, 'عقود غير متطابقة');
  return '2 عقود';
});

// ═══════════ 2) اختبارات العربون ═══════════
function newArabon(over) {
  const r = BL.createArabon(Object.assign({
    merchantId: 1, productId: 1, deviceName: 'iPhone 13', sellPrice: 8000, depositAmount: 2000,
    accountId: 1, dueDate: '2026-02-01', notes: '', date: '2026-01-01T10:00:00.000Z'
  }, over || {}));
  ok(r.success, 'فشل إنشاء العربون: ' + r.reason);
  return r;
}

test('عربون: إنشاء بمقدم', () => {
  factory.seed(BASE());
  newArabon();
  const a = D().arabonSales[0];
  eq(a.remainingAmount, 6000, 'المتبقي');
  eq(stockOf(1), 9, 'المخزون');
  eq(D().transactions.filter(t => t.operationType === 'deposit').length, 1, 'قيد العربون');
  return 'عربون 2000';
});

test('عربون: إنشاء بدون مقدم', () => {
  factory.seed(BASE());
  newArabon({ depositAmount: 0 });
  const d = D();
  eq(d.arabonSales[0].remainingAmount, 8000, 'المتبقي');
  eq(d.transactions.filter(t => t.operationType === 'deposit').length, 0, 'لا قيد عربون');
  eq(stockOf(1), 9, 'المخزون');
  return 'بلا قيد مالي';
});

test('عربون: تحصيل دفعة إضافية', () => {
  factory.seed(BASE());
  const r = newArabon();
  const pay = BL.recordArabonPayment({ arabonId: r.arabonId, amount: 1000, accountId: 1, payMethod: 'cash', date: '2026-02-01T10:00:00.000Z' });
  ok(pay.success, 'فشل التحصيل: ' + pay.reason);
  const a = D().arabonSales[0];
  eq(a.remainingAmount, 5000, 'المتبقي');
  eq(a.isPaid, false, 'غير مسدد');
  return 'متبقي 5000';
});

test('عربون: تعديل القيمة بعد تحصيل دفعات', () => {
  factory.seed(BASE());
  const r = newArabon();
  BL.recordArabonPayment({ arabonId: r.arabonId, amount: 1000, accountId: 1, payMethod: 'cash', date: '2026-02-01T10:00:00.000Z' });
  const e = BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 1, sellPrice: 9000, depositAmount: 2000,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  });
  ok(e.success, 'فشل التعديل: ' + e.reason);
  const d = D();
  eq(d.arabonSales[0].remainingAmount, 6000, 'المتبقي = 9000 - 2000 - 1000');
  eq(d.transactions.filter(t => t.operationType === 'deposit').length, 1, 'قيد عربون واحد');
  eq(d.transactions.find(t => t.operationType === 'deposit').amount, 2000, 'قيمة قيد العربون');
  eq(d.transactions.filter(t => t.sourceType === 'arabon_payment').length, 1, 'الدفعة الجزئية محفوظة');
  return 'الدفعات السابقة محفوظة';
});

test('عربون: تعديل مبلغ المقدم بعد التحصيل', () => {
  factory.seed(BASE());
  const r = newArabon();
  BL.recordArabonPayment({ arabonId: r.arabonId, amount: 1000, accountId: 1, payMethod: 'cash', date: '2026-02-01T10:00:00.000Z' });
  const e = BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 1, sellPrice: 8000, depositAmount: 2500,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  });
  ok(e.success, 'فشل التعديل: ' + e.reason);
  const d = D();
  eq(d.transactions.find(t => t.operationType === 'deposit').amount, 2500, 'قيمة القيد');
  eq(d.arabonSales[0].remainingAmount, 4500, 'المتبقي');
  return '2500 + 1000';
});

test('عربون: تعديل المقدم إلى صفر', () => {
  factory.seed(BASE());
  const r = newArabon();
  BL.recordArabonPayment({ arabonId: r.arabonId, amount: 1000, accountId: 1, payMethod: 'cash', date: '2026-02-01T10:00:00.000Z' });
  const e = BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 1, sellPrice: 8000, depositAmount: 0,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  });
  ok(e.success, 'فشل التعديل: ' + e.reason);
  const d = D();
  eq(d.transactions.filter(t => t.operationType === 'deposit').length, 0, 'قيد العربون أُزيل');
  eq(d.arabonSales[0].remainingAmount, 7000, 'المتبقي = 8000 - 1000');
  eq(d.transactions.filter(t => t.sourceType === 'arabon_payment').length, 1, 'الدفعة الجزئية باقية');
  return 'بلا قيد عربون';
});

test('عربون: تحويل إلى تقسيط', () => {
  factory.seed(BASE());
  const r = newArabon();
  const before = D().transactions.length;
  const c = BL.convertArabonToInstallment({
    arabonId: r.arabonId, amount: 6000, interestRate: 0, numInstallments: 6,
    firstDueDate: '2026-03-01', accountId: 1, date: '2026-02-10T10:00:00.000Z'
  });
  ok(c.success, 'فشل التحويل: ' + c.reason);
  const d = D();
  eq(d.arabonSales[0].instId, c.installmentId, 'ربط العربون بالعقد');
  eq(d.arabonSales[0].remainingAmount, 0, 'لا مبلغ نقدي متبقٍ');
  eq(d.transactions.length, before, 'لا قيد مالي جديد عند التحويل');
  eq(d.installments[0].remainingBalance, 6000, 'رصيد العقد المحوّل');
  eq(stockOf(1), 9, 'لا خصم مخزون مزدوج');
  return 'عقد #' + c.installmentId;
});

test('عربون: حذف عربون له دفعات مرفوض', () => {
  factory.seed(BASE());
  const r = newArabon();
  BL.recordArabonPayment({ arabonId: r.arabonId, amount: 500, accountId: 1, payMethod: 'cash', date: '2026-02-01T10:00:00.000Z' });
  const del = BL.deleteArabon(r.arabonId);
  eq(del.success, false, 'الحذف يجب أن يُرفض');
  eq(del.reason, 'has_payments', 'سبب الرفض');
  return 'has_payments';
});

test('عربون: حذف عربون سليم يعيد المخزون', () => {
  factory.seed(BASE());
  const r = newArabon();
  const del = BL.deleteArabon(r.arabonId);
  ok(del.success, 'فشل الحذف: ' + del.reason);
  const d = D();
  eq(stockOf(1), 10, 'المخزون أُعيد');
  eq(d.transactions.length, 0, 'لا قيود يتيمة');
  eq(d.stockMovements.length, 0, 'لا حركات مخزون يتيمة');
  return 'مخزون 9 → 10';
});

// ═══════════ 3) اختبارات المخزون ═══════════
test('مخزون: شراء مخزون', () => {
  factory.seed(BASE());
  const r = BL.purchaseStock({ productId: 1, qty: 3, accountId: 1, cashAmount: 0, bankAmount: 0, date: '2026-01-01T10:00:00.000Z' });
  ok(r.success, 'فشل الشراء: ' + r.reason);
  eq(stockOf(1), 13, 'المخزون');
  eq(stockMatchesMovements(1, 10), 13, 'مطابقة الحركات');
  return '+3';
});

test('مخزون: بيع نقدي', () => {
  factory.seed(BASE());
  const r = BL.sellCash({ productId: 1, qty: 2, accountId: 1, date: '2026-01-02T10:00:00.000Z' });
  ok(r.success, 'فشل البيع: ' + r.reason);
  eq(stockOf(1), 8, 'المخزون');
  eq(stockMatchesMovements(1, 10), 8, 'مطابقة الحركات');
  eq(D().transactions[0].amount, 26000, 'قيمة البيع');
  return '-2';
});

test('مخزون: بيع لتاجر + عقد + عربون مطابقة كاملة', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  newInst();
  newArabon({ productId: 3, sellPrice: 8000, depositAmount: 1000, deviceName: 'Samsung A54' });
  const bad = D().products.filter(p => {
    const init = BASE().products.find(x => x.id === p.id).stock;
    return Math.abs(p.stock - stockMatchesMovements(p.id, init)) > 0.01;
  });
  eq(bad.length, 0, 'أصناف مخزونها لا يطابق حركاتها: ' + bad.map(b => b.name).join(','));
  return '3 أصناف متطابقة';
});

test('مخزون: حذف عقد بلا دفعات يعيد الكمية', () => {
  factory.seed(BASE());
  const r = newInst();
  eq(stockOf(1), 9, 'بعد العقد');
  const del = BL.deleteInstallment(r.installmentId);
  ok(del.success, 'فشل الحذف: ' + del.reason);
  eq(stockOf(1), 10, 'بعد الحذف');
  eq(D().stockMovements.length, 0, 'لا حركات يتيمة');
  return '9 → 10';
});

// ═══════════ 4) اختبارات التجار ═══════════
test('تجار: بيع للتاجر ثم الرصيد', () => {
  factory.seed(BASE());
  const r = BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(r.success, 'فشل البيع: ' + r.reason);
  let parts = BL.merchantBalanceParts(2);
  eq(parts.totalSales, 26000, 'إجمالي المبيعات');
  eq(parts.saleCash, 0, 'البيع الآجل لا يُنشئ سداداً فورياً');
  eq(parts.balance, 26000, 'الرصيد بعد البيع الآجل = كامل القيمة');
  ok(BL.merchantReconciliation(2).ok, 'المطابقة بعد البيع');
  const pay = BL.recordMerchantPaymentIn({ merchantId: 2, amount: 10000, accountId: 1, date: '2026-01-04T10:00:00.000Z' });
  ok(pay.success, 'فشل الدفعة: ' + pay.reason);
  parts = BL.merchantBalanceParts(2);
  eq(parts.balance, 16000, 'الرصيد بعد تحصيل 10000');
  eq(parts.balance, parts.totalSales + parts.totalPaymentsOut - parts.totalPayments - parts.totalPurchases, 'معادلة الرصيد');
  return 'رصيد 16000';
});

test('تجار: شراء من التاجر ودفعات', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const p = BL.purchaseFromMerchant({ merchantId: 2, qty: 5, costPrice: 100, accountId: 1, productName: 'جراب', date: '2026-01-04T10:00:00.000Z' });
  ok(p.success, 'فشل الشراء: ' + p.reason);
  const pay = BL.recordMerchantPaymentIn({ merchantId: 2, amount: 5000, accountId: 1, date: '2026-01-05T10:00:00.000Z' });
  ok(pay.success, 'فشل الدفعة: ' + pay.reason);
  const out = BL.recordMerchantPaymentOut({ merchantId: 2, amount: 2000, accountId: 1, date: '2026-01-06T10:00:00.000Z' });
  ok(out.success, 'فشل الدفعة الصادرة: ' + out.reason);
  const parts = BL.merchantBalanceParts(2);
  eq(parts.totalPurchases, 500, 'المشتريات');
  eq(parts.balance, 22500, 'الرصيد الصافي بعد الخصم والمشتريات والدفعتين');
  eq(parts.balance, parts.totalSales + parts.totalPaymentsOut - parts.totalPayments - parts.totalPurchases, 'معادلة الرصيد');
  const rec = BL.merchantReconciliation(2);
  ok(rec.ok, 'المطابقة يجب أن تنجح: ' + JSON.stringify(rec.issues));
  return 'رصيد ' + parts.balance.toFixed(2);
});

test('تجار: منتجان بنفس الاسم بتكلفتين مختلفتين — التكلفة بالمعرف', () => {
  factory.seed(BASE());
  // بيع المنتج رقم 2 (تكلفة 9000) واسمه مطابق للمنتج رقم 1 (تكلفة 10500)
  const r = BL.sellToMerchant({ merchantId: 2, productId: 2, qty: 2, actualTotal: 24000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(r.success, 'فشل البيع: ' + r.reason);
  const inc = computeIncomeStatement({ from: null, to: null });
  eq(inc.revenue, 24000, 'الإيراد');
  eq(inc.cogs, 18000, 'التكلفة = 9000 × 2 (منتج البيع نفسه)');
  eq(inc.grossProfit, 6000, 'إجمالي الربح');
  const sale = D().merchantSales[0];
  eq(sale.unitCost, 9000, 'لقطة التكلفة من المنتج المباع');
  const ms = D().merchantSales[0];
  eq(calcTransactionProfit({ type: 'merchant_sale', amount: 24000, sourceId: ms.transactionId }), 6000, 'ربح العملية للعمولة');
  return 'COGS 18000 لا 21000';
});

test('تجار: سجل قديم بلا معرف وتكلفة من لقطة البيع', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const d = D();
  eq(d.merchantSales[0].unitCost, 10500, 'لقطة التكلفة محفوظة');
  // سجل قديم: بلا productId والاسم مكرر → لا يجوز اختيار تكلفة عشوائية
  factory.set('merchantSales', [{ id: 99, merchantId: 2, productId: null, deviceName: 'iPhone 13', sellPrice: 12000, quantity: 1, transactionId: 'x' }]);
  eq(BL.findProductForRecord({ deviceName: 'iPhone 13' }), null, 'لا مطابقة بالاسم عند التكرار');
  eq(uniqueProductByName('iPhone 13'), null, 'الدالة المساعدة ترفض الاسم المكرر');
  ok(uniqueProductByName('Samsung A54') !== null, 'الاسم الفريد يُطابق');
  return 'لا اختيار تكلفة خاطئة';
});

test('تجار: كشف المطابقة يكتشف قيداً مكرراً', () => {
  factory.seed(BASE());
  const pay = BL.recordMerchantPaymentIn({ merchantId: 2, amount: 5000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(pay.success, 'فشل تسجيل الدفعة: ' + pay.reason);
  const d = D();
  const dup = Object.assign({}, d.transactions.find(t => t.type === 'payment_in'));
  dup.id = 'dup-1';
  factory.set('transactions', d.transactions.concat([dup]));
  const rec = BL.merchantReconciliation(2);
  eq(rec.ok, false, 'يجب كشف الخلل');
  ok(rec.issues.some(i => i.code === 'MERCH_DUP_TX'), 'كود القيد المكرر');
  return rec.issues.map(i => i.code).join(',');
});

test('تجار: كشف المطابقة يكتشف قيداً يتيماً', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const d = D();
  factory.set('transactions', d.transactions.concat([{
    id: 'orphan-1', type: 'merchant_sale', amount: 999, merchantId: 2,
    sourceType: 'merchant_sale', sourceId: 'missing-source', operationType: 'create', date: '2026-01-03T10:00:00.000Z'
  }]));
  const rec = BL.merchantReconciliation(2);
  eq(rec.ok, false, 'يجب كشف الخلل');
  ok(rec.issues.some(i => i.code === 'MERCH_TX_ORPHAN'), 'كود القيد اليتيم');
  return rec.issues.map(i => i.code).join(',');
});

test('تجار: كشف المطابقة يكتشف دفعة بلا قيد مالي', () => {
  factory.seed(BASE());
  const pay = BL.recordMerchantPaymentIn({ merchantId: 2, amount: 5000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(pay.success, 'فشل تسجيل الدفعة: ' + pay.reason);
  const d = D();
  const ids = pay.transactionIds || [];
  factory.set('transactions', d.transactions.filter(t => !ids.includes(t.id)));
  const rec = BL.merchantReconciliation(2);
  ok(rec.issues.some(i => i.code === 'MERCH_PAY_IN_NO_TX'), 'كود الدفعة بلا قيد');
  return rec.issues.map(i => i.code).join(',');
});

test('تجار: السداد الفوري القديم لا يدخل في رصيد التاجر ولا يُبلَّغ عنه كذمة', () => {
  factory.seed(BASE());
  const sale = BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(sale.success, 'فشل البيع: ' + sale.reason);
  // محاكاة سجل قديم أنشأ قيد «سداد فوري» بمبلغ 13000 عند البيع
  const d = D();
  factory.set('transactions', d.transactions.concat([{
    id: 'legacy-cash-1', type: 'merchant_sale', amount: 13000, merchantId: 2,
    sourceType: 'merchant_sale', sourceId: String(sale.sourceId) + '_c', operationType: 'create',
    date: '2026-01-03T10:00:00.000Z'
  }]));
  const parts = BL.merchantBalanceParts(2);
  eq(parts.balance, 26000, 'الرصيد = كامل قيمة البيع الآجل');
  const rec = BL.merchantReconciliation(2);
  eq(rec.ok, true, 'لا يُبلَّغ عن ذمة: ' + JSON.stringify(rec.issues));
  return 'ذمة 26000 بلا سداد فوري';
});

test('تجار: المطابقة لا تعدّل أي رصيد تلقائياً', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const d = D();
  factory.set('transactions', d.transactions.concat([{
    id: 'orphan-2', type: 'merchant_sale', amount: 500, merchantId: 2,
    sourceType: 'merchant_sale', sourceId: 'missing-2', operationType: 'create', date: '2026-01-03T10:00:00.000Z'
  }]));
  const before = JSON.stringify(D());
  const rec = BL.merchantReconciliation(2);
  eq(rec.ok, false, 'يوجد خلل');
  eq(JSON.stringify(D()), before, 'لم تتغير البيانات');
  return 'قراءة فقط';
});

// ═══════════ 5) اختبارات الفشل والتراجع ═══════════
function withBroken(method, fn) {
  const orig = BL[method];
  BL[method] = () => null;
  try { return fn(); } finally { BL[method] = orig; }
}

test('فشل: تعديل عقد يفشل مالياً لا يغيّر المخزون ولا العقد', () => {
  factory.seed(BASE());
  const r = newInst();
  BL.recordInstallmentPayment({ installmentId: r.installmentId, amount: 1000, accountId: 1, date: '2026-02-05T10:00:00.000Z' });
  // عقد بلا قيد مقدم (حالة قديمة/تالفة) حتى نختبر مسار إنشاء القيد نفسه
  factory.set('transactions', D().transactions.filter(t => t.operationType !== 'upfront'));
  const before = JSON.stringify(D());
  const res = withBroken('postTransaction', () => BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 3, purchasePrice: 15000,
    paidUpfront: 4000, interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05'
  }));
  eq(res.success, false, 'يجب أن يفشل التعديل');
  eq(res.reason, 'transaction_failed', 'سبب الفشل');
  eq(JSON.stringify(D()), before, 'تراجع كامل بلا أي تغيير');
  return 'rollback تام';
});

test('فشل: تعديل عقد يفشل في حركة المخزون يتراجع عن القيد أيضاً', () => {
  factory.seed(BASE());
  const r = newInst();
  const before = JSON.stringify(D());
  const res = withBroken('addStockMovement', () => BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 3, purchasePrice: 13000,
    paidUpfront: 6000, interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05'
  }));
  eq(res.success, false, 'يجب أن يفشل التعديل');
  eq(res.reason, 'stock_movement_failed', 'سبب الفشل');
  eq(JSON.stringify(D()), before, 'تراجع عن تحديث المقدم وعن المخزون');
  return 'rollback تام';
});

test('فشل: تعديل عربون يفشل مالياً لا يغيّر شيئاً', () => {
  factory.seed(BASE());
  const r = newArabon({ depositAmount: 0 }); // بلا قيد عربون حتى نختبر مسار الإنشاء
  const before = JSON.stringify(D());
  const res = withBroken('postTransaction', () => BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 3, sellPrice: 9000, depositAmount: 3000,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  }));
  eq(res.success, false, 'يجب أن يفشل التعديل');
  eq(res.reason, 'transaction_failed', 'سبب الفشل');
  eq(JSON.stringify(D()), before, 'تراجع كامل');
  return 'rollback تام';
});

test('فشل: تعديل عربون يفشل في حركة المخزون يتراجع كاملاً', () => {
  factory.seed(BASE());
  const r = newArabon();
  const before = JSON.stringify(D());
  const res = withBroken('addStockMovement', () => BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 3, sellPrice: 8000, depositAmount: 2500,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  }));
  eq(res.success, false, 'يجب أن يفشل التعديل');
  eq(res.reason, 'stock_movement_failed', 'سبب الفشل');
  eq(JSON.stringify(D()), before, 'تراجع عن المخزون وعن القيد');
  return 'rollback تام';
});

test('فشل: إعادة المحاولة بعد الفشل لا تكرر القيود ولا الخصم', () => {
  factory.seed(BASE());
  const r = newInst();
  withBroken('postTransaction', () => BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 3, purchasePrice: 15000,
    paidUpfront: 4000, interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05'
  }));
  const res = BL.editInstallment({
    installmentId: r.installmentId, merchantId: 1, productId: 3, purchasePrice: 15000,
    paidUpfront: 4000, interestRate: 0, numInstallments: 10, firstDueDate: '2026-01-05'
  });
  ok(res.success, 'إعادة المحاولة يجب أن تنجح: ' + res.reason);
  const d = D();
  eq(d.transactions.filter(t => t.operationType === 'upfront').length, 1, 'قيد مقدم واحد');
  eq(d.stockMovements.filter(m => m.sourceType === 'installment').length, 1, 'حركة مخزون واحدة');
  eq(stockOf(3), 3, 'خصم واحد من الصنف الجديد');
  eq(stockOf(1), 10, 'إعادة الكمية للصنف القديم');
  return 'بلا تكرار';
});

test('فشل: تعديل عربون ثم إعادة المحاولة بلا تكرار', () => {
  factory.seed(BASE());
  const r = newArabon();
  withBroken('addStockMovement', () => BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 3, sellPrice: 8000, depositAmount: 2500,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  }));
  const res = BL.editArabon({
    arabonId: r.arabonId, merchantId: 1, productId: 3, sellPrice: 8000, depositAmount: 2500,
    accountId: 1, dueDate: '2026-02-01', notes: '', employeeId: null
  });
  ok(res.success, 'إعادة المحاولة يجب أن تنجح: ' + res.reason);
  const d = D();
  eq(d.transactions.filter(t => t.operationType === 'deposit').length, 1, 'قيد عربون واحد');
  eq(d.stockMovements.filter(m => m.sourceType === 'arabon').length, 1, 'حركة مخزون واحدة');
  eq(d.arabonSales[0].remainingAmount, 5500, 'المتبقي');
  return 'بلا تكرار';
});

// ═══════════ 6) تجار: تعديل وحذف بيع/شراء (ذرّي) ═══════════
test('تجار: تعديل بيع ذرّي يضبط المخزون والحركة والقيد', () => {
  factory.seed(BASE());
  const s = BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(s.success, 'فشل البيع: ' + s.reason);
  eq(stockOf(1), 8, 'المخزون بعد البيع');
  const saleId = D().merchantSales[0].id;
  const r = BL.editMerchantSaleAtomic({ saleId, quantity: 3, sellPrice: 14000, notes: 'معدل' });
  ok(r.success, 'فشل التعديل: ' + r.reason);
  const d = D();
  eq(stockOf(1), 7, 'المخزون بعد التعديل');
  eq(d.merchantSales[0].quantity, 3, 'الكمية');
  eq(d.merchantSales[0].sellPrice, 14000, 'السعر');
  eq(d.merchantSales[0].notes, 'معدل', 'الملاحظات');
  const mv = d.stockMovements.filter(m => m.sourceType === 'merchant_sale');
  eq(mv.length, 1, 'حركة مخزون واحدة');
  eq(mv[0].qty, 3, 'كمية الحركة');
  const tx = d.transactions.filter(t => t.sourceType === 'merchant_sale');
  eq(tx.length, 0, 'البيع الآجل لا يُنشئ قيداً مالياً');
  eq(stockMatchesMovements(1, 10), 7, 'مطابقة الحركات');
  return '3 × 14000';
});

test('تجار: تعديل بيع يفشل عند نقص المخزون بلا أي تغيير', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const saleId = D().merchantSales[0].id;
  const before = JSON.stringify(D());
  const r = BL.editMerchantSaleAtomic({ saleId, quantity: 20, sellPrice: 13000 });
  eq(r.success, false, 'يجب أن يُرفض');
  eq(r.reason, 'insufficient_stock', 'سبب الرفض');
  eq(JSON.stringify(D()), before, 'لا تغيير في البيانات');
  return 'المخزون 8 لا يكفي 20';
});

test('تجار: تعديل بيع يتراجع عند فشل حركة المخزون', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const saleId = D().merchantSales[0].id;
  const before = JSON.stringify(D());
  const r = withBroken('addStockMovement', () => BL.editMerchantSaleAtomic({ saleId, quantity: 3, sellPrice: 14000 }));
  eq(r.success, false, 'يجب أن يفشل');
  eq(r.reason, 'stock_movement_failed', 'سبب الفشل');
  eq(JSON.stringify(D()), before, 'تراجع كامل');
  return 'rollback تام';
});

test('تجار: حذف بيع يعيد الكمية مرة واحدة ويترك بيانات نظيفة', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  eq(stockOf(1), 8, 'قبل الحذف');
  const r = BL.deleteMerchantSaleAtomic(D().merchantSales[0].id);
  ok(r.success, 'فشل الحذف: ' + r.reason);
  const d = D();
  eq(stockOf(1), 10, 'المخزون أُعيد مرة واحدة');
  eq(d.merchantSales.length, 0, 'السجل حُذف');
  eq(d.transactions.length, 0, 'لا قيود يتيمة');
  eq(d.stockMovements.length, 0, 'لا حركات يتيمة');
  return '8 → 10';
});

test('تجار: تعديل شراء ذرّي يضبط المخزون والقيد', () => {
  factory.seed(BASE());
  const p = BL.purchaseFromMerchant({ merchantId: 2, qty: 5, costPrice: 100, accountId: 1, productName: 'جراب', date: '2026-01-04T10:00:00.000Z' });
  ok(p.success, 'فشل الشراء: ' + p.reason);
  const rec = D().merchantPurchases[0];
  const pid = rec.productId;
  const stockBefore = D().products.find(x => x.id == pid).stock;
  eq(stockBefore, 5, 'مخزون الشراء');
  const r = BL.editMerchantPurchaseAtomic({ purchaseId: rec.id, quantity: 2, costPrice: 120 });
  ok(r.success, 'فشل التعديل: ' + r.reason);
  const d = D();
  eq(d.products.find(x => x.id == pid).stock, 2, 'المخزون بعد تقليل الكمية');
  eq(d.merchantPurchases[0].costPrice, 120, 'سعر الشراء');
  const mv = d.stockMovements.filter(m => m.sourceType === 'merchant_purchase');
  eq(mv.length, 1, 'حركة شراء واحدة');
  eq(mv[0].qty, 2, 'كمية الحركة');
  const tx = d.transactions.filter(t => t.sourceType === 'merchant_purchase');
  eq(tx.length, 0, 'الشراء الآجل لا يُنشئ قيداً مالياً');
  eq(BL.merchantBalanceParts(2).totalPurchases, 240, 'المشتريات في الرصيد');
  return '5 → 2 بمبلغ 240';
});

test('تجار: حذف شراء مرفوض إذا نفد المخزون', () => {
  factory.seed(BASE());
  const p = BL.purchaseFromMerchant({ merchantId: 2, qty: 5, costPrice: 100, accountId: 1, productName: 'جراب', date: '2026-01-04T10:00:00.000Z' });
  ok(p.success, 'فشل الشراء: ' + p.reason);
  const rec = D().merchantPurchases[0];
  BL.sellCash({ productId: rec.productId, qty: 4, accountId: 1, date: '2026-01-05T10:00:00.000Z' });
  const before = JSON.stringify(D());
  const r = BL.deleteMerchantPurchaseAtomic(rec.id);
  eq(r.success, false, 'يجب أن يُرفض الحذف');
  eq(r.reason, 'insufficient_stock', 'سبب الرفض');
  eq(JSON.stringify(D()), before, 'لا تغيير في البيانات');
  return 'المخزون 1 والمطلوب 5';
});

test('تجار: إعادة المحاولة بعد فشل تعديل البيع بلا تكرار', () => {
  factory.seed(BASE());
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 2, actualTotal: 26000, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  const saleId = D().merchantSales[0].id;
  withBroken('addStockMovement', () => BL.editMerchantSaleAtomic({ saleId, quantity: 3, sellPrice: 14000 }));
  const r = BL.editMerchantSaleAtomic({ saleId, quantity: 3, sellPrice: 14000 });
  ok(r.success, 'إعادة المحاولة يجب أن تنجح: ' + r.reason);
  const d = D();
  eq(d.stockMovements.filter(m => m.sourceType === 'merchant_sale').length, 1, 'حركة واحدة');
  eq(d.transactions.filter(t => t.sourceType === 'merchant_sale').length, 0, 'لا قيود مالية للبيع الآجل');
  eq(stockOf(1), 7, 'خصم 3 فقط');
  return 'بلا تكرار';
});

// ═══════════ مطابقة الصنف في الشراء من التاجر ═══════════
test('تجار: شراء بـ productId يذهب للصنف الصحيح مع تكرار الاسم', () => {
  factory.seed(BASE());
  const s1 = stockOf(1), s2 = stockOf(2);
  const r = BL.purchaseFromMerchant({ merchantId: 2, productId: 2, qty: 3, costPrice: 100, accountId: 1, productName: 'iPhone 13', date: '2026-01-04T10:00:00.000Z' });
  ok(r.success, 'فشل الشراء: ' + r.reason);
  eq(stockOf(2), s2 + 3, 'مخزون الصنف المطلوب');
  eq(stockOf(1), s1, 'الصنف الآخر بلا تغيير');
  const d = D();
  eq(d.merchantPurchases[0].productId, 2, 'السجل مرتبط بالصنف المطلوب');
  const mv = d.stockMovements.filter(m => m.sourceType === 'merchant_purchase');
  eq(mv.length, 1, 'حركة مخزون واحدة');
  eq(mv[0].productId, 2, 'الحركة على الصنف المطلوب');
  return 'الصنف 2 زاد 3 والصنف 1 ثابت';
});

test('تجار: شراء باسم مكرر بلا productId يُرفض بلا تغيير', () => {
  factory.seed(BASE());
  const before = JSON.stringify(D());
  const r = BL.purchaseFromMerchant({ merchantId: 2, qty: 2, costPrice: 100, accountId: 1, productName: 'iPhone 13', date: '2026-01-04T10:00:00.000Z' });
  eq(r.success, false, 'يجب الرفض');
  eq(r.reason, 'ambiguous_product_name', 'سبب الرفض');
  eq(JSON.stringify(D()), before, 'لا تغيير في البيانات');
  const okr = BL.purchaseFromMerchant({ merchantId: 2, qty: 1, costPrice: 50, productName: 'جراب فريد', date: '2026-01-04T11:00:00.000Z' });
  ok(okr.success, 'الاسم الفريد يجب أن يعمل: ' + okr.reason);
  eq(D().products.filter(p => p.name === 'جراب فريد').length, 1, 'صنف جديد واحد');
  return 'رفض المكرر وقبول الفريد';
});

// ─────────── التقرير ───────────
const pass = results.filter(r => r.ok).length;
const fail = results.length - pass;
const w = Math.max(...results.map(r => r.name.length));
console.log('\n' + '='.repeat(w + 12));
results.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(2)}. ${r.ok ? '✅' : '❌'} ${r.name.padEnd(w)} ${r.note ? '— ' + r.note : ''}`);
});
console.log('='.repeat(w + 12));
console.log(`النتيجة: ${pass} ناجح / ${fail} فاشل من ${results.length}`);
process.exit(fail ? 1 : 0);