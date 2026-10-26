# =====================================================================
# IndusMind Studio - local startup script (Windows / PowerShell)
# Starts: middleware (MySQL/PG check + Redis/MinIO/Neo4j) -> backends -> AI -> frontends
# Usage:
#   powershell -ExecutionPolicy Bypass -File start-local.ps1
#   powershell -ExecutionPolicy Bypass -File start-local.ps1 -Only backend,ai
# Notes:
#   - Idempotent: a service whose port is already listening is skipped.
#   - MySQL / PostgreSQL run as Windows services and need administrator rights only
#     when they are NOT already running; the script will just report their state.
# =====================================================================
param(
    [string[]]$Only = @()   # e.g. -Only redis,minio,neo4j,backend,ai,frontend
)

$ErrorActionPreference = 'Continue'

# --- Paths ------------------------------------------------------------
$DeployDir = $PSScriptRoot
$CodeDir   = Split-Path -Parent $DeployDir
$BackendDir = Join-Path $CodeDir 'backend'
$AiDir      = Join-Path $CodeDir 'ai-service'
$WebDir     = Join-Path $CodeDir 'frontend\apps'

$RedisHome  = 'D:\Redis\Redis-x64-3.2.100'
$MinioHome  = 'D:\MinIO'
$Neo4jHome  = 'E:\neo4j-community-5.26.0'
$Java       = 'D:\jdk17\bin\java.exe'
$Python     = 'C:\Users\LENOVO\AppData\Local\Programs\Python\Python310\python.exe'
$Node       = 'node'

# PowerShell 5.1 throws ArgumentException in Start-Process when both
# HTTPS_PROXY and https_proxy exist in the process environment.
foreach ($n in 'https_proxy','http_proxy','all_proxy') {
    [System.Environment]::SetEnvironmentVariable($n, $null, 'Process')
}

