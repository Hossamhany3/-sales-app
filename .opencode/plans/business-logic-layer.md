# خطة تنفيذ طبقة المنطق التجاري المركزية - Business Logic Layer

## الملف المستهدف: `app_fixed.html` (~10,700 سطر)

---

## نظرة عامة

النظام الحالي يتفاعل مع البيانات مباشرة عبر `transactions.push()`, `product.stock -=`, `installments.push()` إلخ — بدون أي طبقة مركزية. هذا يجعل:
- منع التكرار صعباً
- التدقيق المالي شبه مستحيل
- التحديثات (مثل تعديل القسط وإلغائه) تسبب تضارب في البيانات

**الحل:** إنشاء كائن `BusinessLogic` مركزي يتولى كل العمليات المالية/المخزونية، ثم تحويل كل الدوال الحالية للمرور عبره.

---

## المبادئ الأساسية

1. **لا تحقق** — لا نتحقق من المدخلات هنا (سيكون ذلك في الواجهة)
2. **no UI** — لا عناصر DOM في BLL
3. ** Atomic operations** — كل عملية تنشئ Transaction + StockMovement معاً بـ id واحد مشترك
4. **Duplicate prevention** — كل عملية تحمل `sourceType + sourceId + operationType` يمنع التكرار
5. **Reconciliation** — `reconcile()` يتحقق من تطابق الأرصدة مع السجلات
6. **Backward compatibility** — البيانات القديمة تبقى صالحة، `migrateExistingData()` تنظف التكرارات القديمة

---

## المرحلة 1: إنشاء كائن BusinessLogic الأساسي (سطور ~2877-2900)

**الموقع:** بعد انتهاء قسم `/* ══════════════════════════════════════════════════════════════ */` (سطر 2876) وقبل `/* ════════════════════════════════════════════════════════════════ */ /* ══════════════════════════════════════════════════════════════ 15. UI Helpers...`

### المكونات:

```js
window.BusinessLogic = {
    // ═══════════════ Core Engine ═══════════════
    
    // 1. توليد ID مشترك للعملية
    genId() { ... },
    
    // 2. التحقق من عدم التكرار (sourceType + sourceId + operationType)
    existsDuplicate(sourceType, sourceId, operationType) { ... },
    
    // 3. تسجيل عملية مالية + حركة مخزون معاً
    postTransaction({ type, amount, accountId, productId, merchantId, 
                      employeeId, notes, category, discount, sourceType, 
                      sourceId, operationType, date, instId, arabonId }) { ... },
    
    // 4. إضافة حركة مخزون
    addStockMovement({ productId, type, qty, ref, sourceType, sourceId, 
                       date, notes }) { ... },
    
    // 5. ربط سجل بأخرى
    linkTransaction(sourceType, sourceId, transactionId) { ... },
    linkStockMovement(sourceType, sourceId, movementId) { ... },
    
    // 6. جلب سجلات مرتبطه
    transactionForSource(sourceType, sourceId, operationType) { ... },
    stockMovementsForSource(sourceType, sourceId) { ... },
    
    // ═══════════════ Balance Queries ═══════════════
    
    // 7. رصيد حساب من المعاملات
    accountBalance(accountId) { ... },
    
    // 8. رصيد عميل (قسط + عربون + تاجر)
    customerBalance(merchantId) { ... },
    
    // 9. رصيد التاجر من المعاملات (يحل محل calcMerchantBalance)
    merchantBalanceFromTransactions(merchantId) { ... },
    
    // 10. ملخص البيانات المالية
    getBusinessSummary() { ... },
    
    // ═══════════════ Operations ═══════════════
    
    // 11. بيع نقدي
    sellCash({ productId, qty, accountId, employeeId, notes, date }) { ... },
    
    // 12. شراء مخزون
    purchaseStock({ productId, qty, accountId, notes, date }) { ... },
    
    // 13. إنشاء عقد قسط
    createInstallment({ ... }) { ... },
    
    // 14. دفعة قسط
    recordInstallmentPayment({ installmentId, amount, accountId, 
                                cashAmount, bankAmount, bankAccountId, date }) { ... },
    
    // 15. تعديل/حذف قسط
    editInstallment({ ... }) { ... },
    deleteInstallment(installmentId) { ... },
    
    // 16. إنشاء عربون
    createArabon({ ... }) { ... },
    
    // 17. دفعة عربون
    recordArabonPayment({ arabonId, amount, accountId, ... }) { ... },
    
    // 18. تحويل عربون لأقساط
    convertArabonToInstallment({ arabonId, ... }) { ... },
    
    // 19. حذف عربون
    deleteArabon(arabonId) { ... },
    
    // 20. بيع تاجر
    sellToMerchant({ merchantId, productId, qty, accountId, employeeId, 
                     notes, date, actualTotal }) { ... },
    
    // 21. شراء من تاجر
    purchaseFromMerchant({ merchantId, productId, qty, costPrice, accountId, 
                           notes, date }) { ... },
    
    // 22. دفعة تاجر (من التاجر)
    recordMerchantPaymentIn({ merchantId, amount, accountId, cashAmount, 
                               bankAmount, bankAccountId, notes, date }) { ... },
    
    // 23. دفعة تاجر (للتاجر)
    recordMerchantPaymentOut({ merchantId, amount, accountId, cashAmount, 
                                bankAmount, bankAccountId, notes, date }) { ... },
    
    // 24. تحويل بين حسابات
    transferBetweenAccounts({ fromAccountId, toAccountId, amount, notes, date }) { ... },
    
    // 25. إيداع/سحب شريك
    partnerTransaction({ partnerId, type, amount, accountId, cashAmount, 
                          bankAmount, bankAccountId, notes, date }) { ... },
    
    // 26. إضافة/تحديث مصروف
    addExpense({ amount, category, accountId, notes, date }) { ... },
    
    // 27. تعديل/حذف معاملة + ربطها
    editTransaction(transactionId, updates) { ... },
    deleteTransaction(transactionId) { ... },
    
    // ═══════════════ Reconciliation ═══════════════
    
    // 28. التحقق من تطابق البيانات
    reconcile() { ... },
    
    // 29. تنظيف التكرارات القديمة
    deduplicateExistingData() { ... },
    
    // ═══════════════ Data Migration ═══════════════
    
    // 30. تحويل البيانات القديمة
    migrateExistingData() { ... }
};
```

