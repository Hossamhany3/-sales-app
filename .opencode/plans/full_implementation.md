# خطة تنفيذ التعديلات الشاملة - نظام إدارة المبيعات

## الملف المستهدف: `app_fixed.html` (2855 سطراً)

---

## المرحلة 1: إصلاح الأخطاء الحرجة

### 1.1 إصلاح دالة `renderTransactions()` — السطر 1739

**قبل:**
```
     {
        const container = document.getElementById('transactionsLog');
```

**بعد:**
```
    window.renderTransactions = function() {
        const container = document.getElementById('transactionsLog');
```

**السبب:** الدالة كانت تبدأ بـ `{` بدون `function` أو `window.renderTransactions = function() {` مما يجعل استدعاءات `renderTransactions()` في أماكن أخرى (السطور 477, 1646, 1731, 2379, 2671, 2727, 2850) تسبب خطأ.

---

### 1.2 إزالة الأقواس الزائدة `);` — السطر 1627

**قبل:**
```
        } catch (err) {
            showError('حدث خطأ أثناء الحذف', err.message);
        }
    };

   );
```

**بعد:**
```
        } catch (err) {
            showError('حدث خطأ أثناء الحذف', err.message);
        }
    };


```

**السبب:** السطر `);` منفرد بدون دالة أو جملة تخصه — بقايا نسخ/لصق.

---

### 1.3 إضافة كلاسات CSS المفقودة — قبل إغلاق `</style>` (السطر 311)

**أضف قبل السطر 311 (`</style>`):**

```css
.storage-bar {
    background: #e2e8f0;
    border-radius: 50px;
    height: 8px;
    overflow: hidden;
    margin: 6px 0;
}
.storage-bar-fill {
    height: 100%;
    border-radius: 50px;
    transition: width 0.5s;
}
.storage-bar-fill.safe { background: var(--success); }
.storage-bar-fill.warn { background: var(--accent); }
.storage-bar-fill.danger { background: var(--danger); }

@keyframes spin {
    to { transform: rotate(360deg); }
}
```

---

## المرحلة 2: ميزات جديدة

### 2.1 إضافة شاشة تسجيل المصروفات — داخل `div#transactions` (بعد السطر 471)

**أضف بعد السطر 471 (بعد إغلاق `</p>` مباشرة):**

```html
<div class="card" id="expenseFormCard">
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; cursor:pointer;" onclick="toggleExpenseForm()">
        <span style="font-size:1.3rem;">📉</span>
        <strong style="flex:1;">تسجيل مصروف جديد</strong>
        <span id="expenseToggleIcon" style="color:var(--text-muted);">▼</span>
    </div>
    <form id="expenseForm" style="display:none;">
        <div class="grid-2">
            <div class="form-group">
                <label>اسم المصروف</label>
                <input type="text" id="expenseName" required placeholder="مثال: إيجار المحل - فاتورة كهرباء">
            </div>
            <div class="form-group">
                <label>المبلغ (ج.م)</label>
                <input type="number" id="expenseAmount" step="any" required placeholder="0.00">
            </div>
        </div>
        <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" id="expenseNotes" placeholder="اختياري">
        </div>
        <button type="submit">➕ تسجيل المصروف</button>
    </form>
</div>
```

**أضف JavaScript قبل دالة `renderTransactions()` (عند السطر 1738):**

```javascript
window.toggleExpenseForm = function() {
    const form = document.getElementById('expenseForm');
    const icon = document.getElementById('expenseToggleIcon');
    if (!form) return;
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    icon.textContent = isHidden ? '▲' : '▼';
};

document.getElementById('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
        let name = document.getElementById('expenseName').value.trim();
        let amount = parseFloat(document.getElementById('expenseAmount').value);
        let notes = document.getElementById('expenseNotes').value.trim();
        if (!name) { showToast('أدخل اسم المصروف', 'error'); return; }
        if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'error'); return; }
        transactions.push({
            id: Date.now(), type: 'expense', amount: amount,
            notes: name + (notes ? ' - ' + notes : ''),
            date: new Date().toISOString()
        });
        document.getElementById('expenseForm').reset();
        document.getElementById('expenseForm').style.display = 'none';
        document.getElementById('expenseToggleIcon').textContent = '▼';
        saveData(); renderTransactions(); renderDashboard();
        showToast('📉 تم تسجيل مصروف: ' + name + ' — ' + amount.toFixed(2) + ' ج');
    } catch (err) {
        showError('حدث خطأ', err.message);
    }
});
```

