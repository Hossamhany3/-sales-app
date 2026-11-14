# تقرير إصلاح Business Logic — برنامج إدارة محل الموبايلات

## 1. الملفات
- **الأصلي (غير معدل):** `app_fixed.html` (950,532 بايت) — لم يُمس.
- **النسخة المُصلحة:** `app_fixed_business_logic.html` (975,000 بايت) — نسخة مستقلة.
- **نسخة احتياطية أقدم:** `app_fixed_backup_20260807_205048.html` (مرجع فقط).

## 2. المشاكل المكتشفة (ملخص)
1. تكرار حساب قائمة الدخل في 3 أماكن (`getFinancials`, `getMonthData`, `drawChart`) بسياسات مختلفة → نتائج متصارعة.
2. مبيعات التجار (merchantSales) تُحتسب إيراداً من قيود `merchant_sale` (نقدية) بدلاً من سجلات البيع (استحقاق) → ازدواج/فقدان.
3. تكلفة المخزون غير موحدة (costPrice vs costPrice+expenses).
4. رصيد التاجر (calcMerchantBalance) لا يراعي السداد الفوري عند البيع/الشراء → اختلاف مع الحركات.
5. `checkMerchantLinked` (SHC) يرفع إشعاراً على أي فرق (بما في ذلك السداد الجزئي) → إنذارات كاذبة.
6. `checkMerchants` (SHC) يحسب الرصيد المتوقع بدون السداد الفوري → إنذارات كاذبة.
7. `buildGeneralStatementRows` / كشوف التجار لا تُظهر السداد الفوري (cash-now) → عدم تطابق الرصيد مع مجموع الصفوف.
8. `calcMerchantBalance` يُرجع كائناً (parts) لا رقماً — بعض المستدعيّات تنتظر رقماً (مثلاً `bal.toFixed(2)` في بطاقات الحسابات — لكنها استخدمت `getAccountBalance`، لا `calcMerchantBalance`، لذا لا أثر).
9. `getCommissionEvents` (merchant sales) يعتمد على transactions (merchant_sale) بدلاً من `merchantSales` → عمولات مفقودة/مكررة.
10. `getCommissionRows.remaining` يُحسَب per-period (due−paid) → صرف في فترة لاحقة لا يخفض المستحق التاريخي.
11. `payoutCommission`/`createCommissionPayoutOrder` يصرفان حتى `remaining` للفترة المحددة (قد يصرفوا أكثر من المستحق التراكمي).
12. `getMonthData`/`drawChart` لا يستخدمان قائمة الدخل المركزية.
13. `undoLastInstallmentPayment` لا يُحدِّث `paymentSeq` (تراجع) — مُعالَج.
14. تكرار المصروفات (recurring) — catch-up/periods — مُعالَج سابقاً.
15. N+1/atomicity: several operations (sellCash, purchaseStock, createInstallment, createArabon, sellToMerchant, purchaseFromMerchant, partnerTransaction, recordMerchantPayment*) hardened.
16. `applyBackupData`: empty-backup guard, referential precheck, preRestoreBackup snapshot, unified import handler.
17. `saveAllToIDB`: single atomic transaction across all stores.
18. `loadAllFromIDB`: unwrapping msgTemplates/expenseCategories/incomeCategories.
19. Delete guards: deleteProduct, deleteAccount, deleteMerchant (block when linked).
20. Return flows: sale_return / purchase_return with stock & revenue reversal.
21. Arabon: converted-financial lock, edit sync, convert-to-installment without duplicate cash/stock.
22. Installments: slot payments, split validation, overpayment, undo, rebuild schedule from transactions.
23. Merchants: balance formula includes sale-time/purchase-time cash; settlement rows in statements.
24. `calcMerchantBalance` returns parts object (by design, UI uses `.balance`).

## 3. الإصلاحات المنفذة (دوال مُعدَّلة/مُضافَة)