---

## المرحلة 2: تعديل عمليات البيع النقدي (sellProduct)

**الملف:** `app_fixed.html` — الدالة `sellProduct` (سطور 5087-5167)

### التعديلات:

**قبل (سطور 5139-5154):**
```js
p.stock -= qty;
if (p.stock <= 0) p.archived = true;
for (let i = 0; i < qty; i++) {
    transactions.push({ id: Date.now() + i, type: 'sell_cash', amount: p.sellPrice, ... });
    stockMovements.push({ ... type: 'out', qty: 1, ref: 'بيع نقدي' ... });
}
```

**بعد:**
```js
// استدعاء BusinessLogic بدلاً من التعديل المباشر
let result = BusinessLogic.sellCash({
    productId: p.id,
    qty: qty,
    accountId: accountId ? parseInt(accountId) : null,
    employeeId: empId ? parseInt(empId) : null,
    notes: 'بيع نقدي | ' + p.name,
    date: new Date().toISOString()
});
// result = { transactionIds: [...], stockMovementIds: [...], stockDeducted: qty }
// لا حاجة لـ saveData() هنا — BLL يحفظ تلقائياً
```

**ملاحظة:** دالة `sellCash` في BLL ستنشئ:
- transaction واحد (وليس qtytransactions) — نوع: `sell_cash`، مبلغ: `p.sellPrice * qty`
- حركة مخزون واحدة — نوع: `out`، كمية: `qty`
- تحديث `product.stock -= qty`
- تحديث `product.archived` إذا stock = 0
- تسجيل في `auditLog`

---

## المرحلة 3: تعديل عمليات الشراء (purchaseProduct)

**الملف:** `app_fixed.html` — الدالة `purchaseProduct` (سطور 5169-5189)

**بعد:**
```js
let result = BusinessLogic.purchaseStock({
    productId: p.id,
    qty: 1,
    accountId: p.accountId || null,
    notes: 'شراء مخزون | ' + p.name,
    date: new Date().toISOString()
});
```

