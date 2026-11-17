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

const FN = ['calcTransactionProfit', 'computeIncomeStatement', 'recognizeInstallmentInterest', 'uniqueProductByName', 'getInstSchedule', 'slotPaidDate', 'paidScheduleSlots', 'slotPayDesc', 'installmentRemaining', 'buildGeneralStatementRows', 'buildComprehensiveRows',
  '__cloneDeep', 'snapshotAll', 'restoreAllSnap', 'recordUndoPoint',
  'repairMoney', 'repairTable', 'repairRow', 'repairPlan'].map(n => extractFunction(js, n)).join('\n');

const factory = new Function(`
let products = [], merchants = [], transactions = [], installments = [], msgTemplates = {};
let merchantSales = [], merchantPayments = [], merchantPurchases = [], merchantPaymentsOut = [];
let partners = [], accounts = [], stockMovements = [], arabonSales = [], employees = [];
let recurringExpenses = [], auditLog = [], expenseCategories = [], incomeCategories = [];
let recycleBin = [], backups = [], periodLockDate = null;
let openingCapital = 0, db = null, __seq = 0, __admin = true;
let __undoStack = [], __undoSuppress = 0, __undoLastSnap = null, __undoPendingLabel = '', __undoReady = true;
const AUDIT_LOG_MAX = 1000, UNDO_MAX = 10;
function saveData() {}
function logAudit(action, entity, ref, detail) {
  auditLog.push({ action, entity, ref, detail, ts: Date.now() });
  if (auditLog.length > AUDIT_LOG_MAX) auditLog.splice(0, auditLog.length - AUDIT_LOG_MAX);
}
function refreshUndoButton() {}
function isAdminSession() { return __admin; }
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
const INCOME_TRANS_TYPES = ['sell_cash', 'payment_in', 'sell', 'income', 'partner_deposit', 'merchant_sale', 'transfer_in', 'purchase_return', 'installment_paid', 'arabon_paid'];
const EXPENSE_TRANS_TYPES = ['purchase', 'expense', 'partner_withdrawal', 'merchant_purchase', 'payment_out', 'transfer_out', 'sale_return'];
${blSrc}
${FN}
return {
  BL: BusinessLogic,
  calcTransactionProfit, computeIncomeStatement, uniqueProductByName,
  buildComprehensiveRows, buildGeneralStatementRows,
  snapshotAll, restoreAllSnap, recordUndoPoint, repairPlan,
  // يحاكي ما يفعله saveData(): تسجيل نقطة ثم تحديث اللقطة الحالية
  tick(label) { recordUndoPoint(label); __undoLastSnap = snapshotAll(); },
  undoCount() { return __undoStack.length; },
  undoTop() { return __undoStack.length ? __undoStack[__undoStack.length - 1] : null; },
  resetUndo() { __undoStack = []; __undoLastSnap = null; __undoPendingLabel = ''; },
  seed(d) {
    products = d.products || []; merchants = d.merchants || []; accounts = d.accounts || [];
    employees = d.employees || []; partners = d.partners || [];
    transactions = d.transactions || []; installments = d.installments || [];
    arabonSales = d.arabonSales || []; stockMovements = d.stockMovements || [];
    merchantSales = []; merchantPurchases = []; merchantPayments = []; merchantPaymentsOut = [];
    auditLog = []; openingCapital = d.openingCapital || 0; __seq = 0;
    __undoStack = []; __undoLastSnap = null; __undoPendingLabel = '';
    recycleBin = []; backups = []; periodLockDate = null;
  },
  dump() {
    return JSON.parse(JSON.stringify({ products, merchants, transactions, installments, arabonSales, stockMovements, merchantSales, merchantPurchases, merchantPayments, merchantPaymentsOut, accounts, openingCapital }));
  },
  set(name, v) {
    if (name === 'transactions') transactions = v;
    else if (name === 'products') products = v;
    else if (name === 'merchantSales') merchantSales = v;
    else if (name === 'accounts') accounts = v;
    else if (name === 'installments') installments = v;
    else if (name === 'arabonSales') arabonSales = v;
    else if (name === 'partners') partners = v;
    else if (name === 'stockMovements') stockMovements = v;
    else if (name === 'openingCapital') openingCapital = v;
  },
  setAdmin(v) { __admin = !!v; },
  get(name) { return eval(name); }
};
`)();

const { BL, calcTransactionProfit, computeIncomeStatement, uniqueProductByName, buildComprehensiveRows, buildGeneralStatementRows } = factory;

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