---

### 2.2 إضافة تعديل/حذف مبيعات التجار

**أ. أضف دالة `deleteMerchantSale(id)` قبل دالة `renderMerchantSales()` (قبل السطر 2250):**

```javascript
window.deleteMerchantSale = (id) => {
    try {
        let sale = merchantSales.find(s => s.id == id);
        if (!sale) { showToast('البيع غير موجود', 'error'); return; }
        if (!confirm('⚠️ حذف بيع "' + (sale.deviceName || '') + '" لـ ' + (sale.merchantName || '') + ' بقيمة ' + (sale.sellPrice || 0).toFixed(2) + ' ج؟')) return;
        merchantSales = merchantSales.filter(s => s.id != id);
        saveData(); renderMerchantSales(); renderDashboard();
        showToast('تم حذف بيع ' + (sale.deviceName || ''));
    } catch (err) {
        showError('حدث خطأ', err.message);
    }
};
```

**ب. أضف دالة `editMerchantSale(id)` قبل `renderMerchantSales()`:**

```javascript
window.editMerchantSale = (id) => {
    try {
        let sale = merchantSales.find(s => s.id == id);
        if (!sale) { showToast('البيع غير موجود', 'error'); return; }
        let newPrice = prompt('تعديل سعر بيع ' + (sale.deviceName || '') + '\nالسعر الحالي: ' + (sale.sellPrice || 0).toFixed(2) + ' ج', sale.sellPrice);
        if (newPrice === null) return;
        let price = parseFloat(newPrice);
        if (isNaN(price) || price <= 0) { showToast('سعر غير صالح', 'error'); return; }
        sale.sellPrice = price;
        saveData(); renderMerchantSales(); renderDashboard();
        showToast('✅ تم تحديث سعر البيع');
    } catch (err) {
        showError('حدث خطأ', err.message);
    }
};
```

**ج. عدّل دالة `renderMerchantSales()` — أضف أزرار التعديل/الحذف لكل تاجر:**
في السطر 2284، بعد زر WhatsApp، أضف:
```
html += '<button class="btn-sm" style="background:var(--primary-light);color:var(--primary);border:1px solid var(--border);padding:6px 8px;min-height:32px;font-size:0.85rem;" onclick="editMerchantSale(\'' + id + '\')">✏️</button>';
html += '<button class="btn-sm" style="background:var(--danger-light);color:var(--danger);border:1px solid var(--border);padding:6px 8px;min-height:32px;font-size:0.85rem;" onclick="deleteMerchantSale(\'' + id + '\')">🗑️</button>';
```

---

### 2.3 إضافة تعديل/حذف عقود التقسيط

**أ. أضف دالة `deleteInstallment(id)` قبل `renderInstallments()` (قبل السطر 1948):**

```javascript
window.deleteInstallment = (id) => {
    try {
        let inst = installments.find(i => i.id == id);
        if (!inst) { showToast('العقد غير موجود', 'error'); return; }
        let m = merchants.find(x => x.id == inst.merchantId);
        if (!confirm('⚠️ حذف عقد تقسيط #' + id + '\nالعميل: ' + (m?.name || '') + '\nالجهاز: ' + (inst.deviceName || '') + '\nالمتبقي: ' + (inst.remainingBalance || 0).toFixed(2) + ' ج\n\nسيتم إعادة المخزون.')) return;
        // إعادة المخزون
        let p = products.find(x => x.id == inst.productId);
        if (p) { p.stock = (p.stock || 0) + 1; }
        // حذف الحركات المرتبطة بهذا العقد
        transactions = transactions.filter(t => !(t.notes || '').includes('#' + id));
        installments = installments.filter(i => i.id != id);
        saveData(); renderInstallments(); renderTransactions(); renderProducts(); renderDashboard(); refreshSelectors();
        showToast('✅ تم حذف العقد #' + id);
    } catch (err) {
        showError('حدث خطأ', err.message);
    }
};
```

**ب. في دالة `renderInstallments()` — أضف زر حذف في بطاقة العقد:**
في السطر 2035، بعد زر "إعادة جدولة"، أضف:
```
'<button class="btn-sm" style="background:var(--danger-light);color:var(--danger);border:1px solid var(--border);" onclick="deleteInstallment(' + inst.id + ')">🗑️ حذف</button>' +
```

---

### 2.4 إضافة حذف الحركات المالية

