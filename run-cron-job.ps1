# Script pentru rularea job-ului de generare știri
# Acest script poate fi programat în Task Scheduler Windows

try {
    # Adresa locală la care rulează aplicația Next.js
    $baseUrl = "http://localhost:3000"
    
    # Endpoint-ul pentru generarea știrilor
    $endpoint = "/api/cronGenerateNews"
    
    # Parametrii necesari
    $apiKey = "secure_cron_key"
    $enableWebSearch = "true"
    
    # Constructia URL-ului complet
    $url = "$baseUrl$endpoint`?apiKey=$apiKey&enableWebSearch=$enableWebSearch"
    
    # Verificăm dacă aplicația rulează
    try {
        $testConnection = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing -TimeoutSec 5
        
        # Dacă aplicația rulează, apelăm endpoint-ul de generare știri
        Write-Host "Aplicația rulează, apelăm generarea știrilor..." -ForegroundColor Green
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
        
        Write-Host "Generare știri terminată cu statusul: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Răspuns: $($response.Content)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Aplicația nu rulează sau nu răspunde. Încercați să porniți manual aplicația." -ForegroundColor Red
        Write-Host "Eroare: $_" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Eroare la apelarea job-ului: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Job executat cu succes la: $(Get-Date)" -ForegroundColor Green 