test('تقسيط: فائدة العقد تُعترف زمنياً وتظهر في الفترات اللاحقة', () => {
  factory.seed(BASE());
  // 10000 ممولة × 20% = 2000 فائدة، 10 أقساط أولها 2026-02-05
  newInst({ interestRate: 20, numInstallments: 10, firstDueDate: '2026-02-05', date: '2026-01-01T10:00:00.000Z' });
  const monthRange = (y, m) => ({ from: new Date(y, m - 1, 1, 0, 0, 0, 0), to: new Date(y, m, 0, 23, 59, 59, 999) });
  const full = computeIncomeStatement({ from: new Date('2026-01-01T00:00:00'), to: new Date('2026-12-31T23:59:59') });
  eq(full.interestProfit, 2000, 'فائدة العقد كاملة داخل مدته');
  let sum = 0;
  for (let m = 1; m <= 12; m++) sum += computeIncomeStatement(monthRange(2026, m)).interestProfit;
  eq(sum, 2000, 'مجموع الفوائد الشهرية = فائدة العقد (بلا تكرار أو نقص)');
  const june = computeIncomeStatement(monthRange(2026, 6));
  ok(june.interestProfit > 0, 'يجب أن تُعترف الفائدة في شهر لاحق لتاريخ التعاقد');
  ok(june.interestProfit < 1000, 'وليست كاملة في شهر واحد');
  const before = computeIncomeStatement(monthRange(2025, 12));
  eq(before.interestProfit, 0, 'لا فائدة قبل التعاقد');
  return 'فائدة يونيو ' + june.interestProfit.toFixed(2);
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

test('مخزون: شراء يحتسب المصروفات الإضافية في المبلغ المدفوع', () => {
  factory.seed(BASE());
  const before = BL.stockValue();
  const r = BL.purchaseStock({ productId: 1, qty: 3, accountId: 1, date: '2026-01-01T10:00:00.000Z' });
  ok(r.success, 'فشل الشراء: ' + r.reason);
  const tx = D().transactions.find(t => t.type === 'purchase');
  eq(tx.amount, 31500, 'المبلغ المدفوع = (10000 + 500) × 3');
  eq(BL.stockValue() - before, 31500, 'زيادة تقييم المخزون تساوي المبلغ المدفوع');
  return '10500 × 3';
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

// ═══════════ 7) الحسابات: ضوابط المرحلة الأولى ═══════════
test('حسابات: تحويل المبالغ النصية عند حساب الرصيد', () => {
  factory.seed(BASE());
  factory.set('transactions', [
    { id: 's1', type: 'sell_cash', amount: '1500', accountId: 1, date: '2026-01-01T10:00:00.000Z' },
    { id: 'e1', type: 'expense', amount: '500', accountId: 1, date: '2026-01-02T10:00:00.000Z' }
  ]);
  eq(BL.accountBalance(1), 1000, 'الرصيد بعد جمع/خصم نصوص رقمية');
  return '1500 - 500 = 1000';
});

test('حسابات: أنواع التحصيل القديمة تُحتسب داخلًا', () => {
  factory.seed(BASE());
  factory.set('transactions', [
    { id: 'old1', type: 'installment_paid', amount: 700, accountId: 1, date: '2026-01-01T10:00:00.000Z' },
    { id: 'old2', type: 'arabon_paid', amount: 300, accountId: 2, date: '2026-01-02T10:00:00.000Z' }
  ]);
  eq(BL.accountBalance(1), 700, 'قسط قديم داخل الخزينة');
  eq(BL.accountBalance(2), 300, 'عربون قديم داخل البنك');
  eq(BL.liquidTotals().total, 1000, 'إجمالي السيولة يشمل النوعين');
  return '700 + 300';
});

test('حسابات: منع ازدواج رأس المال عند إضافة/تعديل حساب', () => {
  factory.seed(BASE());
  factory.set('openingCapital', 10000);
  const addWithSeed = BL.validateAccount({ id: null, name: 'حساب جديد', type: 'bank', balance: 5000 });
  eq(addWithSeed.success, false, 'يجب رفض رصيد افتتاحي مع رأس مال مسجل');
  eq(addWithSeed.reason, 'double_opening', 'سبب الرفض');
  const addZero = BL.validateAccount({ id: null, name: 'حساب جديد', type: 'bank', balance: 0 });
  eq(addZero.success, true, 'رصيد صفري مسموح');
  const editSame = BL.validateAccount({ id: 1, name: 'الخزينة', type: 'cash', balance: 0 });
  eq(editSame.success, true, 'تعديل بيانات حساب قائم دون تغيير رصيده مسموح');
  return 'منع الازدواج';
});

test('حسابات: منع تكرار الاسم مع السماح بتعديل حساب قائم بنفس اسمه', () => {
  factory.seed(BASE());
  const dup = BL.validateAccount({ id: null, name: ' البنك ', type: 'bank', balance: 0 });
  eq(dup.success, false, 'يجب رفض الاسم المكرر');
  eq(dup.reason, 'duplicate_name', 'سبب الرفض');
  const renameDup = BL.validateAccount({ id: 1, name: 'البنك', type: 'cash', balance: 0 });
  eq(renameDup.success, false, 'يجب رفض إعادة التسمية لاسم موجود');
  const keep = BL.validateAccount({ id: 1, name: 'الخزينة', type: 'cash', balance: 0 });
  eq(keep.success, true, 'الإبقاء على الاسم نفسه مسموح');
  const renameOk = BL.validateAccount({ id: 1, name: 'الخزينة الرئيسية', type: 'cash', balance: 0 });
  eq(renameOk.success, true, 'اسم جديد غير مكرر مسموح');
  return 'اسم فريد';
});

test('حسابات: منع رأس مال افتتاحي مع وجود أرصدة افتتاح حسابات', () => {
  factory.seed(BASE());
  factory.set('accounts', [{ id: 1, name: 'الخزينة', type: 'cash', balance: 5000 }]);
  const blocked = BL.validateOpeningCapital(10000);
  eq(blocked.success, false, 'يجب رفض رأس المال مع وجود أرصدة افتتاح');
  eq(blocked.reason, 'double_opening', 'سبب الرفض');
  eq(BL.validateOpeningCapital(0).success, true, 'تصفير رأس المال مسموح');
  factory.set('accounts', [{ id: 1, name: 'الخزينة', type: 'cash', balance: 0 }]);
  eq(BL.validateOpeningCapital(10000).success, true, 'رأس مال بدون أرصدة افتتاح مسموح');
  return 'مصدر واحد لرأس المال';
});

// ═══════════ 8) المرحلة الثانية: كود ثابت + قفل النوع + الأرشفة ═══════════
test('حسابات: إسناد كود ثابت للحسابات القديمة دون تغيير الأكواد الصالحة', () => {
  factory.seed(BASE());
  factory.set('accounts', [
    { id: 1, name: 'خزينة', type: 'cash', balance: 0 },
    { id: 2, name: 'بنك', type: 'bank', balance: 0, code: 'ACC-007' },
    { id: 3, name: 'محفظة', type: 'vodafone', balance: 0 }
  ]);
  const assigned = BL.ensureAccountCodes();
  const accs = factory.get('accounts');
  eq(assigned, 2, 'عدد الأكواد المُسندة');
  eq(accs[0].code, 'ACC-008', 'أول حساب قديم يأخذ أكبر رقم + 1');
  eq(accs[1].code, 'ACC-007', 'الكود الصالح لا يتغير');
  eq(accs[2].code, 'ACC-009', 'الحساب التالي يكمل التسلسل');
  eq(BL.nextAccountCode(), 'ACC-010', 'الكود التالي');
  eq(BL.ensureAccountCodes(), 0, 'تشغيل الترحيل مرة ثانية لا يغيّر شيئًا');
  return 'ACC-007 محفوظ + ACC-008/009 مُسندان';
});

test('حسابات: إصلاح الأكواد المكررة وعدم تكرارها', () => {
  factory.seed(BASE());
  factory.set('accounts', [
    { id: 1, name: 'A', type: 'cash', balance: 0, code: 'acc-001' },
    { id: 2, name: 'B', type: 'bank', balance: 0, code: 'ACC-001' },
    { id: 3, name: 'C', type: 'bank', balance: 0, code: 'ACC-001' }
  ]);
  BL.ensureAccountCodes();
  const accs = factory.get('accounts');
  const codes = accs.map(a => a.code);
  eq(codes[0], 'ACC-001', 'الكود الأول محفوظ ومطبّع');
  eq(new Set(codes).size, 3, 'كل الأكواد فريدة');
  eq(codes[1], 'ACC-002', 'المكرر الأول يُعاد إسناده');
  eq(codes[2], 'ACC-003', 'المكرر الثاني يُعاد إسناده');
  return codes.join(', ');
});

test('حسابات: قفل نوع الحساب بعد أول حركة', () => {
  factory.seed(BASE());
  factory.set('transactions', [
    { id: 't1', type: 'sell_cash', amount: 100, accountId: 1, date: '2026-01-01T10:00:00.000Z' }
  ]);
  const locked = BL.validateAccount({ id: 1, name: 'الخزينة', type: 'bank', balance: 0 });
  eq(locked.success, false, 'تغيير النوع مرفوض بعد الحركة');
  eq(locked.reason, 'type_locked', 'سبب الرفض');
  eq(locked.currentType, 'cash', 'النوع الحالي');
  const sameType = BL.validateAccount({ id: 1, name: 'الخزينة', type: 'cash', balance: 0 });
  eq(sameType.success, true, 'نفس النوع مسموح');
  const rename = BL.validateAccount({ id: 1, name: 'الخزينة الرئيسية', type: 'cash', balance: 0 });
  eq(rename.success, true, 'تغيير الاسم مسموح مع قفل النوع');
  factory.set('transactions', []);
  const free = BL.validateAccount({ id: 1, name: 'الخزينة', type: 'bank', balance: 0 });
  eq(free.success, true, 'تغيير النوع مسموح قبل أي حركة');
  return 'النوع مقفول بعد الحركة وحر قبلها';
});

test('حسابات: الأرشفة بدل الحذف مع حفظ التاريخ والرصيد الصفري', () => {
  factory.seed(BASE());
  factory.set('transactions', [
    { id: 't1', type: 'sell_cash', amount: 100, accountId: 1, date: '2026-01-01T10:00:00.000Z' }
  ]);
  const nonZero = BL.archiveAccount(2);
  eq(nonZero.success, true, 'حساب برصيد صفري يُؤرشف');
  eq(BL.accountActivity(2), 0, 'لا حركات على الحساب الثاني');
  const blocked = BL.archiveAccount(1);
  eq(blocked.success, false, 'لا يُؤرشف حساب برصيد غير صفري');
  eq(blocked.reason, 'nonzero_balance', 'سبب الرفض');
  const acc1 = factory.get('accounts').find(a => a.id == 1);
  eq(!!acc1.archived, false, 'الحساب غير المؤرشف بقي نشطًا');
  const acc2 = factory.get('accounts').find(a => a.id == 2);
  eq(acc2.archived, true, 'الحساب المؤرشف محفوظ في البيانات');
  eq(typeof acc2.archivedAt, 'string', 'تاريخ الأرشفة مسجّل');
  eq(BL.activeAccounts().length, 1, 'القوائم النشطة تستثني المؤرشف');
  eq(BL.archivedAccounts().length, 1, 'قسم الأرشيف يعرضه');
  eq(BL.defaultAccountId(), 1, 'الحساب الافتراضي لا يكون مؤرشفًا');
  const restored = BL.restoreAccount(2);
  eq(restored.success, true, 'الاستعادة تنجح');
  eq(factory.get('accounts').find(a => a.id == 2).archived, false, 'عاد نشطًا');
  return 'أرشفة/استعادة سليمة مع منع الرصيد غير الصفري';
});

test('حسابات: الأرشيف مع حركة محفوظة + قواعد الحذف النهائي', () => {
  factory.seed(BASE());
  factory.set('transactions', [
    { id: 't1', type: 'sell_cash', amount: 100, accountId: 1, date: '2026-01-01T10:00:00.000Z' },
    { id: 't2', type: 'expense', amount: 100, accountId: 1, date: '2026-01-02T10:00:00.000Z' }
  ]);
  eq(BL.accountActivity(1), 2, 'عدد الحركات المرتبطة');
  eq(BL.archiveAccount(1).success, true, 'يُؤرشف رغم وجود حركات لأن رصيده صفر');
  eq(BL.canPurgeAccount(1).success, false, 'الحذف النهائي ممنوع لوجود حركات');
  eq(BL.canPurgeAccount(1).reason, 'has_activity', 'سبب منع الحذف');
  eq(BL.archiveAccount(1).success, false, 'لا يُؤرشف مرتين');
  eq(BL.canPurgeAccount(2).success, false, 'الحساب النشط لا يُحذف نهائيًا');
  BL.restoreAccount(1);
  return 'التاريخ محفوظ بعد الأرشفة';
});

test('حسابات: إعادة استخدام اسم حساب مؤرشف مسموحة مع منع تكرار النشط', () => {
  factory.seed(BASE());
  factory.set('accounts', [
    { id: 1, name: 'بنك مصر', type: 'bank', balance: 0, archived: true, code: 'ACC-001' },
    { id: 2, name: 'الخزينة', type: 'cash', balance: 0, archived: false, code: 'ACC-002' }
  ]);
  const reuse = BL.validateAccount({ id: null, name: 'بنك مصر', type: 'bank', balance: 0 });
  eq(reuse.success, true, 'اسم حساب مؤرشف يمكن استخدامه من جديد');
  const dup = BL.validateAccount({ id: null, name: 'الخزينة', type: 'cash', balance: 0 });
  eq(dup.success, false, 'اسم حساب نشط لا يتكرر');
  eq(dup.reason, 'duplicate_name', 'سبب الرفض');
  return 'الأرشيف لا يحجز الأسماء';
});

// ═══════════ 9) المرحلة الثالثة: شجرة الحسابات وميزان المراجعة ═══════════
test('شجرة: 5 مجموعات رئيسية و3 مستويات وبنية متوازنة عند البيانات الفارغة', () => {
  factory.seed({ products: [], merchants: [], accounts: [], openingCapital: 0 });
  const tb = BL.buildTrialBalance();
  const roots = tb.tree.filter(n => n.level === 1);
  eq(roots.length, 5, 'عدد المجموعات الرئيسية');
  eq(roots.map(n => n.code).join(','), '1,2,3,4,5', 'ترتيب المجموعات');
  eq(tb.totals.debit, 0, 'لا مدين بلا بيانات');
  eq(tb.totals.credit, 0, 'لا دائن بلا بيانات');
  eq(tb.totals.balanced, true, 'الميزان متوازن');
  eq(tb.leaves.length, 0, 'لا أوراق بلا بيانات');
  return '5 جذور + ميزان صفري متوازن';
});

test('شجرة: رأس مال الإعدادات يظهر كأصل نقدي مقابل حقوق ملكية (بلا ازدواج)', () => {
  factory.seed({ products: [], merchants: [], accounts: [], openingCapital: 10000 });
  const tb = BL.buildTrialBalance();
  eq(tb.totals.debit, 10000, 'إجمالي المدين');
  eq(tb.totals.credit, 10000, 'إجمالي الدائن');
  eq(tb.totals.balanced, true, 'الميزان متوازن');
  eq(tb.summary.assets, 10000, 'الأصول');
  eq(tb.summary.capital, 10000, 'حقوق الملكية');
  ok(tb.leaves.some(l => l.code === 'CAP-CASH' && Math.abs(l.debit - 10000) < 0.01), 'سطر رأس المال النقدي');
  ok(tb.leaves.some(l => l.code === '311-CAP' && Math.abs(l.credit - 10000) < 0.01), 'سطر حقوق الملكية');
  return 'مدين = دائن = 10000';
});

test('شجرة: أرصدة افتتاح الحسابات لا تُحتسب مرتين', () => {
  factory.seed({
    products: [], merchants: [],
    accounts: [{ id: 1, name: 'الخزينة', type: 'cash', balance: 10000, code: 'ACC-001' }],
    openingCapital: 0
  });
  const tb = BL.buildTrialBalance();
  eq(tb.totals.debit, 10000, 'المدين يساوي رصيد الافتتاح مرة واحدة');
  eq(tb.totals.credit, 10000, 'الدائن يساوي رصيد الافتتاح مرة واحدة');
  eq(tb.totals.balanced, true, 'لا ازدواج في رأس المال');
  eq(tb.summary.capital, 10000, 'حقوق الملكية = أرصدة الافتتاح');
  const cashLeaf = tb.leaves.filter(l => l.parent === '111').reduce((s, l) => s + l.debit, 0);
  eq(cashLeaf, 10000, 'النقدية مرة واحدة فقط');
  return 'رصيد الافتتاح محسوب مرة واحدة';
});

test('شجرة: شراء وبيع نقدي متوازنان ويظهران في ميزان المراجعة', () => {
  factory.seed({
    products: [], merchants: [],
    accounts: [{ id: 1, name: 'الخزينة', type: 'cash', balance: 0, code: 'ACC-001' }],
    openingCapital: 1000
  });
  factory.set('transactions', [
    { id: 'p1', type: 'purchase', amount: 400, accountId: 1, productId: 1, unitCost: 400, sourceType: 'purchase', sourceId: 'p1', date: '2026-01-01T09:00:00.000Z' },
    { id: 's1', type: 'sell_cash', amount: 1000, accountId: 1, productId: 1, unitCost: 400, sourceType: 'sale', sourceId: 's1', date: '2026-01-02T09:00:00.000Z' }
  ]);
  const tb = BL.buildTrialBalance();
  eq(tb.totals.balanced, true, 'الميزان متوازن');
  eq(tb.income.revenue, 1000, 'الإيرادات');
  eq(tb.income.cogs, 400, 'تكلفة البضاعة المباعة');
  eq(tb.income.netProfit, 600, 'صافي الربح');
  eq(tb.summary.assets, 1600, 'الأصول = رأس المال + الربح');
  ok(tb.leaves.some(l => l.code === '511-COGS' && Math.abs(l.debit - 400) < 0.01), 'تكلفة المبيعات في الميزان');
  ok(tb.leaves.some(l => l.code === '411-SAL' && Math.abs(l.credit - 1000) < 0.01), 'إيراد المبيعات في الميزان');
  ok(!tb.leaves.some(l => l.code === '321'), 'سطر نتيجة الأعمال خارج الميزان لمنع الازدواج');
  ok(tb.tree.some(n => n.code === '321'), 'سطر نتيجة الأعمال يظهر في الشجرة فقط');
  return 'مدين = دائن مع ربح 600';
});

test('شجرة: الفرق غير المفسر يظهر صراحةً كسطر 322', () => {
  factory.seed({ products: [], merchants: [], accounts: [], openingCapital: 0 });
  factory.set('transactions', [
    // بيع بلا شراء مقابله ولا مخزون افتتاحي ⇒ تكلفة بلا أصل مقابل
    { id: 's1', type: 'sell_cash', amount: 1000, accountId: null, productId: 1, unitCost: 400, sourceType: 'sale', sourceId: 's1', date: '2026-01-02T09:00:00.000Z' }
  ]);
  const tb = BL.buildTrialBalance();
  eq(tb.totals.balanced, false, 'الميزان غير متوازن');
  eq(tb.totals.difference, 400, 'الفرق = تكلفة بلا مقابل');
  ok(tb.tree.some(n => n.code === '322' && Math.abs(n.credit - 400) < 0.01), 'سطر 322 يظهر الفرق');
  ok(Math.abs(tb.summary.difference - 400) < 0.01, 'ملخص الفرق');
  return 'الفرق ظاهر 400 ولم يُخفَ';
});

test('شجرة: فرق غير مفسر عند سيولة بلا حساب + توازن مع حساب غير مسند', () => {
  factory.seed({ products: [], merchants: [], accounts: [], openingCapital: 0 });
  factory.set('transactions', [
    { id: 'i1', type: 'income', amount: 500, accountId: null, date: '2026-01-03T09:00:00.000Z' }
  ]);
  const tb = BL.buildTrialBalance();
  ok(tb.leaves.some(l => l.code === '111-UNALLOC' && Math.abs(l.debit - 500) < 0.01), 'سيولة غير مسندة تظهر كسطر');
  eq(tb.totals.balanced, true, 'الإيراد اليدوي يقابل السيولة غير المسندة');
  eq(tb.income.otherIncome, 500, 'إيرادات أخرى');
  eq(tb.income.revenue, 500, 'الإيراد الكلي');
  ok(tb.leaves.some(l => l.code === '412-OTH' && Math.abs(l.credit - 500) < 0.01), 'سطر الإيرادات الأخرى');
  return '111-UNALLOC = 500 ويقابل 412-OTH';
});

test('شجرة: الأكواد فريدة والترتيب تصاعدي وحساب مؤرشف برصيد يظهر', () => {
  factory.seed({
    products: [], merchants: [],
    accounts: [
      { id: 1, name: 'خزينة', type: 'cash', balance: 0, code: 'ACC-001', archived: true, archivedAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: 'بنك', type: 'bank', balance: 0, code: 'ACC-002', archived: false }
    ],
    openingCapital: 0
  });
  factory.set('transactions', [
    { id: 't1', type: 'sell_cash', amount: 250, accountId: 1, date: '2026-01-01T10:00:00.000Z' }
  ]);
  const tb = BL.buildTrialBalance();
  const codes = tb.leaves.map(l => l.code);
  eq(new Set(codes).size, codes.length, 'لا تكرار في أكواد الميزان');
  const sorted = codes.slice().sort((a, b) => a.localeCompare(b));
  eq(codes.join('|'), sorted.join('|'), 'ترتيب تصاعدي بالأكواد');
  ok(codes.includes('ACC-001'), 'الحساب المؤرشف برصيد يظهر في الميزان');
  ok(tb.tree.some(n => n.code === '111'), 'مجموعة النقدية موجودة');
  return 'أكواد فريدة مرتبة + الأرشيف برصيد يظهر';
});

// ═══════════ فرق تقييم شراء التاجر (الخيار ب) ═══════════
function seedMerchantBaseline() {
  factory.seed({
    products: [{ id: 1, name: 'iPhone 13', costPrice: 1000, expenses: 0, sellPrice: 1500, stock: 0, archived: false }],
    merchants: [{ id: 1, name: 'تاجر ب' }],
    accounts: [{ id: 1, name: 'الخزينة', type: 'cash', balance: 0 }],
    openingCapital: 0
  });
  const buy = BL.purchaseStock({ productId: 1, qty: 3, accountId: 1, date: '2026-01-02T09:00:00.000Z' });
  ok(buy.success, 'شراء أساسي: ' + buy.reason);
}

test('شجرة: فرق شراء التاجر يظهر كسطر 323 بدل «غير مفسر»', () => {
  seedMerchantBaseline();
  const mp = BL.purchaseFromMerchant({ merchantId: 1, productId: 1, qty: 2, costPrice: 900, date: '2026-01-03T09:00:00.000Z' });
  ok(mp.success, 'شراء التاجر: ' + mp.reason);
  const tb = BL.buildTrialBalance();
  eq(BL.merchantPurchaseValuationDiff(), 200, 'فرق التقييم');
  eq(tb.totals.difference, 200, 'الفرق الخام');
  eq(tb.totals.explained, 200, 'الفرق المفسَّر');
  eq(tb.totals.unexplained, 0, 'غير المفسر');
  ok(tb.totals.explainedFully, 'الفرق مفسَّر بالكامل');
  ok(tb.tree.some(n => n.code === '323' && Math.abs(n.debit - 200) < 0.01), 'سطر 323 مدين 200');
  ok(!tb.tree.some(n => n.code === '322'), 'لا سطر 322');
  eq(D().products[0].costPrice, 1000, 'تكلفة الصنف لم تتغير');
  return '323 = 200 وتكلفة الصنف 1000 كما هي';
});

test('شجرة: شراء التاجر بلا فرق سعر لا يُنشئ سطر 323 والميزان متوازن', () => {
  seedMerchantBaseline();
  const mp = BL.purchaseFromMerchant({ merchantId: 1, productId: 1, qty: 2, costPrice: 1000, date: '2026-01-03T09:00:00.000Z' });
  ok(mp.success, 'شراء التاجر: ' + mp.reason);
  const tb = BL.buildTrialBalance();
  eq(BL.merchantPurchaseValuationDiff(), 0, 'لا فرق تقييم');
  eq(tb.totals.difference, 0, 'الميزان متوازن');
  ok(tb.totals.balanced, 'متوازن');
  ok(!tb.tree.some(n => n.code === '323'), 'لا سطر 323 بلا فرق');
  return 'متوازن بلا سطر مسمّى';
});

test('شجرة: بيع وحدة لا يزيل فرق شراء التاجر (يبقى مفسَّرًا)', () => {
  seedMerchantBaseline();
  BL.purchaseFromMerchant({ merchantId: 1, productId: 1, qty: 2, costPrice: 900, date: '2026-01-03T09:00:00.000Z' });
  const sell = BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-04T09:00:00.000Z' });
  ok(sell.success, 'بيع نقدي: ' + sell.reason);
  const tb = BL.buildTrialBalance();
  eq(BL.merchantPurchaseValuationDiff(), 200, 'الفرق بعد البيع');
  eq(tb.totals.explained, 200, 'المفسَّر بعد البيع');
  eq(tb.totals.unexplained, 0, 'لا غير مفسر بعد البيع');
  return '200 باقٍ ومفسَّر';
});

test('شجرة: الفرق المفسَّر لا يخفي فرقًا حقيقيًا معه', () => {
  seedMerchantBaseline();
  BL.purchaseFromMerchant({ merchantId: 1, productId: 1, qty: 2, costPrice: 900, date: '2026-01-03T09:00:00.000Z' });
  factory.set('transactions', D().transactions.concat([{
    id: 's1', type: 'sell_cash', amount: 1000, accountId: null, productId: 1, unitCost: 400,
    sourceType: 'sale', sourceId: 's1', date: '2026-01-04T09:00:00.000Z'
  }]));
  const tb = BL.buildTrialBalance();
  eq(tb.totals.explained, 200, 'المفسَّر');
  eq(tb.totals.unexplained, 400, 'غير المفسر الحقيقي');
  ok(tb.tree.some(n => n.code === '323' && Math.abs(n.debit - 200) < 0.01), 'سطر 323');
  ok(tb.tree.some(n => n.code === '322' && Math.abs(n.credit - 400) < 0.01), 'سطر 322 للفرق الحقيقي');
  return '323 = 200 و322 = 400';
});

test('شجرة: صنف له مصروفات — الفرق يشمل المصروفات', () => {
  factory.seed({
    products: [{ id: 1, name: 'iPhone 13', costPrice: 1000, expenses: 500, sellPrice: 1800, stock: 0, archived: false }],
    merchants: [{ id: 1, name: 'تاجر ب' }],
    accounts: [{ id: 1, name: 'الخزينة', type: 'cash', balance: 0 }],
    openingCapital: 0
  });
  ok(BL.purchaseStock({ productId: 1, qty: 1, accountId: 1, date: '2026-01-02T09:00:00.000Z' }).success, 'شراء أساسي');
  ok(BL.purchaseFromMerchant({ merchantId: 1, productId: 1, qty: 2, costPrice: 900, date: '2026-01-03T09:00:00.000Z' }).success, 'شراء التاجر');
  const tb = BL.buildTrialBalance();
  eq(BL.merchantPurchaseValuationDiff(), 1200, 'الفرق (2 × 600)');
  eq(tb.totals.unexplained, 0, 'لا غير مفسر');
  ok(tb.tree.some(n => n.code === '323' && Math.abs(n.debit - 1200) < 0.01), 'سطر 323 = 1200');
  return 'المصروفات محسوبة في الفرق';
});

// ═══════════ كشوف الحساب: الدفعات الجزئية والمقدمة ═══════════
function contractForStatement(over) {
  const r = BL.createInstallment(Object.assign({
    merchantId: 1, productId: 1, deviceName: 'iPhone 13', purchasePrice: 2000, paidUpfront: 0,
    interestRate: 0, numInstallments: 4, firstDueDate: '2026-11-01', accountId: 1,
    date: '2026-11-01T09:00:00.000Z'
  }, over || {}));
  ok(r.success, 'فشل إنشاء العقد: ' + r.reason);
  return r.installmentId;
}
const slotRows = () => buildComprehensiveRows(1).filter(r => String(r.desc || '').startsWith('قسط'));
const cashIn = () => D().transactions.filter(t => t.type === 'payment_in').reduce((s, t) => s + t.amount, 0);

test('كشف: دفعة الشهر + دفعة الشهر المقدم تظهران معاً', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 1, amount: 500, accountId: 1, date: '2026-11-11T09:00:00.000Z' });
  const rows = slotRows();
  eq(rows.length, 2, 'عدد صفوف الدفعات في الكشف');
  ok(/قسط رقم 1/.test(rows[0].desc), 'صف الشهر الحالي: ' + rows[0].desc);
  ok(/قسط رقم 2/.test(rows[1].desc), 'صف الشهر المقدم: ' + rows[1].desc);
  eq(rows.reduce((s, r) => s + r.credit, 0), 1000, 'مجموع المثبت في الكشف');
  eq(cashIn(), 1000, 'النقد المحصّل');
  return 'الشهر والمقدم كلاهما 500';
});

test('كشف: دفعة الشهر المقدم الجزئية تُثبت بمبلغها الفعلي', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 1, amount: 300, accountId: 1, date: '2026-11-11T09:00:00.000Z' });
  const inst = D().installments.find(i => i.id == id);
  eq(inst.schedule[1].paidAmount, 300, 'المبلغ المحصل على القسط المقدم');
  ok(!inst.schedule[1].isPaid, 'القسط المقدم لم يكتمل');
  const rows = slotRows();
  eq(rows.length, 2, 'صفّا الدفعتين يظهران');
  ok(/\(جزئي\)/.test(rows[1].desc), 'وسم الدفعة الجزئية: ' + rows[1].desc);
  eq(rows[1].credit, 300, 'مبلغ الدفعة المقدمة');
  eq(rows.reduce((s, r) => s + r.credit, 0), cashIn(), 'الكشف يطابق النقد المحصّل');
  return 'المقدم الجزئي 300 ظاهر وموقّع (جزئي)';
});