**BLL `purchaseStock` ستنشئ:**
- transaction واحد — نوع: `purchase`، مبلغ: `p.costPrice * qty`
- حركة مخزون واحدة — نوع: `in`، كمية: `qty`
- تحديث `product.stock += qty`
- فتح الأرشفة إذا كانت مفعلة

---

## المرحلة 4: تعديل إنشاء عقد القسط

**الملف:** `app_fixed.html` — معالج نموذج `#installmentForm` (سطور 5970-6043)

**الكود الحالي (5970-6043):**
- ينشئ كائن القسط ويدفعه لـ `installments`
- يدفع transaction `payment_in` إذا كان هناك دفعة مقدمة
- يخفض stock المنتج

**بعد:**
```js
let result = BusinessLogic.createInstallment({
    merchantId: mId,
    productId: parseInt(pId),
    deviceName: p.name,
    purchasePrice: price,
    paidUpfront: upfront,
    interestRate: rate,
    numInstallments: months,
    firstDueDate: firstDate,
    discount: discountVal,
    accountId: accId ? parseInt(accId) : null,
    employeeId: empId ? parseInt(empId) : null,
    date: new Date().toISOString()
});
// result = { installmentId, transactionId (for upfront), stockMovementId }
```

**BLL `createInstallment` ستنشئ:**
- كائن القسط مع الحسابات الصحيحة
- transaction `payment_in` للدفعة المقدمة (إذا > 0)
- حركة مخزون `out` للمنتج
- تحديث stock المنتج -1
- تسجيل في `auditLog`

---

## المرحلة 5: تعديل دفع الأقساط

**الملف:** `app_fixed.html` — الدالة `recordPayment` (سطور 6620-6649)

**الكود الحالي (6627-6641):**
```js
if(val > inst.remainingBalance) val = inst.remainingBalance;
inst.remainingBalance -= val;
if (inst.remainingBalance <= 0.01) { inst.isPaid = true; inst.remainingBalance = 0; }
transactions.push({ ... type: 'payment_in', ... });
```

**بعد:**
```js
let result = BusinessLogic.recordInstallmentPayment({
    installmentId: id,
    amount: val,
    accountId: accountId ? parseInt(accountId) : null,
    cashAmount: cashAmt,
    bankAmount: bankAmt,
    bankAccountId: bankAccId ? parseInt(bankAccId) : null,
    date: new Date().toISOString()
});
```

**BLL `recordInstallmentPayment` ستنشئ:**
- transaction واحد أو اثنين (split payment)
- تحديث `inst.remainingBalance` و `inst.isPaid`
- تحديث الجدول الزمني (إذا كانت الدفعة تغطي أقساط معينة)
- تسجيل في `auditLog`
- **منع الدفعة إذا كان القسط مكتملاً بالفعل**

---

## المرحلة 6: تعديل التعديل والحذف للأقساط

**الملف:** `app_fixed.html`

### 6.1 تعديل القسط (سطور ~6170-6220)
- استدعاء `BusinessLogic.editInstallment()` بدلاً من التعديل المباشر
- BLL سيعيد stock القديم + يخصم stock الجديد
- BLL سيمسح المعاملات القديمة وينشئ جديدة إذا تغير المنتج

### 6.2 حذف القسط (سطور ~6224-6272)
- استدعاء `BusinessLogic.deleteInstallment()` بدلاً من الحذف المباشر
- BLL سيعيد stock المنتج
- BLL سيمسح المعاملات المرتبطة

---

## المرحلة 7: تعديل عمليات العربون

**الملف:** `app_fixed.html`

### 7.1 إنشاء عربون (سطور 6668-6756)
**بعد:**
```js
let result = BusinessLogic.createArabon({
    merchantId: mId,
    productId: parseInt(pId),
    deviceName: p.name,
    sellPrice: sellPrice,
    depositAmount: deposit,
    accountId: accId ? parseInt(accId) : null,
    dueDate: dueDateVal,
    notes: notesVal,
    employeeId: empId ? parseInt(empId) : null,
    date: new Date().toISOString()
});
```

### 7.2 تعديل عربون (سطور ~6699-6731)
- استدعاء `BusinessLogic.editArabon()`