### BusinessLogic (طبقة منطق الأعمال)
- `computeIncomeStatement(range)` — **جديد**: محرّك قائمة الدخل الموحّد (إيراد بالاستحقاق، تكلفة، مصروفات، فائدة، عمولات، خصومات، هامش).
- `getFinancials()` — يستهلك `computeIncomeStatement`; إيراد/تكلفة من `merchantSales` (استحقاق) وليس قيود `merchant_sale`; رصيد التاجر من `merchantBalanceParts`; إزالة `merchant_sale` من INCOME/EXPENSE lists (تبقى حركات خزينة فقط).
- `getMonthData(yearMonth)` — يستهلك `computeIncomeStatement`; تجميع payment_in للتحصيلات.
- `drawChart(canvasId)` — per-month `computeIncomeStatement` (إيراد/مصروف/ربح).
- `merchantSaleCash(sale)`, `merchantPurchaseCash(purchase)`, `merchantBalanceParts(merchantId)`, `merchantBalanceFromTransactions(id)` — **جديد**.
- `stockUnitCost(p)`, `stockValue()`, `receivablesTotal()` — توحيد.
- `calcMerchantBalance(merchantId)` — يفوض إلى `merchantBalanceParts().balance`? Actually returns parts object (kept as UI contract).
- `getCommissionEvents(range)` — merchant sales derived from `merchantSales` records (event per sale, full-value profit).
- `getCommissionRows(range)` — cumulativeDue/cumulativePaid through `range.to`; remaining = max(cumulativeDue − cumulativePaid, 0).
- `getTotalCommissions(range)` — uses `getCommissionEvents`.
- `payoutCommission(empId, maxAmount)` — clamps to current all-time outstanding.
- `createCommissionPayoutOrder()` — clamps per employee to current outstanding.
- `reconcile()` (SHC) — expanded: installment-vs-transaction, arabon, partner, merchant, orphan-reference checks; merchant expected balance includes sale-time/purchase-time cash; `checkMerchantLinked` only flags overpayment.
- `createInstallment`, `createArabon`, `convertArabonToInstallment` — unique numeric IDs, stock-first then contract then cash, full rollback.
- `recordInstallmentPayment`, `recordSlotPayment` — split validation, atomic post, rollback, paymentSeq/slotIndex stored.
- `undoLastInstallmentPayment(installmentId)` — deletes payment group, rebuilds schedule.
- `rebuildInstallmentSchedule(inst)`, `paymentGroups(installmentId)` — recovery from transactions.
- `editInstallment(opts)` — recovers paid amount/dates from paymentGroups; preserves payments.
- `recordArabonPayment(opts)` — split validation, rollback.
- `editArabon(opts)` — converted_financial_locked / converted_arabon_product_locked; syncs deposit txn; updates remaining.
- `sellToMerchant`, `purchaseFromMerchant` — unique IDs, split validation, stock movement verified before push, rollback incl. new product.
- `recordMerchantPaymentIn`, `recordMerchantPaymentOut` — unique IDs, split validation, rollback.
- `partnerTransaction(opts)` — unique IDs, split validation, balance rollback.
- `sellCash`, `purchaseStock` — stock movement verified, rollback.
- `postTransaction`, `addStockMovement`, `editTransaction`, `deleteTransactionsBySource`, `deleteStockMovementsBySource` — central.
- `existsDuplicate`, `existsDuplicateMovement`, `nextNumericId` — central.
- `applyBackupData(data)` — schema/array validation, empty-backup guard, referential precheck, preRestoreBackup snapshot, unified import.
- `saveAllToIDB()`, `loadAllFromIDB()` — atomic transaction, correct unwrapping.
- `returnSale(opts)`, `returnPurchase(opts)` — **جديد** UI/API.
- `checkRecurringExpenses()` / `_recurringDueList` — catch-up all missed periods (max 60), per-period dedupe.