test('كشف: دفعة جزئية على الشهر الأول لا تختفي', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 200, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 300, accountId: 1, date: '2026-11-12T09:00:00.000Z' });
  const rows = slotRows();
  eq(rows.length, 1, 'صف واحد للقسط المكتمل');
  ok(/\(جزئي\)/.test(rows[0].desc) === false, 'اكتمل القسط فلا وسم جزئي');
  eq(rows[0].credit, 500, 'مجموع دفعتَي القسط');
  eq(rows[0].credit, cashIn(), 'لا فرق بين الكشف والتحصيل');
  return '200 + 300 = 500 مثبتة';
});

test('كشف عام: الدفعة المقدمة الجزئية تظهر في الكشف العام أيضاً', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 1, amount: 300, accountId: 1, date: '2026-11-11T09:00:00.000Z' });
  const rows = buildGeneralStatementRows().filter(r => /^قسط رقم/.test(String(r.desc || '')));
  eq(rows.length, 2, 'عدد صفوف الأقساط في الكشف العام');
  eq(rows.reduce((s, r) => s + r.credit, 0), 800, 'مجموع الأقساط في الكشف العام');
  ok(rows.some(r => /\(جزئي\)/.test(r.desc)), 'الدفعة الجزئية موسومة');
  return 'الكشف العام يطابق النقد 800';
});