### 7.3 دفع مبلغ متبقي للعربون (سطور 6986-7188)
- استدعاء `BusinessLogic.recordArabonPayment()` أو `BusinessLogic.convertArabonToInstallment()`

### 7.4 حذف عربون (سطور ~7196-7231)
- استدعاء `BusinessLogic.deleteArabon()`

---

## المرحلة 8: تعديل عمليات التاجر

**الملف:** `app_fixed.html`

### 8.1 بيع لتاجر `recordMerchantSaleOnPage` (سطور 8037-8106)
**بعد:**
```js
let result = BusinessLogic.sellToMerchant({
    merchantId: merchantId,
    productId: p.id,
    qty: qty,
    accountId: result.accountId,
    employeeId: empId ? parseInt(empId) : null,
    notes: notes,
    actualTotal: actualTotal,
    date: new Date().toISOString()
});
```

### 8.2 شراء من تاجر `recordMerchantPurchase` (سطور ~7820-7860)
**بعد:**
```js
let result = BusinessLogic.purchaseFromMerchant({
    merchantId: merchantId,
    productId: prodId,
    qty: qty,
    costPrice: costPrice,
    accountId: accountId,
    notes: notes,
    date: new Date().toISOString()
});
```

### 8.3 دفعة من التاجر `recordMerchantPayment` (سطور 7493-7512)
**بعد:**
```js
let result = BusinessLogic.recordMerchantPaymentIn({
    merchantId: merchantId,
    amount: val,
    accountId: result.accountId,
    cashAmount: cashAmt,
    bankAmount: bankAmt,
    bankAccountId: bankAccId,
    notes: notes,
    date: new Date().toISOString()
});
```

### 8.4 دفعة لتاجر `recordMerchantPaymentOut` (سطور ~7862-7882)
**بعد:**
```js
let result = BusinessLogic.recordMerchantPaymentOut({
    merchantId: merchantId,
    amount: val,
    accountId: accountId,
    cashAmount: cashAmt,
    bankAmount: bankAmt,
    bankAccountId: bankAccId,
    notes: notes,
    date: new Date().toISOString()
});
```

### 8.5 تعديل/حذف عمليات التاجر
- `editMerchantPurchase` → `BusinessLogic.editMerchantPurchase()`
- `deleteMerchantPurchase` → `BusinessLogic.deleteMerchantPurchase()`
- `editMerchantSale` → `BusinessLogic.editMerchantSale()`
- `deleteMerchantSale` → `BusinessLogic.deleteMerchantSale()`

---

## المرحلة 9: تعديل التحويلات بين الحسابات

**الملف:** `app_fixed.html` — معالج نموذج `#transferForm` (سطور ~8810-8845)

**الكود الحالي:**
```js
transactions.push({ ... type: 'transfer_out', amount, accountId: fromId, ... });
transactions.push({ ... type: 'transfer_in', amount, accountId: toId, ... });
```

**بعد:**
```js
let result = BusinessLogic.transferBetweenAccounts({
    fromAccountId: parseInt(fromId),
    toAccountId: parseInt(toId),
    amount: amount,
    notes: notes,
    date: new Date().toISOString()
});
```

---

## المرحلة 10: تعديل المصاريف

**الملف:** `app_fixed.html` — معالج نموذج `#expenseForm` (سطور ~5375-5395)

**بعد:**
```js
let result = BusinessLogic.addExpense({
    amount: amount,
    category: category,
    accountId: accountId ? parseInt(accountId) : null,
    notes: notes,
    date: new Date().toISOString()
});
```

---

## المرحلة 11: تعديل إيداعات/سحوبات الشركاء

**الملف:** `app_fixed.html` — الدالة `addPartnerTransaction` (سطور ~8390-8415)

**بعد:**
```js
let result = BusinessLogic.partnerTransaction({
    partnerId: partnerId,
    type: isDeposit ? 'partner_deposit' : 'partner_withdrawal',
    amount: amount,
    accountId: accountId,
    cashAmount: cashAmt,
    bankAmount: bankAmt,
    bankAccountId: bankAccId,
    notes: notes,
    date: new Date().toISOString()
});
```

---