function Test-Port([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
}

function Want([string]$Name) {
    if ($Only.Count -eq 0) { return $true }
    return $Only -contains $Name
}

function Start-Svc {
    param(
        [string]$Label,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkDir,
        [int]$Port
    )
    if ($Port -gt 0 -and (Test-Port $Port)) {
        Write-Host ("  [skip] {0} already listening on {1}" -f $Label, $Port) -ForegroundColor DarkGray
        return
    }
    $outLog = Join-Path $WorkDir ("run-{0}.out.log" -f ($Label -replace '[^\w]','_'))
    $errLog = Join-Path $WorkDir ("run-{0}.err.log" -f ($Label -replace '[^\w]','_'))
    $argList = $Arguments
    if ($null -eq $argList) { $argList = @() }
    Start-Process -FilePath $FilePath -ArgumentList $argList -WorkingDirectory $WorkDir `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden | Out-Null
    Write-Host ("  [start] {0}" -f $Label) -ForegroundColor Green
}

Write-Host '=== IndusMind Studio local startup ===' -ForegroundColor Cyan

# --- Middleware -------------------------------------------------------
if (Want 'middleware') {
    Write-Host '[middleware]'
    foreach ($svc in 'MySQL','postgresql-x64-16') {
        $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($null -eq $s) { Write-Host ("  [miss ] service {0} not installed" -f $svc) -ForegroundColor Yellow; continue }
        if ($s.Status -eq 'Running') {
            Write-Host ("  [ok   ] {0} is running" -f $svc) -ForegroundColor DarkGray
        } else {
            Write-Host ("  [warn ] {0} state={1}; start it as administrator: net start {0}" -f $svc, $s.Status) -ForegroundColor Yellow
        }
    }
    # MySQL80 duplicates the MySQL instance (same my.ini) and may be stuck in StartPending.
    $dup = Get-Service -Name 'MySQL80' -ErrorAction SilentlyContinue
    if ($dup -and $dup.Status -ne 'Stopped') {
        Write-Host ("  [warn ] MySQL80 state={0} (duplicate instance, disable as administrator: sc config MySQL80 start= disabled)" -f $dup.Status) -ForegroundColor Yellow
    }

    Start-Svc -Label 'redis' -FilePath (Join-Path $RedisHome 'redis-server.exe') -Arguments @() -WorkDir $RedisHome -Port 6379
    Start-Svc -Label 'minio' -FilePath (Join-Path $MinioHome 'bin\minio.exe') `
        -Arguments @('server','data','--address',':9000','--console-address',':9990') -WorkDir $MinioHome -Port 9000

    if (-not (Test-Port 7687)) {
        $cp = "$Neo4jHome\plugins\*;$Neo4jHome\conf\*;$Neo4jHome\lib\*"
        $neoArgs = @(
            '-cp', $cp,
            '-XX:+UseG1GC','-XX:-OmitStackTraceInFastThrow','-XX:+AlwaysPreTouch',
            '-XX:+UnlockExperimentalVMOptions','-XX:+TrustFinalNonStaticFields','-XX:+DisableExplicitGC',
            '-Djdk.nio.maxCachedBufferSize=1024','-Dio.netty.tryReflectionSetAccessible=true',
            '-Djdk.tls.ephemeralDHKeySize=2048','-Djdk.tls.rejectClientInitiatedRenegotiation=true',
            '-XX:FlightRecorderOptions=stackdepth=256','-XX:+UnlockDiagnosticVMOptions','-XX:+DebugNonSafepoints',
            '--add-opens=java.base/java.nio=ALL-UNNAMED','--add-opens=java.base/java.io=ALL-UNNAMED',
            '--add-opens=java.base/sun.nio.ch=ALL-UNNAMED','--enable-native-access=ALL-UNNAMED',
            '-Dlog4j2.disable.jmx=true','-Dlog4j.layout.jsonTemplate.maxStringLength=32768',
            '-Dfile.encoding=UTF-8','org.neo4j.server.CommunityEntryPoint',
            "--home-dir=$Neo4jHome","--config-dir=$Neo4jHome\conf",'--console-mode'
        )
        Start-Process -FilePath $Java -ArgumentList $neoArgs -WorkingDirectory $Neo4jHome `
            -RedirectStandardOutput (Join-Path $Neo4jHome 'logs\run-neo4j.out.log') `
            -RedirectStandardError  (Join-Path $Neo4jHome 'logs\run-neo4j.err.log') -WindowStyle Hidden | Out-Null
        Write-Host '  [start] neo4j (takes ~15s)' -ForegroundColor Green
    } else {
        Write-Host '  [skip] neo4j already listening on 7687' -ForegroundColor DarkGray
    }
}

# --- Java backends ----------------------------------------------------
if (Want 'backend') {
    Write-Host '[backend]'
    Start-Svc -Label 'hwc-app-admin' -FilePath $Java `
        -Arguments @('-Dserver.port=8090','-jar','hwc-app-admin-1.0.0.jar') `
        -WorkDir (Join-Path $BackendDir 'hwc-app-admin\target') -Port 8090
    Start-Svc -Label 'hwc-app-user' -FilePath $Java `
        -Arguments @('-Dserver.port=8080','-jar','hwc-app-user-1.0.0.jar') `
        -WorkDir (Join-Path $BackendDir 'hwc-app-user\target') -Port 8080
}

# --- Python AI service ------------------------------------------------
if (Want 'ai') {
    Write-Host '[ai]'
    Start-Svc -Label 'ai-service' -FilePath $Python `
        -Arguments @('-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8100') `
        -WorkDir $AiDir -Port 8100
}

# --- Frontends --------------------------------------------------------
if (Want 'frontend') {
    Write-Host '[frontend]'
    Start-Svc -Label 'user-web' -FilePath $Node `
        -Arguments @('node_modules/vite/bin/vite.js') -WorkDir (Join-Path $WebDir 'user-web') -Port 5173
    Start-Svc -Label 'admin-web' -FilePath $Node `
        -Arguments @('node_modules/vite/bin/vite.js') -WorkDir (Join-Path $WebDir 'admin-web') -Port 5174
}

Write-Host ''
Write-Host '=== port status ===' -ForegroundColor Cyan
foreach ($p in 3306,5432,6379,9000,7687,8080,8090,8100,5173,5174) {
    if (Test-Port $p) { Write-Host ("  {0} : up" -f $p) -ForegroundColor Green }
    else              { Write-Host ("  {0} : down" -f $p) -ForegroundColor Red }
}
Write-Host ''
Write-Host 'URLs: user-web http://localhost:5173 | admin-web http://localhost:5174 | AI docs http://localhost:8100/docs'