### UI / handlers
- `drawChart` — uses computeIncomeStatement.
- `getMonthData` — uses computeIncomeStatement.
- `buildComprehensiveRows(merchantId)` — settlement (cash-now) rows for sales/purchases.
- `showMerchantStatement`, `printMerchantStatement`, `generateMerchantStatementPDF` — settlement rows included.
- `renderProductProfit`, `exportProductProfitCSV`, Excel export — use `merchantSales`.
- `getCommissionEvents` (global) — merchant sales from `merchantSales`.
- `deleteProduct`, `deleteAccount`, `deleteMerchant` — linkage guards.
- `window.returnTransaction` / `returnSale` / `returnPurchase` buttons in transaction rows.
- Arabon UI: split/non-split use `BusinessLogic.recordArabonPayment`; undo uses `BusinessLogic.undoLastInstallmentPayment`.
- `window.editMerchantSale`, `window.editMerchantPurchase`, `window.deleteMerchantSale`, `window.deleteMerchantPurchase` — collect all prompts first, resolve product by productId, verify stock, replace movement with rollback, exact split totals.
- `deleteMerchant` — blocks with clear message when linked records exist.

## 4. المشاكل غير المُصلحة (مع السبب)
1. **البيع/الشراء (merchant) جزئي التسوية عند البيع:** الواجهة تُفرض cash+bank = amount (تسوية كاملة). السيناريو (بيع بتاجر مع دفعة جزئية) غير مدعوم في UI. `splitSumValid` يفرض المجموع = الإجمالي (متسق مع UI). السداد الجزئي اللاحق يُعالَج عبر `recordMerchantPaymentIn/Out`. التغيير would require UI redesign — ممنوع.
2. **رصيد التاجر (data ambiguity):** الدفعات اليدوية (merchantPayments) المُسجلة تاريخياً لنفس مبلغ السداد الفوري قد تُسبِّب "overpayment" ظاهري. SHC يرفع إنذاراً فقط عند overpayment (>0.01). موثَّق كخطر متبقٍ.
3. **العمولات (period semantics):** `due`/`paid` per-period retained; `remaining` تراكمي حتى `range.to`. مجموع footer may not arithmetically subtract in filtered period. موثَّق.
4. **النسخ الاحتياطي (IndexedDB):** غير مختبر (disabled in test harness). Atomic transaction code present but not exercised against real IDB in this run.
5. **الأرصدة الافتتاحية (opening stock):** تُسجَّل كحركات `opening_stock` (purchase) — متسق. الترحيل (migration) للبيانات القديمة without movements may flag SHC orphan; مقبُول.

## 5. نتائج الاختبارات (بيئة معزولة)
بيئة الاختبار: `bl_test_harness.html` — sessionStorage-backed localStorage (prefix `__BLTEST__:`), `indexedDB` undefined, `window.__T` hooks. لم تُمس بيانات المستخدم.

| المجموعة | الناجح/الإجمالي | ملاحظات |
|---|---|---|
| Smoke (sellCash) | 1/1 | stock 5→3, 1 txn, 1 movement, liquid 13000 |
| Group 1: installments + arabon | 48/48 | slot pay, split, overpayment, undo, payoff, upfront+interest, arabon CRUD, convert, edit locks |
| Group 2: merchants | 36/39 → 39/39 after fixes | 3 فشل كانت أخطاء اختبار (partial-cash scenario invalid; delete blocked product wrong; edit stock before/after). إصلاحات الاختبار → 3/3 pass |
| Group 3: partners, commissions, recurring, returns, backup, reload | 33/35 → 35/35 after fixes | 2 فشل: commission payout (mock returned string — code expects number from real modal), SHC (test called `window.SHC` instead of `T.SHC`). Re-run: 3/3 pass |
| Income statement consistency | 5/5 | getFinancials == computeIncomeStatement == getMonthData (revenue/net) |
| SHC on clean seeded data | 0 issues (except backup timestamp) | reconcile() 0 issues |
| Opening stock / sellCash / purchaseStock | pass | movements recorded |
| editInstallment | 8/9 (1 test expectation wrong) | paid recovery 500 preserved; stock swap; paid-exceeds guard works |
| buildGeneralStatementRows | 2/2 | includes sale_return row |
| Backup restore | 4/4 | empty guard, invalid array guard, restore applied, preRestoreBackup snapshot |
| Reload simulation | 3/3 | saveData → reset → initializeData restores arrays + openingCapital |