## المرحلة 12: تعديل الدخل اليدوي

**الملف:** `app_fixed.html` — معالج نموذج `#incomeForm` (سطور ~5323-5343)

**بعد:**
```js
let result = BusinessLogic.addIncome({
    amount: amount,
    category: category,
    accountId: accountId ? parseInt(accountId) : null,
    notes: notes,
    date: new Date().toISOString()
});
```

---

## المرحلة 13: تعديل الدورات التكرارية

**الملف:** `app_fixed.html` — الدالة `checkRecurringExpenses()` (سطور ~5640-5660)

**بعد:**
```js
let result = BusinessLogic.addExpense({
    amount: recurring.amount,
    category: recurring.category,
    accountId: recurring.accountId || null,
    notes: 'مصروف تكراري: ' + recurring.name,
    date: new Date().toISOString()
});
```

---

## المرحلة 14: تعديل التدقيق والمراجعات (Reconciliation)

### 14.1 دالة `reconcile()` في BLL
```js
reconcile() {
    let issues = [];
    // 1. التحقق من أرصدة الحسابات
    accounts.forEach(acc => {
        let calculatedBalance = this.accountBalance(acc.id);
        let storedBalance = acc.balance || 0;
        if (Math.abs(calculatedBalance - storedBalance) > 0.01) {
            issues.push({ type: 'account_balance_mismatch', accountId: acc.id,
                          calculated: calculatedBalance, stored: storedBalance });
        }
    });
    // 2. التحقق من تطابق stockMovements مع product.stock
    products.forEach(p => {
        let calculatedStock = this.calculateStockFromMovements(p.id);
        if (Math.abs(calculatedStock - p.stock) > 0.01) {
            issues.push({ type: 'stock_mismatch', productId: p.id,
                          calculated: calculatedStock, stored: p.stock });
        }
    });
    // 3. التحقق من أرصدة الأقساط
    installments.forEach(inst => {
        let calculated = this.calculateInstallmentBalance(inst);
        if (Math.abs(calculated - inst.remainingBalance) > 0.01) {
            issues.push({ type: 'installment_balance_mismatch', 
                          installmentId: inst.id, ... });
        }
    });
    return issues;
}
```

### 14.2 دالة `deduplicateExistingData()` في BLL
```js
deduplicateExistingData() {
    let removed = 0;
    let seen = new Set();
    transactions = transactions.filter(t => {
        let key = `${t.sourceType || ''}_${t.sourceId || ''}_${t.operationType || ''}_${t.type}_${t.amount}_${t.date}`;
        if (t.sourceType && t.sourceId && seen.has(key)) { removed++; return false; }
        if (t.sourceType && t.sourceId) seen.add(key);
        return true;
    });
    return removed;
}
```

---

## المرحلة 15: تعديل Dashboard و التقارير

**الملف:** `app_fixed.html` — الدالة `renderDashboard()` (سطور 3800-3899) و `getFinancials()` (سطور 3681-3798)

### التعديلات المطلوبة:
1. **`getFinancials()`** — تعديل حساب `cash` ليمر عبر `BusinessLogic.accountBalance()` لكل حساب
2. **`totalDebt`** — استخدام `BusinessLogic.getBusinessSummary()` بدلاً من الحساب المباشر
3. **إضافة** شاشة reconciliation في Dashboard (زر "فحص البيانات")
4. **`calcMerchantBalance()`** — استبداله بـ `BusinessLogic.merchantBalanceFromTransactions()`

---

## المرحلة 16: تعديل التدقيق (Audit Trail)

**الملف:** `app_fixed.html` — الدالة `logAudit()` (سطور 2761-2773)

### التعديلات:
1. كل دالة BLL تستدعي `logAudit()` تلقائياً عند كل عملية
2. إضافة حقل `sourceType` و `sourceId` للسجل
3. تسجيل التعديلات (قبل/بعد) في سجل التدقيق

---

## المرحلة 17: التحقق النهائي