// ─────────── تعديل/حذف دفعة سداد محددة ───────────
test('دفعات: تعديل مبلغ دفعة يحدّث الجدول والمتبقي والنقد والكشف', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  const r = BL.updateInstallmentPayment(id, g.sourceId, { amount: 700, date: '2026-11-11T09:00:00.000Z', accountId: 1 });
  ok(r.success, 'تعديل الدفعة: ' + r.reason);
  const inst = D().installments.find(i => i.id == id);
  eq(inst.schedule[0].paidAmount, 500, 'القسط الأول اكتمل');
  eq(inst.schedule[1].paidAmount, 200, 'الزائد على القسط الثاني');
  eq(inst.remainingBalance, 1300, 'المتبقي بعد التعديل');
  eq(cashIn(), 700, 'النقد بعد التعديل');
  eq(slotRows().reduce((s, x) => s + x.credit, 0), 700, 'الكشف يطابق النقد');
  eq(BL.accountBalance(1), 700, 'رصيد الخزينة بعد التعديل');
  return '500 → 700 والمتبقي 1300 والكشف 700';
});

test('دفعات: تخفيض دفعة إلى مبلغ جزئي يظهر بوسم (جزئي) ويزيد المتبقي', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  const r = BL.updateInstallmentPayment(id, g.sourceId, { amount: 200, date: '2026-11-10T09:00:00.000Z', accountId: 1 });
  ok(r.success, 'تعديل الدفعة: ' + r.reason);
  const inst = D().installments.find(i => i.id == id);
  eq(inst.schedule[0].paidAmount, 200, 'القسط الأول جزئي');
  ok(!inst.schedule[0].isPaid, 'القسط الأول لم يكتمل');
  eq(inst.remainingBalance, 1800, 'المتبقي بعد التخفيض');
  const rows = slotRows();
  eq(rows.length, 1, 'صف واحد');
  ok(/\(جزئي\)/.test(rows[0].desc), 'وسم الدفعة الجزئية: ' + rows[0].desc);
  eq(rows[0].credit, 200, 'مبلغ الدفعة الجزئية');
  eq(cashIn(), 200, 'النقد بعد التخفيض');
  return '500 → 200 جزئي والمتبقي 1800';
});