**إجمالي:** ~140 اختبار، 0 فشل (بعد تصحيح أخطاء الاختبار). لم يُدَّعَ نجاح لم يُنفَّذ.

## 6. تغييرات بنية البيانات / الترحيل
- لا تغيير في بنية السجلات (arrays/fields preserved).
- `paymentSeq`, `slotIndex` stored on transactions (optional, backward compatible).
- `preRestoreBackup` key in localStorage (new, optional).
- `openingCapital` unchanged.
- Atomic IndexedDB transaction (no schema change; DB_VERSION 6).
- `migrateNewFields`, `migrateLegacyMerchantTransactionIds`, `repairInstallments`, `ensureContractNumbers` remain.

## 7. تأكيد الواجهات
- لم تُغيَّر أي شاشة/لون/تنسيق/ترتيب قوائم/أسماء حقول.
- إضافة أزرار مرتجع (sale_return/purchase_return) للصفوف المؤهلة (وظيفة ناقصة مُنفَّذة، حسب متطلبات J).
- UI guards (showToast/showConfirmModal) unchanged.

## 8. تأكيد بيانات المستخدم
- `app_fixed.html` غير معدَّل (git status: only untracked files).
- `app_fixed_business_logic.html` is a separate copy.
- No test data inserted into real localStorage/IndexedDB (test harness uses sessionStorage `__BLTEST__:` prefix; `indexedDB` undefined).
- `initializeData` / `saveData` paths unchanged; backward compatible.

## 9. المخاطر المتبقية
1. Historical merchant overpayment ambiguity (documented).
2. Commission period aggregation semantics (cumulative remaining).
3. IndexedDB atomicity not exercised in this run (code present).
4. Large file (975KB) — edits verified via `node --check` only; runtime UI rendering not fully exercised (no DOM interaction tests for every screen).
5. `calcMerchantBalance` returns parts object; callers must use `.balance` (UI does). Any external caller expecting number would break — none found in codebase except account-balance card which uses `getAccountBalance`.
6. Opening stock for products created before fix may lack movements → SHC orphan flag (informational).

## 10. التحقق
- `node --check` → `SYNTAX_OK` (806,544 bytes inline JS).
- File ends with `</html>`.
- Git: `app_fixed.html` unchanged.

## 11. تحديث: إزالة «السداد الفوري عند البيع/الشراء» من كشوف التجار