**أ. أضف دالة `deleteTransaction(id)` قبل `renderTransactions()` (قبل السطر 1739):**

```javascript
window.deleteTransaction = (id) => {
    try {
        let t = transactions.find(x => x.id == id);
        if (!t) { showToast('الحركة غير موجودة', 'error'); return; }
        // منع حذف الحركات المرتبطة بعقود تقسيط نشطة
        let isLinked = installments.some(i => !i.isPaid && i.merchantId == t.merchantId &&
            t.notes && (t.notes.includes('قسط') || t.notes.includes('مقدم')));
        if (isLinked) { showToast('لا يمكن حذف حركة مرتبطة بعقد تقسيط نشط', 'error'); return; }
        if (!confirm('⚠️ حذف حركة "' + (t.notes || t.type || '') + '" بقيمة ' + (t.amount || 0).toFixed(2) + ' ج؟')) return;
        transactions = transactions.filter(x => x.id != id);
        saveData(); renderTransactions(); renderDashboard();
        showToast('تم حذف الحركة');
    } catch (err) {
        showError('حدث خطأ', err.message);
    }
};
```

**ب. في دالة `renderTransactions()` — أضف زر 🗑️ داخل حلقة عرض الحركات:**
في السطر 1814 (بعد `sign + t.amount.toFixed(0) + ' ج</strong>' +` وقبل `'</div>'` مباشرة)، أضف:
```
'<button class="btn-sm" style="background:none;color:var(--danger);padding:4px 6px;min-height:30px;font-size:0.9rem;border:none;box-shadow:none;" onclick="deleteTransaction(' + t.id + ')" title="حذف">🗑️</button>' +
```

---

## المرحلة 3: تحسينات واجهة المستخدم

### 3.1 إضافة مؤشر تحميل (Loading Spinner) — قبل إغلاق `</body>` (السطر 2853)

**أضف HTML قبل السطر 2853 (`</body>`):**

```html
<div id="loadingSpinner" style="display:none; position:fixed; inset:0; z-index:9998; background:rgba(15,23,42,0.5); backdrop-filter:blur(2px); align-items:center; justify-content:center;">
    <div style="background:white; border-radius:20px; padding:32px 40px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="width:40px; height:40px; border:4px solid var(--border); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-weight:600; color:var(--text-main);">جاري التحميل...</div>
    </div>
</div>
```

**أضف JavaScript في أي مكان داخل `<script>`:**

```javascript
window.showLoading = function() {
    let el = document.getElementById('loadingSpinner');
    if (el) el.style.display = 'flex';
};
window.hideLoading = function() {
    let el = document.getElementById('loadingSpinner');
    if (el) el.style.display = 'none';
};
```

**استخدم `showLoading()` و `hideLoading()` في:**
- دالة تصدير النسخة الاحتياطية (حول السطر 2676)
- دالة استيراد النسخة (حول السطر 2701)
- دالة إعادة تعيين البيانات (حول السطر 2661)
- دالة طباعة PDF (حول السطر 2516)

---

### 3.2 تحسين الرسم البياني للشاشات الصغيرة — في `drawChart()` (السطر 1147)

**عدّل السطر 1184:**
```javascript
// قبل:
const barW = Math.min(chartW / months.length / 3, 16);
// بعد:
const barW = Math.min(chartW / months.length / 3, Math.max(6, Math.min(16, (w - 80) / months.length / 3)));
```

**أضف تحسين التسميات:**
بعد السطر 1214 (`ctx.fillText(m.label, x, h - 6);`)، أضف:
```javascript
if (w < 400 && i % 2 === 0 && months.length > 3) {
    ctx.fillText(m.label, x, h - 6);
}
```

---

### 3.3 نافذة تأكيد مخصصة بدلاً من confirm()

**أضف HTML قبل إغلاق `</body>`:**

```html
<div id="confirmModal" class="receipt-overlay" style="z-index:9999;">
    <div class="receipt-box" style="max-width:400px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:12px;" id="confirmIcon">⚠️</div>
        <h3 style="margin-bottom:8px;" id="confirmTitle">تأكيد</h3>
        <p style="color:var(--text-muted); margin-bottom:20px; line-height:1.8; white-space:pre-wrap;" id="confirmMessage"></p>
        <div style="display:flex; gap:8px;">
            <button id="confirmYesBtn" class="btn-success" style="flex:1; background:var(--success);">✅ تأكيد</button>
            <button id="confirmNoBtn" class="btn-outline" style="flex:1;">✖ إلغاء</button>
        </div>
    </div>
</div>
```