test('دفعات: حذف دفعة محددة يعيد الجدول والمتبقي والنقد', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 1, amount: 300, accountId: 1, date: '2026-11-11T09:00:00.000Z' });
  const first = BL.paymentGroups(id)[0];
  const r = BL.deleteInstallmentPayment(id, first.sourceId);
  ok(r.success, 'حذف الدفعة: ' + r.reason);
  const inst = D().installments.find(i => i.id == id);
  eq(inst.remainingBalance, 1700, 'المتبقي بعد حذف 500');
  eq(cashIn(), 300, 'النقد المتبقي');
  eq(inst.schedule[1].paidAmount, 300, 'الدفعة الباقية ما زالت مرتبطة بالقسط الثاني المحدد لها');
  eq(inst.schedule[0].paidAmount, 0, 'القسط الأول عاد غير مسدد');
  eq(BL.paymentGroups(id).length, 1, 'بقيت دفعة واحدة');
  eq(slotRows().reduce((s, x) => s + x.credit, 0), 300, 'الكشف مطابق');
  return 'حُذفت دفعة وبقي 300 على القسط الثاني والمتبقي 1700';
});

test('دفعات: تعديل دفعة أكبر من المتبقي مرفوض ولا يغيّر البيانات', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  const r = BL.updateInstallmentPayment(id, g.sourceId, { amount: 2500, accountId: 1 });
  ok(!r.success, 'يجب رفض المبلغ الزائد');
  eq(r.reason, 'overpayment', 'سبب الرفض');
  eq(r.max, 2000, 'الحد الأقصى المسموح = إجمالي العقد بعد استبعاد الدفعة نفسها');
  eq(cashIn(), 500, 'النقد لم يتغير');
  eq(D().installments.find(i => i.id == id).remainingBalance, 1500, 'المتبقي لم يتغير');
  return 'رُفض 2500 والحد 2000';
});

test('دفعات: تعديل دفعة مقسمة كاش/بنك يحافظ على التقسيم والأرصدة', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, bankAmount: 500, bankAccountId: 2, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  const r = BL.updateInstallmentPayment(id, g.sourceId, {
    amount: 800, date: '2026-11-12T09:00:00.000Z',
    cashAmount: 300, bankAmount: 500, cashAccountId: 1, bankAccountId: 2
  });
  ok(r.success, 'تعديل الدفعة المقسمة: ' + r.reason);
  const inst = D().installments.find(i => i.id == id);
  eq(inst.schedule[0].paidAmount, 500, 'القسط الأول');
  eq(inst.schedule[1].paidAmount, 300, 'القسط الثاني');
  eq(inst.remainingBalance, 1200, 'المتبقي');
  eq(BL.accountBalance(1), 300, 'رصيد الخزينة');
  eq(BL.accountBalance(2), 500, 'رصيد البنك');
  eq(BL.paymentGroups(id).length, 1, 'مجموعة دفعة واحدة');
  return 'كاش 300 + بنك 500 = 800';
});

test('صلاحيات: تعديل/حذف دفعة مرفوض لغير المدير دون تغيير البيانات', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  factory.setAdmin(false);
  const e1 = BL.updateInstallmentPayment(id, g.sourceId, { amount: 600, accountId: 1 });
  const e2 = BL.deleteInstallmentPayment(id, g.sourceId);
  factory.setAdmin(true);
  eq(e1.reason, 'not_admin', 'تعديل مرفوض');
  eq(e2.reason, 'not_admin', 'حذف مرفوض');
  eq(cashIn(), 500, 'النقد لم يتغير');
  eq(D().installments.find(i => i.id == id).remainingBalance, 1500, 'المتبقي لم يتغير');
  return 'الموظف ممنوع من التعديل والحذف';
});

// ─────────── سبب الحذف والتراجع ومركز الإصلاح ───────────
test('حذف: سبب الحذف يُسجَّل في سجل التدقيق مع مرجع الدفعة', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  const r = BL.deleteInstallmentPayment(id, g.sourceId, 'خطأ في إدخال المبلغ');
  ok(r.success, 'حذف الدفعة: ' + r.reason);
  const logs = factory.get('auditLog');
  const rec = logs[logs.length - 1];
  ok(rec && rec.action === 'delete', 'سجل حذف موجود');
  eq(String(rec.ref), String(id), 'مرجع السجل هو العقد');
  ok(String(rec.detail).includes('خطأ في إدخال المبلغ'), 'السبب مذكور في السجل: ' + rec.detail);
  return 'السبب مثبت في سجل التدقيق';
});

test('حذف: بدون سبب لا يُضاف نص سبب وهمي إلى السجل', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const g = BL.paymentGroups(id)[0];
  BL.deleteInstallmentPayment(id, g.sourceId);
  const logs = factory.get('auditLog');
  const rec = logs[logs.length - 1];
  ok(!String(rec.detail).includes('السبب:'), 'لا يظهر حقل سبب فارغ');
  return 'لا سبب = لا نص سبب';
});

test('تراجع: لقطة كاملة تستعيد الحركات والجدول بعد حذف دفعة', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  factory.tick('قبل الحذف');
  const before = factory.dump();
  const g = BL.paymentGroups(id)[0];
  BL.deleteInstallmentPayment(id, g.sourceId, 'اختبار التراجع');
  eq(factory.dump().transactions.length, 0, 'الحركة حُذفت فعلًا');
  factory.tick('بعد الحذف');
  eq(factory.undoCount(), 1, 'نقطة تراجع واحدة');
  const step = factory.undoTop();
  ok(step && step.snap, 'اللقطة محفوظة');
  ok(factory.restoreAllSnap(step.snap), 'الاسترجاع نجح');
  const after = factory.dump();
  eq(after.transactions.length, before.transactions.length, 'الحركات رجعت');
  eq(after.installments[0].remainingBalance, before.installments[0].remainingBalance, 'المتبقي رجع');
  eq(after.installments[0].schedule[0].paidAmount, 500, 'القسط المسدد رجع');
  eq(cashIn(), 500, 'النقد رجع');
  return 'استرجاع كامل بعد حذف دفعة';
});

test('تراجع: كل حفظ يُنشئ نقطة تراجع مستقلة (بدون دمج) so each action is independently reversible', () => {
  factory.seed(BASE());
  factory.resetUndo();
  factory.tick('الخطوة أ');
  factory.get('products')[0].stock = 1;
  factory.tick('الخطوة ب');
  factory.get('products')[0].stock = 2;
  factory.tick('الخطوة ج');
  eq(factory.undoCount(), 2, '2 نقاط تراجع (الأولى تُنشئ خط الأساس)');
  factory.restoreAllSnap(factory.undoTop().snap);
  eq(factory.get('products')[0].stock, 1, 'آخر نقطة تراجع تعيد 1 (حالة قبل آخر حفظ)');
  return 'كل حفظ = نقطة تراجع';
});

test('تراجع: اللقطة لا تتأثر بتعديل لاحق على نفس الكائن (نسخ عميق)', () => {
  factory.seed(BASE());
  const snap = factory.snapshotAll();
  factory.get('products')[0].stock = 77;
  factory.get('installments').push({ id: 99, schedule: [{ index: 1, paidAmount: 5 }] });
  factory.restoreAllSnap(snap);
  eq(factory.get('products')[0].stock, 10, 'المخزون كما كان');
  eq(factory.get('installments').length, 0, 'العقد المؤقت اختفى');
  return 'نسخ عميق يمنع تسرّب التعديلات';
});

test('إصلاح: إعادة بناء جدول عقد بمتبقٍّ خاطئ من الدفعات الفعلية', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const inst = factory.get('installments')[0];
  inst.remainingBalance = 9999;
  const plan = factory.repairPlan({ checkId: 'INST_BALANCE_MISMATCH', recordId: String(inst.id) });
  ok(plan, 'خطة إصلاح آمنة موجودة');
  ok(plan.previewHtml.includes('قبل') && plan.previewHtml.includes('بعد'), 'المعاينة تعرض قبل/بعد');
  plan.apply();
  eq(factory.get('installments')[0].remainingBalance, 1500, 'المتبقي صُحّح من الحركات');
  return 'أُعيد البناء: 9999 ← 1500';
});