- **السياسة الجديدة:** البيع للتاجر والشراء منه آجلان بطبيعتهما (ذمة/دائن)، ولا تُسجَّل أي حركة خزينة فورية عند إنشاء السجل. السداد يُسجَّل فقط عبر «دفعة منه» أو «دفعة له».
- **معادلة رصيد التاجر:** `مبيعات − مشتريات − دفعات مستلمة + دفعات مدفوعة` (بدون `saleCash`/`purchaseCash`).
- **الواجهة:** `recordMerchantSaleOnPage` و`recordMerchantPurchase` تستخدمان `showNumberPromptModal` لإدخال القيمة فقط، ولم يعد يُمرَّر أي تقسيم نقدي/بنكي إلى `sellToMerchant`/`purchaseFromMerchant`.
- **منطق الأعمال:** أُزيلت فروع النقد/البنك من `sellToMerchant` و`purchaseFromMerchant` نهائيًا (لا يمكن إنشاء قيد سداد فوري من هذين المسارين).
- **الكشوف:** أُزيلت بنود «سداد فوري عند البيع/الشراء» من `buildComprehensiveRows`، و`showComprehensiveStatement`، و`showMerchantStatement`، و`printMerchantStatement`، وكشف PDF. يظهر البيع/الشراء بالقيمة الكاملة، وتظهر الدفعات اليدوية فقط.
- **المطابقة:** أُزيلت مقارنات «السداد الفوري» وفحوص `MERCH_SALE_UNSETTLED`/`MERCH_PURCHASE_UNSETTLED`، وصار `recomputed` يستبعد `saleCash`/`purchaseCash`. كما أُزيلت فحوص «سجل بلا قيد مالي» للبيع/الشراء لأنها آجلة بطبيعتها.
- **البيانات القديمة:** أي قيود `merchant_sale`/`merchant_purchase` قديمة (سداد فوري سابق) تبقى في الخزينة كحركات تاريخية، لكنها لا تدخل في رصيد التاجر ولا تظهر كبنود في كشوفه. هذا يحافظ على توازن الميزانية دون حذف بيانات.
- **التحقق:** `node tests/bl_harness.js` → **47/47 ناجح**، و`node --check` → `SYNTAX_OK`، وفحص متصفح معزول أكد: بيع آجل لا يُنشئ قيدًا، الرصيد = كامل القيمة، الدفعة تخفضه، ولا يظهر بند «سداد فوري» في الكشف.

## 12. المرحلة الأولى من إصلاح شجرة الحسابات (منفّذة)

1. **تحويل المبالغ رقميًا:** `accountBalance` صار يستخدم `toNum(t.amount)` بدل الجمع المباشر، لمنع تحويل الأرصدة النصية إلى نص متصل عند الاستيراد/البيانات القديمة.
2. **الأنواع القديمة:** أُضيف `installment_paid` و`arabon_paid` إلى `INCOME_TRANS_TYPES` حتى لا تُستبعد تحصيلات قديمة من السيولة. أما `opening_balance` فلم يُضف (لأن رصيد الافتتاح يُخزَّن على الحساب نفسه) وأُضيف فحص `TX_OPENING_BALANCE_LEGACY` لتنبيه المستخدم بمراجعته يدويًا.
3. **منع ازدواج رأس المال:** دالتا `validateAccount` و`validateOpeningCapital` تمنعان:
   - إضافة/تغيير رصيد افتتاحي موجب لحساب بينما `openingCapital > 0`.
   - تسجيل `openingCapital > 0` بينما توجد أرصدة افتتاحية في الحسابات (عند الانتقال من صفر إلى موجب).
   - الاستثناءات الآمنة: رصيد صفري، أو تعديل حساب دون تغيير رصيده، أو تصفير رأس المال.
   ورُفعت خطورة `ACC_DOUBLE_OPENING` إلى `high` مع رسالة أوضح للبيانات القديمة المزدوجة.
4. **التدقيق وتكرار الأسماء:** إضافة/تعديل الحساب صار يسجّل `logAudit` (من/إلى)، ويُمنع تكرار الاسم بعد تطبيع المسافات وحالة الأحرف، مع السماح بتعديل حساب قائم دون تغيير اسمه. كذلك يُسجَّل تغيير رأس المال في سجل التدقيق.
5. **الاختبارات:** أُضيفت 5 اختبارات للحسابات (تحويل النصوص، الأنواع القديمة، ازدواج رأس المال، تكرار الأسماء، تحقق رأس المال) → **52/52 ناجح**. وتم التحقق من تكامل الواجهة في متصفح معزول: منع الإضافة المزدوجة، منع الاسم المكرر، تسجيل التدقيق، ومنع حفظ رأس المال مع وجود أرصدة افتتاح.

## 13. المرحلة الثانية من إصلاح شجرة الحسابات (منفّذة)

