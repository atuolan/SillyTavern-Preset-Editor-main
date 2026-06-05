# IDE风格批量替换脚本
# 读取App.vue文件
$content = Get-Content "src/App.vue" -Raw

# 移除所有圆角样式
$content = $content -replace '\srounded-xl\b', ''
$content = $content -replace '\srounded-lg\b', ''
$content = $content -replace '\srounded-md\b', ''
$content = $content -replace '\srounded-full\b', ''
$content = $content -replace '\srounded\b', ''

# 移除所有阴影效果
$content = $content -replace '\sshadow-sm\b', ''
$content = $content -replace '\sshadow-lg\b', ''
$content = $content -replace '\sshadow-2xl\b', ''
$content = $content -replace '\sshadow-md\b', ''
$content = $content -replace '\sshadow-inner\b', ''
$content = $content -replace '\sshadow-\[inset_0_-2px_0_0_var\(--brand\)\]', ''
$content = $content -replace '\sshadow-\[0_0_12px_rgba\(176,86,45,0\.08\)\]', ''
$content = $content -replace '\sshadow-\[0_0_6px_2px_rgba\(176,86,45,0\.5\)\]', ''

# 移除玻璃态效果
$content = $content -replace '\sbackdrop-blur-sm\b', ''
$content = $content -replace '\sbackdrop-blur-md\b', ''
$content = $content -replace '\sbackdrop-blur\b', ''

# 移除hover阴影效果
$content = $content -replace '\shover:shadow-lg\b', ''
$content = $content -replace '\shover:shadow-brand/20\b', ''
$content = $content -replace '\sshadow-brand/20\b', ''

# 移除缩放效果
$content = $content -replace '\shover:scale-\[1\.02\]', ''
$content = $content -replace '\sactive:scale-\[0\.98\]', ''

# 移除多余的scale-up动画和边框调整
$content = $content -replace 'animate-\[scale-up_0\.2s_ease-out\]', ''
$content = $content -replace 'animate-\[scale-up_0\.15s_ease-out\]', ''

# 清理多余空格
$content = $content -replace '\s{2,}', ' '
$content = $content -replace '\s+"', '"'

# 保存文件
$content | Set-Content "src/App.vue" -NoNewline

Write-Host "IDE风格应用完成！" -ForegroundColor Green
Write-Host "已移除：圆角、阴影、玻璃态效果、缩放动画" -ForegroundColor Cyan