**أضف JavaScript:**

```javascript
window.showConfirm = function(message, icon, title) {
    return new Promise((resolve) => {
        document.getElementById('confirmIcon').textContent = icon || '⚠️';
        document.getElementById('confirmTitle').textContent = title || 'تأكيد';
        document.getElementById('confirmMessage').textContent = message || '';
        document.getElementById('confirmModal').classList.add('show');
        document.getElementById('confirmYesBtn').onclick = function() {
            document.getElementById('confirmModal').classList.remove('show');
            resolve(true);
        };
        document.getElementById('confirmNoBtn').onclick = function() {
            document.getElementById('confirmModal').classList.remove('show');
            resolve(false);
        };
    });
};
```

**ثم استبدل جميع استخدامات `confirm()` بـ `await showConfirm()`:**

مثال - دالة `deleteProduct`:
```javascript
// قبل:
if (confirm('تأكيد حذف الصنف؟')) {
// بعد:
if (await showConfirm('هل أنت متأكد من حذف "' + p.name + '"؟', '⚠️', 'تأكيد حذف الصنف')) {
```

ملاحظة: الدوال التي تستخدم `confirm()` حالياً وتحتاج للتعديل:
1. `deleteProduct()` (السطر 1617)
2. `removePassword()` (السطر 1088)
3. `deleteTransaction()` (جديدة — 2.4)
4. `deleteInstallment()` (جديدة — 2.3)
5. `deleteMerchantSale()` (جديدة — 2.2)
6. `resetAllBtn` (السطر 2661) — مرتين
7. `backupImportBtn` (السطر 2697)

**هام:** عندما تستخدم `await` داخل دالة، يجب أن تكون الدالة `async`:
```javascript
// قبل:
window.deleteProduct = (id) => {
// بعد:
window.deleteProduct = async (id) => {
```

---

### 3.4 إضافة رسم بياني دائري (Doughnut Chart)

**أضف HTML بعد الرسم البياني الحالي (بعد السطر 392):**

```html
<div class="chart-container" style="margin-top:16px;">
    <canvas id="doughnutCanvas" height="200"></canvas>
    <div class="chart-legend" id="doughnutLegend"></div>
</div>
```

**أضف دالة JavaScript لرسم Doughnut Chart:**

```javascript
function drawDoughnutChart() {
    const canvas = document.getElementById('doughnutCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '200px';
    ctx.scale(dpr, dpr);
    
    const w = rect.width;
    const h = 200;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 40;
    const innerRadius = radius * 0.55;
    
    // حساب البيانات
    const fin = getFinancials();
    const data = [
        { label: 'الإيرادات', value: fin.revenue, color: '#10b981' },
        { label: 'المصروفات', value: fin.expenses, color: '#ef4444' },
        { label: 'المخزون', value: fin.stockValue, color: '#4f46e5' },
        { label: 'المديونيات', value: fin.totalDebt, color: '#f59e0b' }
    ];
    
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    ctx.clearRect(0, 0, w, h);
    
    let startAngle = -Math.PI / 2;
    data.forEach(d => {
        const sliceAngle = (d.value / total) * Math.PI * 2;
        ctx.beginPath();
        // الحلقة الخارجية
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // النسبة المئوية
        if (d.value > 0) {
            const midAngle = startAngle + sliceAngle / 2;
            const labelR = (radius + innerRadius) / 2;
            const lx = cx + Math.cos(midAngle) * labelR;
            const ly = cy + Math.sin(midAngle) * labelR;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Cairo, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round((d.value / total) * 100) + '%', lx, ly);
        }
        startAngle += sliceAngle;
    });
    
    // النصوص
    const legendEl = document.getElementById('doughnutLegend');
    if (legendEl) {
        legendEl.innerHTML = data.map(d =>
            '<span><span class="dot" style="background:' + d.color + '"></span> ' + d.label + ': ' + d.value.toFixed(0) + ' ج</span>'
        ).join('');
    }
}
```

**أضف استدعاء `drawDoughnutChart()` في `renderDashboard()` بجانب `drawChart()` (السطر 1475):**
```javascript
// بعد:
setTimeout(() => drawChart(), 100);
// أضف:
setTimeout(() => drawDoughnutChart(), 200);
```

---

## المرحلة 4: تحسينات إضافية

### 4.1 استخدام html2pdf.js بدلاً من window.print()