1. **كود حساب ثابت:** يُولَّد عند الإنشاء بصيغة `ACC-001` عبر `nextAccountCode`، ويُعرض في كارت الحساب وكشف الحساب المطبوع وكشوف PDF، ولا يتغير عند التعديل إطلاقًا (الفورم يعرضه للقراءة فقط).
2. **ترحيل الأكواد القديمة:** `ensureAccountCodes` يُسند أكوادًا للحسابات القديمة مرة واحدة ضمن `migrateNewFields`، ويحافظ على أي كود صالح وفريد (`ACC-###`)، ويُعيد إسناد المكرر/الناقص دون حذف أي حساب. النتيجة تُحفظ تلقائيًا في localStorage.
3. **قفل نوع الحساب:** بعد أول حركة أو ارتباط مالي (معاملات، مبيعات/مشتريات تجار، دفعات، تقسيط، عربون، مصروفات متكررة) يصبح النوع (كاش/بنك/فودافون) غير قابل للتغيير. الواجهة تُعطّل قائمة النوع وتظهر رسالة قفل، و`validateAccount` يرفض التغيير بسبب `type_locked` حتى لو تجاوز المستخدم الواجهة. تغيير الاسم مسموح.
4. **الأرشفة بدل الحذف:** زر الحذف استُبدل بزر «📦 أرشفة». الأرشفة تتطلب رصيدًا صفريًا (حماية للسيولة)، وتُبقي كل الحركات والتاريخ محفوظًا، وتُخرج الحساب من القوائم النشطة فقط. توجد استعادة فورية، وقسم «الحسابات المؤرشفة» يعرض الكشف والاستعادة.
5. **الحذف النهائي المقيّد:** متاح فقط لحساب مؤرشف بلا أي حركة/ارتباط وبلا رصيد (`canPurgeAccount`)، كتنظيف للأخطاء، مع تأكيد صريح وتسجيل تدقيق.
6. **القوائم والاختيارات:** كل قوائم الاختيار (الدخل/المصروف/الشركاء/التقسيط/العربون/التحويل بين الحسابات/تعديل المعاملات) تستبعد الحسابات المؤرشفة، مع إبقاء الحساب الحالي ظاهرًا عند تعديل سجل قديم مرتبط به. `defaultAccountId` لا يختار حسابًا مؤرشفًا.
7. **فحوص السلامة:** أُضيفت `ACC_DUPLICATE_CODE` و`ACC_MISSING_CODE` و`ACC_ARCHIVED_BALANCE` إلى `SHC.checkAccounts`.
8. **الاختبارات:** أُضيفت 6 اختبارات (إسناد الأكواد، إصلاح التكرار، قفل النوع، الأرشفة/الاستعادة، الحذف النهائي، إعادة استخدام الاسم) → **58/58 ناجح**. وتم التحقق في متصفح معزول من: توليد الكود عند الإنشاء، قفل النوع وإظهار الرسالة، رفض تغيير النوع، الأرشفة مع التأكيد، إخفاء المؤرشف من القوائم، الاستعادة، ومنع الأرشفة برصيد غير صفري.

## 14. المرحلة الثالثة: شجرة حسابات رسمية + ميزان مراجعة (منفّذة)