test('إصلاح: تصحيح رصيد المخزون من حركات المخزون', () => {
  factory.seed(Object.assign(BASE(), {
    stockMovements: [
      { id: 1, productId: 3, type: 'in', qty: 12 },
      { id: 2, productId: 3, type: 'out', qty: 2 }
    ]
  }));
  const p = factory.get('products').find(x => x.id == 3);
  p.stock = 5;
  const plan = factory.repairPlan({ checkId: 'INV_STOCK_MISMATCH', recordId: '3' });
  ok(plan, 'خطة إصلاح المخزون موجودة');
  plan.apply();
  eq(factory.get('products').find(x => x.id == 3).stock, 10, 'المخزون صار 12 − 2');
  return 'رصيد المخزون = صافي الحركات';
});

test('إصلاح: إعادة حساب رصيد الشريك من حركاته فقط', () => {
  factory.seed(BASE());
  factory.get('partners').push({ id: 7, name: 'شريك أ', balance: 500 });
  factory.get('transactions').push({ id: 11, type: 'partner_deposit', amount: 200, partnerId: 7, accountId: 1, date: '2026-01-01' });
  const plan = factory.repairPlan({ checkId: 'PART_BALANCE_RECON', recordId: '7' });
  ok(plan, 'خطة إصلاح الشريك موجودة');
  plan.apply();
  eq(factory.get('partners')[0].balance, 200, 'الرصيد = الإيداعات − السحوبات');
  return 'رصيد الشريك 500 ← 200';
});

test('إصلاح: إعادة حساب متبقي العربون غير المحوّل', () => {
  factory.seed(Object.assign(BASE(), {
    arabonSales: [{ id: 3, sellPrice: 1000, depositAmount: 200, remainingAmount: 999, isPaid: false }]
  }));
  const plan = factory.repairPlan({ checkId: 'ARB_REMAINING_MISMATCH', recordId: '3' });
  ok(plan, 'خطة إصلاح العربون موجودة');
  plan.apply();
  eq(factory.get('arabonSales')[0].remainingAmount, 800, 'المتبقي = 1000 − 200');
  ok(!factory.get('arabonSales')[0].isPaid, 'العربون ما زال مفتوحًا');
  return 'متبقي العربون 999 ← 800';
});

test('إصلاح: إسناد كود فريد لحساب بلا كود', () => {
  factory.seed(BASE());
  factory.get('accounts').push({ id: 9, name: 'حساب جديد', type: 'cash' });
  const plan = factory.repairPlan({ checkId: 'ACC_MISSING_CODE', recordId: '9' });
  ok(plan, 'خطة الكود موجودة');
  plan.apply();
  ok(/^ACC-\d{3,}$/.test(factory.get('accounts')[2].code), 'كود بصيغة ACC-NNN: ' + factory.get('accounts')[2].code);
  return 'أُسند كود فريد للحساب';
});

test('إصلاح: المشكلات غير الآمنة لا تُعرض كإصلاح تلقائي', () => {
  factory.seed(BASE());
  eq(factory.repairPlan({ checkId: 'DUP_TX_SOURCE', recordId: '1' }), null, 'التكرار يحتاج تدخلًا بشريًا');
  eq(factory.repairPlan({ checkId: 'INV_ORPHAN_MOVEMENT', recordId: '1' }), null, 'حركة يتيمة تحتاج مراجعة');
  return 'لا إصلاح تلقائي لغير الآمن';
});

test('ربط الواجهة: زر التراجع وتبويب الإصلاح والتفصيل وحذف بالسبب موصولة', () => {
  ok(html.includes('id="undoBtn"'), 'زر التراجع في الترويسة');
  ok(html.includes("tabRepair") && html.includes("openReportDetail"), 'تبويب مركز الإصلاح وقائمة التقارير المفتوحة');
  ok(html.includes('window.renderRepairCenter'), 'دالة عرض المركز');
  ok(html.includes('window.coaDrillDown'), 'دالة تفصيل بند الميزان');
  ok(html.includes('window.confirmDelete') && html.includes('window.askDeleteReason'), 'الحذف يطلب سببًا');
  ok(/employee-mode[^}]*#undoBtn/.test(html) || html.includes('#undoBtn { display: none !important; }'), 'التراجع مخفي عن الموظف');
  return 'كل نقاط الواجهة موصولة';
});

test('واجهة: فتح لوحة تحصيل القسط يمرّرها للعرض داخل الشاشة', () => {
  const start = html.indexOf('window.openSlotPay');
  const end = html.indexOf('window.instSplitToggle', start);
  const block = html.slice(start, end);
  ok(start >= 0 && end > start, 'دالة openSlotPay موجودة');
  ok(block.includes("scrollIntoView({ behavior: 'smooth', block: 'center' })"), 'تمرير لوحة السداد للعرض (أزرار الأقساط البعيدة تعمل)');
  ok(block.includes('if (!panel) { showToast('), 'حماية عند غياب لوحة السداد');
  return 'اللوحة تُمرَّر للعرض';
});

// ───────────不 invariant: خصائص ثابتة للنظام ───────────
test('不 invariant: سداد كامل يغلق العقد (remaining=0, isPaid=true)', () => {
  factory.seed(BASE());
  const id = contractForStatement();
  BL.recordSlotPayment({ installmentId: id, slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 1, amount: 500, accountId: 1, date: '2026-11-11T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 2, amount: 500, accountId: 1, date: '2026-11-12T09:00:00.000Z' });
  BL.recordSlotPayment({ installmentId: id, slotIdx: 3, amount: 500, accountId: 1, date: '2026-11-13T09:00:00.000Z' });
  const inst = D().installments.find(i => i.id == id);
  eq(inst.remainingBalance, 0, 'المتبقي صفر');
  ok(inst.isPaid, 'العقد مغلق');
  return 'سداد 4×500 = 2000 → مغلق';
});

test('不 invariant: buildTrialBalance يُرجع فرقًا رقميًا (totals.difference)', () => {
  factory.seed(BASE());
  const tb = BL.buildTrialBalance();
  ok(tb && tb.totals, 'totals موجود');
  ok(typeof tb.totals.difference === 'number', 'difference رقم');
  ok(Array.isArray(tb.leaves) && tb.leaves.length > 0, 'leaves موجودة');
  return 'difference = ' + tb.totals.difference.toFixed(2);
});

test('不 invariant: رصيد account = صافي حركاته (payment_in − payment_out)', () => {
  factory.seed(BASE());
  BL.recordSlotPayment({ installmentId: contractForStatement(), slotIdx: 0, amount: 500, accountId: 1, date: '2026-11-10T09:00:00.000Z' });
  const acc = D().accounts.find(a => a.id == 1);
  const calc = D().transactions.filter(t => t.accountId == 1).reduce((s, t) => {
    if (t.type === 'payment_in') return s + t.amount;
    if (t.type === 'payment_out') return s - t.amount;
    return s;
  }, 0);
  eq(BL.accountBalance(1), calc, 'رصيد الخزينة = صافي حركاتها');
  return 'رصيد = ' + calc;
});

test('不 invariant: stockMatchesMovements (مخزون = أولي + in − out)', () => {
  factory.seed(BASE());
  const p = D().products.find(x => x.id == 3);
  const initial = p.stock;
  factory.get('stockMovements').push({ id: 1, productId: 3, type: 'in', qty: 7 });
  factory.get('stockMovements').push({ id: 2, productId: 3, type: 'out', qty: 2 });
  p.stock = initial + 7 - 2;
  ok(stockMatchesMovements(3, initial), 'المخزون يطابق الحركات');
  return 'initial + in − out = stock';
});

// ─────────── الأرشفة الفورية عند وصول الرصيد لصفر ───────────
test('مخزون: بيع آخر قطعة نقدًا يؤرشف الصنف فورًا', () => {
  const base = BASE(); base.products[2].stock = 1; factory.seed(base);
  const r = BL.sellCash({ productId: 3, qty: 1, accountId: 1, date: '2026-01-02T10:00:00.000Z' });
  ok(r.success, 'فشل البيع: ' + r.reason);
  const p = D().products.find(x => x.id == 3);
  eq(p.stock, 0, 'المخزون صفر');
  ok(p.archived === true, 'الصنف لم يُؤرشف فورًا');
  return 'أرشفة فورية عند الصفر';
});

test('مخزون: بيع آخر قطعة بالتقسيط يؤرشف الصنف فورًا', () => {
  const base = BASE(); base.products[2].stock = 1; factory.seed(base);
  const r = BL.createInstallment({
    merchantId: 1, productId: 3, deviceName: 'Samsung A54', purchasePrice: 8000, paidUpfront: 1000,
    interestRate: 0, numInstallments: 5, firstDueDate: '2026-01-05', accountId: 1,
    date: '2026-01-01T10:00:00.000Z'
  });
  ok(r.success, 'فشل العقد: ' + r.reason);
  const p = D().products.find(x => x.id == 3);
  eq(p.stock, 0, 'المخزون صفر');
  ok(p.archived === true, 'الصنف لم يُؤرشف فورًا');
  return 'أرشفة فورية عند الصفر (تقسيط)';
});

test('مخزون: بيع آخر قطعة بعربون يؤرشف الصنف فورًا', () => {
  const base = BASE(); base.products[2].stock = 1; factory.seed(base);
  const r = newArabon({ productId: 3, sellPrice: 8000, depositAmount: 1000, deviceName: 'Samsung A54' });
  ok(r.success, 'فشل العربون');
  const p = D().products.find(x => x.id == 3);
  eq(p.stock, 0, 'المخزون صفر');
  ok(p.archived === true, 'الصنف لم يُؤرشف فورًا');
  return 'أرشفة فورية عند الصفر (عربون)';
});

test('مخزون: بيع آخر قطعة لتاجر يؤرشف الصنف فورًا', () => {
  const base = BASE(); base.products[2].stock = 1; factory.seed(base);
  const r = BL.sellToMerchant({ merchantId: 2, productId: 3, qty: 1, actualTotal: 8000, date: '2026-01-03T10:00:00.000Z' });
  ok(r.success, 'فشل البيع للتاجر: ' + r.reason);
  const p = D().products.find(x => x.id == 3);
  eq(p.stock, 0, 'المخزون صفر');
  ok(p.archived === true, 'الصنف لم يُؤرشف فورًا');
  return 'أرشفة فورية عند الصفر (تاجر)';
});

test('مخزون: شراء صنف مؤرشف يعيد إظهاره', () => {
  const base = BASE(); base.products[2].stock = 1; factory.seed(base);
  BL.sellCash({ productId: 3, qty: 1, accountId: 1, date: '2026-01-02T10:00:00.000Z' });
  ok(D().products.find(x => x.id == 3).archived === true, 'لم يُؤرشف');
  const r = BL.purchaseStock({ productId: 3, qty: 2, accountId: 1, date: '2026-01-03T10:00:00.000Z' });
  ok(r.success, 'فشل الشراء: ' + r.reason);
  const p = D().products.find(x => x.id == 3);
  eq(p.stock, 2, 'المخزون بعد الشراء');
  ok(p.archived === false, 'الصنف لم يُعد إظهاره بعد الشراء');
  return 'شراء يرجع الصنف للنشط';
});

// ─────────── إعادة تعيين البيانات ───────────
test('إعادة تعيين: مسح كل المخازن بما فيها العربون وحركات المخزون', () => {
  factory.seed(BASE());
  newInst();
  newArabon({ productId: 3, sellPrice: 8000, depositAmount: 1000, deviceName: 'Samsung A54' });
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, date: '2026-01-03T10:00:00.000Z' });
  ok(D().arabonSales.length > 0, 'عربون قبل المسح');
  ok(factory.get('employees').length > 0, 'موظف قبل المسح');
  ok(factory.get('auditLog').length > 0, 'سجل قبل المسح');
  ok(BL.clearAllData(), 'فشل المسح');
  const d = D();
  eq(d.arabonSales.length, 0, 'عربون');
  eq(d.stockMovements.length, 0, 'حركات مخزون');
  eq(d.products.length, 0, 'أصناف');
  eq(d.merchants.length, 0, 'عملاء');
  eq(d.transactions.length, 0, 'حركات مالية');
  eq(d.installments.length, 0, 'عقود');
  eq(d.merchantSales.length, 0, 'مبيعات تجار');
  eq(d.accounts.length, 0, 'حسابات');
  eq(d.openingCapital, 0, 'رأس المال');
  eq(factory.get('employees').length, 0, 'موظفون');
  eq(factory.get('auditLog').length, 0, 'سجل تدقيق');
  eq(factory.get('partners').length, 0, 'شركاء');
  eq(factory.get('recurringExpenses').length, 0, 'مصروفات دورية');
  eq(Object.keys(factory.get('msgTemplates')).length, 0, 'قوالب الرسائل');
  return 'كل المخازن صفر';
});

