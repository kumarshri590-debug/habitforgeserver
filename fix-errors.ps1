# PowerShell script to fix all remaining 'catch (error: any)' occurrences

$files = @(
    "app\api\habits\[id]\route.ts",
    "app\api\habits\[id]\track\route.ts",
    "app\api\habits\[id]\stats\route.ts",
    "app\api\habits\create\route.ts",
    "app\api\habits\list\route.ts",
    "app\api\ai\adjust\route.ts",
    "app\api\ai\adjust-difficulty\route.ts",
    "app\api\ai\generate-plan\route.ts",
    "app\api\ai\generate-reminder\route.ts",
    "app\api\ai\generate-fallback\route.ts",
    "app\api\tracking\complete\route.ts",
    "app\api\tracking\history\[habitId]\route.ts",
    "app\api\sync\pull\route.ts",
    "app\api\sync\push\route.ts"
)

$rootPath = "e:\Gemini\Mobile Apps\habitforge_native\habitforge-backend"

foreach ($file in $files) {
    $fullPath = Join-Path $rootPath $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        
        # Replace 'catch (error: any)' with 'catch (error: unknown)'
        $content = $content -replace 'catch \(error: any\)', 'catch (error: unknown)'
        
        # Replace 'error.message ||' patterns with proper error handling
        $content = $content -replace 'return errorResponse\(error\.message \|\| ([^,]+), (\d+)\);', 
            "const message = error instanceof Error ? error.message : $1;`r`n        return errorResponse(message, $2);"
        
        Set-Content $fullPath $content -NoNewline
        Write-Host "Fixed: $file" -ForegroundColor Green
    } else {
        Write-Host "Not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nAll files processed!" -ForegroundColor Cyan