**عدّل دالة `sendPlanAsPDF()` (السطر 2516) لاستخدام المكتبة المحملة:**

```javascript
window.sendPlanAsPDF = (id) => {
    try {
        showLoading();
        let inst = installments.find(i => i.id == id);
        if (!inst) { hideLoading(); showToast('العقد غير موجود', 'error'); return; }
        let htmlContent = generateFullInstallmentPDF(inst);
        
        // إنشاء عنصر مؤقت
        let el = document.createElement('div');
        el.innerHTML = htmlContent;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '0';
        document.body.appendChild(el);
        
        html2pdf().from(el).set({
            margin: [10, 10, 10, 10],
            filename: 'عقد_تقسيط_' + (merchants.find(m => m.id == inst.merchantId)?.name || 'عميل') + '_' + Date.now() + '.pdf',
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).save().then(() => {
            document.body.removeChild(el);
            hideLoading();
            showToast('✅ تم حفظ ملف PDF');
        }).catch(() => {
            document.body.removeChild(el);
            hideLoading();
            showToast('فشل إنشاء PDF — استخدم الطباعة بدلاً من ذلك', 'error');
            // Fallback: فتح نافذة الطباعة
            let printWindow = window.open('', '_blank', 'width=900,height=700');
            if (printWindow) {
                let name = merchants.find(m => m.id == inst.merchantId)?.name || 'عميل';
                printWindow.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>عقد تقسيط - ' + name + '</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:sans-serif;padding:20px;}@media print{@page{margin:1cm;size:A4}}.no-print{display:none!important}</style></head><body>' + htmlContent + '<div class="no-print" style="position:fixed;top:10px;left:10px;"><button onclick="window.print()" style="padding:10px 20px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ طباعة</button></div></body></html>');
                printWindow.document.close();
            }
        });
    } catch (err) {
        hideLoading();
        showError('حدث خطأ', err.message);
    }
};
```

**عدّل دالة `generateMerchantStatementPDF()` بالمثل (السطر 2387).**

---

### 4.2 تحسين CSS للجداول والعناصر

**أضف داخل CSS (قبل `</style>`):**

```css
.merchant-statement-table,
.merchant-statement-table tbody,
.merchant-statement-table thead {
    width: 100%;
    overflow-x: auto;
    display: block;
}
.merchant-statement-table th,
.merchant-statement-table td {
    white-space: nowrap;
    padding: 8px 10px;
}
@media (max-width: 640px) {
    .merchant-statement-table th,
    .merchant-statement-table td {
        padding: 6px 8px;
        font-size: 0.82rem;
    }
}
```

---

## ملخص جميع التعديلات

| # | التعديل | النوع | الموقع التقريبي |
|---|---------|-------|-----------------|
| 1.1 | إصلاح `renderTransactions()` | 🐛 خطأ | السطر 1739 |
| 1.2 | إزالة `);` الزائدة | 🐛 خطأ | السطر 1627 |
| 1.3 | إضافة CSS مفقود | 🐛 خطأ | السطر 311 |
| 2.1 | شاشة تسجيل المصروفات | ✨ ميزة | السطر 471 + السطر 1738 |
| 2.2 | حذف/تعديل مبيعات التجار | ✨ ميزة | السطر 2250 |
| 2.3 | حذف عقود التقسيط | ✨ ميزة | السطر 1948 |
| 2.4 | حذف الحركات المالية | ✨ ميزة | السطر 1739 |
| 3.1 | مؤشر تحميل (Loading) | 🎨 تحسين | السطر 2853 |
| 3.2 | تحسين الرسم البياني | 🎨 تحسين | السطر 1184 |
| 3.3 | نافذة تأكيد مخصصة | 🎨 تحسين | السطر 2853 |
| 3.4 | رسم بياني دائري (Doughnut) | 🎨 تحسين | السطر 392 |
| 4.1 | استخدام html2pdf | 🔧 تحسين | السطر 2516 |
| 4.2 | تحسين CSS للجداول | 🔧 تحسين | السطر 311 |

---

## تعليمات التنفيذ

1. افتح الملف `app_fixed.html` في أي محرر نصوص (VS Code، Notepad++، أو حتى Notepad)
2. ابحث عن كل موقع باستخدام Ctrl+F
3. طبق التغييرات "قبل ← بعد" كما هو موضح أعلاه
4. احفظ الملف
5. اختبر التطبيق بتشغيل `app_server.bat` أو فتح الملف في المتصفح