// ─────────── فصل الأدوار في ملخص البيانات ───────────
test('ملخص: فصل التجار عن عملاء التقسيط والعربون', () => {
  factory.seed(BASE());
  newInst();                              // العميل 1: عقد تقسيط
  newArabon();                            // العميل 1: عقد عربون
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, date: '2026-01-03T10:00:00.000Z' });
  const roles = BL.contactRoleCounts();
  eq(roles.traders, 1, 'التجار (التاجر 2 فقط)');
  eq(roles.installmentCustomers, 1, 'عملاء التقسيط');
  eq(roles.arabonCustomers, 1, 'عملاء العربون');
  ok(html.includes('BusinessLogic.contactRoleCounts()'), 'لوحة التحكم تستخدم التصنيف الجديد');
  return 'تاجر واحد + عميل لكل نوع';
});

test('ملخص: من له نشاط تجاري يبقى تاجراً حتى لو عليه عقد تقسيط', () => {
  factory.seed(BASE());
  newInst({ merchantId: 2 });
  BL.sellToMerchant({ merchantId: 2, productId: 1, qty: 1, actualTotal: 13000, date: '2026-01-03T10:00:00.000Z' });
  const roles = BL.contactRoleCounts();
  eq(roles.traders, 2, 'التاجران (1 بلا نشاط + 2 بنشاط)');
  eq(roles.installmentCustomers, 0, 'لا يُحسب عميل تقسيط');
  return 'النشاط التجاري له الأولوية';
});

// ─────────── توزيع أرباح/خسائر الشركاء ───────────
test('أرباح: توزيع ربح على شريك حسب النسبة', () => {
  factory.seed(BASE());
  const sale = BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-15T10:00:00.000Z' });
  ok(sale.success, 'فشل البيع');
  factory.get('partners').push({ id: 1, name: 'شريك', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 1000, profitPercent: 20 });
  const res = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(res.success, 'فشل التوزيع: ' + res.reason);
  eq(res.netProfit, 2500, 'صافي الربح');
  eq(res.lines[0].share, 500, 'حصة الشريك');
  eq(factory.get('partners')[0].balance, 1500, 'رصيد بعد الأرباح');
  const tx = D().transactions.find(t => t.type === 'partner_profit');
  ok(!!tx, 'قيد الأرباح');
  ok(tx.periodFrom === '2026-01-01' && tx.periodTo === '2026-01-31', 'فترة التوزيع');
  ok(html.includes('openProfitDistribution'), 'زر توزيع الأرباح في الواجهة');
  return '2500 × 20% = 500';
});

test('أرباح: توزيع خسارة يخصم من رصيد الشريك', () => {
  const base = BASE(); base.products[0].sellPrice = 5000; factory.seed(base);
  const sale = BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-15T10:00:00.000Z' });
  ok(sale.success, 'فشل البيع');
  factory.get('partners').push({ id: 1, name: 'شريك', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 1000, profitPercent: 30 });
  const res = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(res.success, 'فشل التوزيع: ' + res.reason);
  ok(res.netProfit < 0, 'صافي خسارة');
  const p = factory.get('partners')[0];
  ok(p.balance < 1000, 'الخسارة خصمت من الرصيد');
  const tx = D().transactions.find(t => t.type === 'partner_loss');
  ok(!!tx, 'قيد الخسارة');
  return 'خسارة × 30%';
});

test('أرباح: إلغاء توزيع يعيد الأرصدة', () => {
  factory.seed(BASE());
  BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-15T10:00:00.000Z' });
  factory.get('partners').push({ id: 1, name: 'شريك', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 1000, profitPercent: 20 });
  const res = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(res.success);
  const before = factory.get('partners')[0].balance;
  const rev = BL.reversePartnerDistribution(res.distributionId);
  ok(rev.success, 'فشل الإلغاء');
  eq(factory.get('partners')[0].balance, 1000, 'رصيد مسترجع');
  ok(!D().transactions.some(t => t.distributionId === res.distributionId), 'حذفت القيود');
  return 'إلغاء توزيع';
});

test('أرباح: مجموع النسب > 100% مرفوض', () => {
  factory.seed(BASE());
  BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-15T10:00:00.000Z' });
  factory.get('partners').push({ id: 1, name: 'ش1', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 0, profitPercent: 60 });
  factory.get('partners').push({ id: 2, name: 'ش2', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 0, profitPercent: 50 });
  const res = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(!res.success && res.reason === 'percent_over_100', 'يجب رفض مجموع > 100%');
  return 'رفض مجموع نسب > 100%';
});

test('أرباح: توزيع نفس الفترة مرتين مرفوض (تداخل)', () => {
  factory.seed(BASE());
  BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-15T10:00:00.000Z' });
  factory.get('partners').push({ id: 1, name: 'ش1', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 0, profitPercent: 20 });
  const r1 = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(r1.success);
  const r2 = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-21T00:00:00.000Z' });
  ok(!r2.success && r2.reason === 'period_overlap', 'يجب رفض توزيع متداخل');
  return 'رفض توزيع متداخل';
});

test('أرباح: فترة بدون ربح/خسارة مرفوضة', () => {
  factory.seed(BASE());
  factory.get('partners').push({ id: 1, name: 'ش1', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 0, profitPercent: 20 });
  const res = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(!res.success && res.reason === 'zero_amount', 'يجب رفض فترة بدون صافي');
  return 'رفض فترة بصافي صفر';
});

test('أرباح: توزيع يبقى consistent مع فحص أرصدة الشركاء', () => {
  factory.seed(BASE());
  BL.sellCash({ productId: 1, qty: 1, accountId: 1, date: '2026-01-15T10:00:00.000Z' });
  factory.get('partners').push({ id: 1, name: 'ش1', phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance: 0, profitPercent: 20 });
  const res = BL.distributePartnerProfits({ from: '2026-01-01', to: '2026-01-31', date: '2026-01-20T00:00:00.000Z' });
  ok(res.success);
  const p = factory.get('partners')[0];
  let calc = 0;
  D().transactions.forEach(t => {
    if (t.partnerId != p.id) return;
    if (t.type === 'partner_deposit' || t.type === 'partner_profit') calc += t.amount;
    else if (t.type === 'partner_withdrawal' || t.type === 'partner_loss') calc -= t.amount;
  });
  ok(Math.abs(calc - p.balance) < 0.01, 'رصيد الشريك يجب أن يطابق حركاته');
  return 'فحص أرصدة شركاء نظيف';
});