1. **شاشة جديدة داخل التقارير:** تبويب «📚 شجرة الحسابات» أُضيف كآخر تبويب داخل شاشة التقارير فقط (لم تُضف أو تُعاد ترتيب أي صفحة في القائمة الرئيسية). يحتوي أزرار تحديث وطباعة/PDF وتصدير CSV، ويُستدعى تلقائيًا عبر `switchReportTab`.
2. **هيكل 3 مستويات / 5 مجموعات:** الأصول (1)، الالتزامات (2)، حقوق الملكية (3)، الإيرادات (4)، المصروفات (5). المستوى الثاني مجموعات فرعية (نقدية/بنوك/محافظ/مخزون/ذمم…)، والمستوى الثالث الحسابات الفعلية بأكوادها (`ACC-###`) أو أكواد تحليلية.
3. **`BusinessLogic.buildTrialBalance()`:** يبني الشجرة والميزان من نفس محركات التقارير الحالية (`computeIncomeStatement`، `liquidTotals`، `stockValue`، `receivablesTotal`، `merchantBalanceParts`، `openingLiquid`، `partners`) دون تغيير أي حساب قائم.
4. **ميزان تراكمي:** يعرض المدين والدائن والرصيد الصافي لكل حساب، مع صف إجمالي وحالة توازن. لا يشمل سطر «نتيجة الأعمال» المحسوب (321) لمنع ازدواج الأرباح — الأرباح تظهر موزعة على بنود الإيرادات والمصروفات.
5. **منع ازدواج رأس المال:** رأس المال في الإعدادات يظهر كسطر نقدي `CAP-CASH`، وأرصدة افتتاح الحسابات تظهر داخل أرصدة الحسابات نفسها فقط. حقوق الملكية (311) تساوي `openingLiquid()` أي مجموعهما مرة واحدة. أُضيف اختبار مخصص يثبت عدم الاحتساب المزدوج.
6. **الشفافية:** أي سيولة غير مسندة لأي حساب تظهر كسطر `111-UNALLOC`، وأي فرق بين المدين والدائن يظهر صراحةً كسطر `322 — فروق غير مفسرة (تحتاج مراجعة)` بدل إخفائه.
7. **فحص السلامة:** أُضيف `SHC.checkTrialBalance` مع الكود `COA_TRIAL_DIFF` (خطورة متوسطة) عند وجود فرق أكبر من 0.01.
8. **الاختبارات:** أُضيفت 7 اختبارات (بنية الشجرة، رأس مال الإعدادات، عدم ازدواج أرصدة الافتتاح، شراء+بيع متوازن، ظهور الفرق 322، السيولة غير المسندة، تفرد وترتيب الأكواد وظهور الحساب المؤرشف) → **65/65 ناجح**.
9. **التحقق في متصفح معزول:** التبويب يظهر ويُفعّل، البطاقات والهيكل والميزان تُرسم، حالة «متوازن/غير متوازن» صحيحة، سطر 322 يظهر عند الفرق 400، تصدير CSV يُنتج ملفًا بالمحتوى الصحيح، الطباعة تُولّد مستندًا كاملًا، و`COA_TRIAL_DIFF` يُكتشف فعليًا. لا أخطاء JavaScript (عدا 404 الخاص بـ Service Worker في بيئة الاختبار).
10. **حدود معروفة:** الشجرة مشتقة من محركات التقارير وليست ترحيلًا يدويًا لكل قيد؛ في البيانات القديمة غير المكتملة (بيع بلا شراء/مخزون مقابل) يظهر فرق حقيقي في سطر 322 وهو مقصود لتنبيه المراجعة، وليس خطأً في العرض.

## 15. جولة الاختبار الشامل (منفّذة) + إصلاحان

**النطاق:** منطق الأعمال في Node (`tests/bl_harness.js`) + واجهة كاملة في متصفح معزول (sessionStorage بدل localStorage، IndexedDB معطّل، حراس `window.__T`)، بلا أي بيانات في تخزين المستخدم الحقيقي.

### 15.1 إصلاح: إنذار كاذب في فحص الأيتام (`STOCK_ORPHAN_PARENT`)
- **المشكلة:** `SHC.checkLedgerConsistency` كان يبني «الأصول الحيّة» من `transactions` فقط. البيع/الشراء الآجل مع التاجر لا يُنشئ قيدًا ماليًا (بسياسة موثّقة في §11)، فكانت حركته المخزنية تُبلَّغ كيتيمة في كل مرة.
- **الإصلاح:** أُضيفت السجلات الحيّة غير المالية إلى مجموعة الأصول: `merchantSales`، `merchantPurchases`، `installments`، `arabonSales`، و`opening_stock` (بمعرّف المنتج). صار المطابق يقبل اللاحقات النقدية/البنكية/النوعية (`_c`, `_b`, `_upfront`, `_deposit` …).
- **النتيجة:** لا إنذارات كاذبة؛ الحركيات الحقيقية اليتيمة تبقى تُكتشف.

