# تشغيل خادم HTTP مباشر من PowerShell (بدون Python أو Node)
$port = 8080
$root = $PSScriptRoot

# إظهار عنوان IP المحلي
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike '*Loopback*' -and
    $_.PrefixOrigin -eq 'Dhcp'
} | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = '127.0.0.1' }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  📦 نظام إدارة المبيعات والتقسيط" -ForegroundColor Green
Write-Host "  الخادم شغال!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   💻  من الكمبيوتر:" -ForegroundColor White
Write-Host "       http://localhost:$port/app_fixed.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "   📱  من هاتفك Android (نفس الواي فاي):" -ForegroundColor White
Write-Host "       http://$($ip):$port/app_fixed.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "   🔒  بعد الفتح من الموبايل:" -ForegroundColor White
Write-Host "       Chrome ← اضغط ⋮ ← إضافة إلى الشاشة الرئيسية" -ForegroundColor Gray
Write-Host ""
Write-Host "   ⚠️  لو ما اشتغلش:" -ForegroundColor White
Write-Host "       عطل Windows Firewall مؤقتاً أو اسمح للمنفذ 8080" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "اضغط Ctrl+C لإيقاف الخادم" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# إنشاء خادم HTTP
# محاولة الإصغاء على جميع الواجهات (يحتاج صلاحية المسؤول)
try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://*:$port/")
    $listener.Start()
} catch {
    Write-Host "⚠️  الخادم كمسؤول, أحاول على localhost ..." -ForegroundColor Yellow
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        Write-Host "✅  اشتغل على localhost فقط" -ForegroundColor Yellow
        Write-Host "⚠️  شغل PowerShell كـ Administrator عشان الموبايل يوصل" -ForegroundColor Yellow
    } catch {
        Write-Host "❌  فشل تشغيل الخادم: $_" -ForegroundColor Red
        exit 1
    }
}

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # تحديد المسار
        $path = $request.Url.AbsolutePath.TrimStart('/')
        if ($path -eq '') { $path = 'app_fixed.html' }
        
        # منع التخزين المؤقت للملفات الرئيسية
        if ($path -eq 'app_fixed.html' -or $path -eq 'service-worker.js' -or $path -eq 'manifest.json') {
            $response.Headers.Add('Cache-Control', 'no-cache, no-store, must-revalidate')
            $response.Headers.Add('Pragma', 'no-cache')
            $response.Headers.Add('Expires', '0')
        }

        $fullPath = Join-Path $root $path

        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }

            $response.ContentType = $contentType
            $response.StatusCode = 200
            $buffer = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $path غير موجود")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        
        $response.Close()
    } catch {
        Write-Host "⚠️ خطأ في الطلب: $($_.Exception.Message)" -ForegroundColor DarkYellow
        try { $response.Close() } catch {}
    }
}

$listener.Stop()