// ─────────── دخول شريك جديد على نشاط قائم ───────────
const addPartners = (list) => {
  const ps = factory.get('partners');
  list.forEach(p => ps.push(p));
  return ps;
};
const P = (id, name, balance, pct) => ({ id, name, phone: '', notes: '', date: '2026-01-01T00:00:00.000Z', balance, profitPercent: pct });

test('دخول شريك (أ): ضخ أموال يحسب النسبة بعد التوسعة ويخفف القدامى', () => {
  factory.seed(BASE());
  const ps = addPartners([P(1, 'ش1', 6000, 60), P(2, 'ش2', 4000, 40)]);
  const res = BL.admitPartner({
    method: 'cash_injection', name: 'ش3', amount: 10000, valuation: 40000,
    accountId: 1, recordGoodwill: false, date: '2026-02-01T00:00:00.000Z'
  });
  ok(res.success, 'فشل الدخول: ' + res.reason);
  eq(res.newPercent, 20, 'نسبة الشريك الجديد');
  eq(ps[0].profitPercent, 48, 'ش1 بعد التخفيف');
  eq(ps[1].profitPercent, 32, 'ش2 بعد التخفيف');
  eq(ps[2].profitPercent, 20, 'نسبة الجديد');
  eq(ps[2].balance, 10000, 'رصيد رأس مال الجديد');
  eq(BL.accountBalance(1), 10000, 'الخزينة استلمت المبلغ');
  eq(BL.partnerBookEquity(), 20000, 'رأس المال الدفتري بعد');
  const deposit = D().transactions.find(t => t.type === 'partner_deposit');
  ok(deposit && Math.abs(deposit.amount - 10000) < 0.01, 'قيد إيداع الشريك');
  const jd = res.journal.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0);
  const jc = res.journal.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0);
  eq(jd, jc, 'القيد متوازن');
  return '10,000 ÷ 50,000 = 20% | 48% / 32%';
});

test('دخول شريك (أ): الشهرة/إعادة التقييم تُوزع على القدامى قبل الدخول', () => {
  factory.seed(BASE());
  const ps = addPartners([P(1, 'ش1', 6000, 60), P(2, 'ش2', 4000, 40)]);
  const res = BL.admitPartner({
    method: 'cash_injection', name: 'ش3', amount: 10000, valuation: 40000,
    accountId: 1, recordGoodwill: true, date: '2026-02-01T00:00:00.000Z'
  });
  ok(res.success, 'فشل الدخول: ' + res.reason);
  eq(res.goodwill, 30000, 'فرق التقييم/الشهرة');
  eq(ps[0].balance, 24000, 'ش1 بعد الشهرة');
  eq(ps[1].balance, 16000, 'ش2 بعد الشهرة');
  eq(ps[2].balance, 10000, 'رصيد الجديد');
  eq(BL.partnerBookEquity(), 50000, 'رأس المال = القيمة بعد التوسعة');
  const gw = D().transactions.filter(t => t.type === 'partner_goodwill');
  eq(gw.length, 2, 'عدد قيود الشهرة');
  eq(gw.reduce((s, t) => s + t.amount, 0), 30000, 'إجمالي الشهرة');
  return 'شهرة 30,000 → 18,000 / 12,000';
});

test('دخول شريك (ب): شراء حصة ينقل رأس المال دون تغيير الإجمالي أو النقدية', () => {
  factory.seed(BASE());
  const ps = addPartners([P(1, 'ش1', 12000, 60), P(2, 'ش2', 8000, 40)]);
  const res = BL.admitPartner({
    method: 'stake_purchase', name: 'ش3', amount: 15000, valuation: 50000,
    sellerId: 1, recordGoodwill: false, date: '2026-02-01T00:00:00.000Z'
  });
  ok(res.success, 'فشل الشراء: ' + res.reason);
  eq(res.newPercent, 30, 'نسبة الشريك الجديد');
  eq(ps[0].profitPercent, 30, 'نسبة البائع بعد البيع');
  eq(ps[2].profitPercent, 30, 'نسبة المشتري');
  eq(ps[2].balance, 6000, 'رأس المال المنقول للمشتري');
  eq(ps[0].balance, 6000, 'رصيد البائع بعد النقل');
  eq(ps[1].balance, 8000, 'الشريك الآخر لم يتأثر');
  eq(BL.partnerBookEquity(), 20000, 'إجمالي رأس المال لم يتغير');
  eq(BL.accountBalance(1), 0, 'لا تدخل نقدية للمشروع');
  const outT = D().transactions.find(t => t.type === 'partner_capital_out');
  const inT = D().transactions.find(t => t.type === 'partner_capital_in');
  ok(outT && inT && Math.abs(outT.amount - 6000) < 0.01 && Math.abs(inT.amount - 6000) < 0.01, 'قيدا نقل الحصة');
  return '30% من البائع | 6,000 ج نقل رأس مال';
});

test('دخول شريك (ب): مع تسجيل الشهرة تُعاد تقييم الحصص قبل البيع', () => {
  factory.seed(BASE());
  const ps = addPartners([P(1, 'ش1', 12000, 60), P(2, 'ش2', 8000, 40)]);
  const res = BL.admitPartner({
    method: 'stake_purchase', name: 'ش3', amount: 15000, valuation: 50000,
    sellerId: 1, recordGoodwill: true, date: '2026-02-01T00:00:00.000Z'
  });
  ok(res.success, 'فشل الشراء: ' + res.reason);
  eq(res.goodwill, 30000, 'فرق التقييم');
  eq(ps[0].balance, 15000, 'رصيد البائع بعد إعادة التقييم والبيع');
  eq(ps[2].balance, 15000, 'رصيد المشتري بقيمة الحصة');
  eq(ps[1].balance, 20000, 'رصيد الشريك الآخر بعد الشهرة');
  eq(BL.partnerBookEquity(), 50000, 'إجمالي رأس المال = التقييم');
  eq(res.capitalTransferred, 15000, 'الحصة المنقولة');
  return 'شهرة ثم بيع 30% = 15,000 ج';
});

test('دخول شريك: النسب المتبقية أقل من 100% تُخفف دون تجاوز 100%', () => {
  factory.seed(BASE());
  const ps = addPartners([P(1, 'ش1', 6000, 30), P(2, 'ش2', 4000, 20)]);
  const res = BL.admitPartner({
    method: 'cash_injection', name: 'ش3', amount: 10000, valuation: 40000,
    accountId: 1, recordGoodwill: false, date: '2026-02-01T00:00:00.000Z'
  });
  ok(res.success, 'فشل الدخول: ' + res.reason);
  eq(ps[0].profitPercent, 24, 'ش1 بعد التخفيف');
  eq(ps[1].profitPercent, 16, 'ش2 بعد التخفيف');
  eq(ps[2].profitPercent, 20, 'الجديد');
  const total = ps.reduce((s, p) => s + p.profitPercent, 0);
  ok(total <= 100.001, 'المجموع لا يتجاوز 100%');
  return '30/20 → 24/16 + 20% جديد';
});

test('دخول شريك: رفض المدخلات غير الصحيحة وتجاوز حصة البائع', () => {
  factory.seed(BASE());
  addPartners([P(1, 'ش1', 12000, 40), P(2, 'ش2', 8000, 60)]);
  let r = BL.admitPartner({ method: 'cash_injection', name: 'ش3', amount: 0, valuation: 40000, accountId: 1 });
  ok(!r.success && r.reason === 'invalid_amount', 'رفض مبلغ صفر');
  r = BL.admitPartner({ method: 'cash_injection', name: 'ش3', amount: 10000, valuation: 0, accountId: 1 });
  ok(!r.success && r.reason === 'invalid_valuation', 'رفض تقييم صفر');
  r = BL.admitPartner({ method: 'stake_purchase', name: 'ش3', amount: 50000, valuation: 100000, sellerId: 1 });
  ok(!r.success && r.reason === 'percent_exceeds_seller', 'رفض تجاوز حصة البائع');
  r = BL.admitPartner({ method: 'cash_injection', name: 'ش1', amount: 10000, valuation: 40000, accountId: 1 });
  ok(!r.success && r.reason === 'duplicate_name', 'رفض تكرار الاسم');
  return 'رفض: مبلغ/تقييم/حصة/اسم مكرر';
});

test('دخول شريك: سجل العمليات والقيود قابل للاسترجاع', () => {
  factory.seed(BASE());
  addPartners([P(1, 'ش1', 6000, 60), P(2, 'ش2', 4000, 40)]);
  const r1 = BL.admitPartner({ method: 'cash_injection', name: 'ش3', amount: 10000, valuation: 40000, accountId: 1, recordGoodwill: true });
  ok(r1.success, r1.reason);
  const list = BL.listPartnerAdmissions();
  eq(list.length, 1, 'عملية واحدة في السجل');
  eq(list[0].newPartnerName, 'ش3', 'اسم الشريك في السجل');
  eq(list[0].journal.length >= 2, true, 'القيد محفوظ');
  const d = list[0].journal.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0);
  const c = list[0].journal.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0);
  eq(d, c, 'القيد المحفوظ متوازن');
  return 'سجل + قيد متوازن';
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