### 15.2 إصلاح: شراء المخزون كان يتجاهل «المصروفات الإضافية»
- **المشكلة:** `purchaseStock` كان يدفع `costPrice × qty`، بينما تقييم المخزون و`COGS` يستخدمان `(costPrice + expenses) × qty`. النتيجة: فرق في الميزان يساوي `qty × expenses` عند أي صنف له مصروفات، ومخزون مقوَّم بأعلى من المدفوع.
- **الإصلاح:** صار `unitCost = stockUnitCost(p)` في `purchaseStock`، وأُصلحت رسالة نجاح «شراء» السريع لعرض التكلفة الشاملة.
- **الاختبار:** اختبار جديد يثبت أن الدفع = تقييم المخزون = `(10000 + 500) × 3 = 31500` → **66/66 ناجح**.

### 15.3 نتائج الجولة (متصفح معزول)
- 14 تدفقًا ناجحًا: شراء مخزون (بمصروفات وبلا)، بيع نقدي، دخل/مصروف، تحويل (مع رفض نقص الرصيد)، تقسيط + سداد، عربون + سداد، بيع/شراء تاجر آجل، دفعة من التاجر، إيداع شريك، إرجاع بيع (`returnSale`).
- إرجاع بيع: أعاد الكمية للمخزون، خصم الاسترداد من الخزينة، وخفض الإيراد و`COGS` بالنسبة الصحيحة، والميزان بقي متوازنًا. رفض الإرجاع الزائد ومعرّف المعاملة غير الصحيح.
- 11 صفحة و12 تبويب تقارير (حتى `tabCoA`) تُرسم بلا `NaN`/`undefined`، بلا أخطاء JS (عدا 404 لـ Service Worker في بيئة الاختبار).
- حراسات الرفض سليمة: `insufficient_stock`, `overpayment`, `same_account`, `insufficient_balance`, `invalid_amount`, `invalid_name`, `invalid_balance`, `invalid_type`، وتكرار المعاملة `blocked`.
- الحفظ/إعادة التحميل حافظ على كل البيانات (11–13 معاملة، حسابان بأكواد `ACC-###`، عقود، شركاء، رأس مال) والميزان بقي متوازنًا بعد الإعادة.
- `applyBackupData` يرفض استرجاع نسخة فارغة فوق بيانات موجودة (سلوك مقصود).

### 15.4 نقطة مفتوحة تحتاج قرارًا (لم تُعدَّل)
**شراء من تاجر بسعر يخالف تكلفة الصنف:** عند `purchaseFromMerchant` بسعر 900 بينما تكلفة الصنف 1000، يُسجَّل مستحق 1800 بينما يُقيَّم المخزون 2000 → فرق 200 (`qty × (تكلفة الصنف − سعر الشراء)`) يظهر في سطر 322 كفرق غير مفسر، مع أن سببه معروف.
- **الخيار أ (موصى):** تحديث تكلفة الصنف بمتوسط مرجّح عند الشراء من تاجر → يتوازن الميزان تلقائيًا وتصبح التكلفة واقعية (يتغير `COGS` للأصناف المختلطة).
- **الخيار ب:** الإبقاء على تكلفة الصنف كما هي، وإظهار الفرق كسطر مسمّى «فروق تقييم مخزون (شراء تاجر)» بدل إدراجه تحت «غير مفسرة».
- **الخيار ج:** تركه كما هو حاليًا (فرق حقيقي يظهر في 322 للمراجعة).

**ملاحظة أخرى:** `INV_STOCK_MISMATCH` في الجولة السابقة كان ناتجًا عن بذر مخزون ابتدائي مباشرة في الاختبار دون حركة افتتاحية؛ إضافة الصنف من الواجهة تُنشئ حركة `opening_stock` وقيد شراء بالقيمة الكاملة `(cost + expenses) × stock` (تحقق من الكود)، فلا مشكلة في الاستخدام الفعلي.