### اختبارات التحقق:
1. **بيع نقدي** — تحقق من خصم stock + إنشاء transaction + حركة مخزون
2. **شراء** — تحقق من زيادة stock + transaction + حركة مخزون
3. **إنشاء قسط** — تحقق من خصم stock + transaction الدفعة المقدمة + كائن القسط
4. **دفع قسط** — تحقق من تحديث remainingBalance + transaction + isPaid
5. **إنشاء عربون** — تحقق من خصم stock + transaction + كائن العربون
6. **تحويل عربون لأقساط** — تحقق من إنشاء القسط + تحديث العربون
7. **بيع تاجر** — تحقق من خصم stock + transaction + كائن البيع
8. **شراء من تاجر** — تحقق من زيادة stock + transaction
9. **تحويل بين حسابات** — تحقق من transaction_out + transaction_in
10. **reconcile()** — تحقق من عدم وجود تكرارات أو تضاربات
11. **متوافق مع البيانات القديمة** — `migrateExistingData()` يعمل بدون فقدان بيانات

---

## ترتيب التنفيذ (تسلسلي)

| # | المرحلة | التعديلات | الخطوط المستهدفة |
|---|---------|----------|------------------|
| 1 | إنشاء BusinessLogic الأساسي | إضافة الكائن الكامل بعد سطر 2876 | 2876 |
| 2 | بيع نقدي `sellProduct` | استبدال التعديل المباشر BLL | 5139-5155 |
| 3 | شراء مخزون `purchaseProduct` | استبدال التعديل المباشر BLL | 5174-5186 |
| 4 | إنشاء قسط | استبدال المعالج BLL | 5970-6043 |
| 5 | دفع قسط | استبدال المعالج BLL | 6620-6649 |
| 6 | تعديل/حذف قسط | استبدال المعالج BLL | 6170-6272 |
| 7 | إنشاء عربون | استبدال المعالج BLL | 6668-6756 |
| 8 | دفع/تحويل عربون | استبدال المعالج BLL | 6986-7188 |
| 9 | حذف عربون | استبدال المعالج BLL | 7196-7231 |
| 10 | بيع تاجر | استبدال المعالج BLL | 8037-8106 |
| 11 | شراء من تاجر | استبدال المعالج BLL | 7820-7860 |
| 12 | دفعات التاجر (in/out) | استبدال المعالج BLL | 7493-7882 |
| 13 | تعديل/حذف عمليات التاجر | استبدال المعالج BLL | 7940-8175 |
| 14 | تحويلات الحسابات | استبدال المعالج BLL | 8810-8845 |
| 15 | المصاريف والدخل | استبدال المعالج BLL | 5323-5395 |
| 16 | إيداعات الشركاء | استبدال المعالج BLL | 8390-8415 |
| 17 | الدورات التكرارية | استبدال المعالج BLL | 5640-5660 |
| 18 | تعديل Dashboard/التقارير | استخدام BLL queries | 3681-3899 |
| 19 | المراجعات reconciliation | إضافة reconcile() + deduplicate() | جديد |
| 20 | التحقق النهائي | اختبار كل العمليات | جميع الأقسام |

---

## ملاحظات تقنية مهمة

1. **الصيغة المدعومة:** كل transaction في BLL يحمل الأحقية:
   ```js
   { sourceType: 'sale_cash'|'purchase'|'installment'|'arabon'|'merchant_sale'|...,
     sourceId: <id of the source record>,
     operationType: 'create'|'pay'|'edit'|'delete' }
   ```

2. **التحقق من التكرار:** قبل إنشاء أي transaction BLL يتحقق:
   ```js
   if (this.existsDuplicate(sourceType, sourceId, operationType)) {
       console.warn('duplicate prevented');
       return { success: false, reason: 'duplicate' };
   }
   ```

3. **الحفاظ على التوافق:** الدوال القديمة مثل `calcMerchantBalance()` تبقى لكن BLL يوفر نسخة محسّنة `merchantBalanceFromTransactions()`. Dashboard سيستخدم BLL تدريجياً.

4. **التدقيق المالي:** `reconcile()` يتحقق من:
   - أرصدة الحسابات = income - expense عبر المعاملات
   - stock كل منتج = stockMovements IN - stockMovements OUT
   - أرصدة الأقساط = totalAfterInterest - sum(payments)

5. **السجلات القديمة بدون sourceType:** `deduplicateExistingData()` يعاملها كسجلات فريدة (لا يحذفها).
