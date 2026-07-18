# Snabbit Microservices Test Script
# Run this script while the docker-compose or services are running to test all API Gateway endpoints.

$ErrorActionPreference = "Stop"

Write-Host "=== Testing Snabbit Microservices API Gateway (Port 8000) ===" -ForegroundColor Cyan

# 1. Health check
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
    Write-Host "Gateway Health Check Status: $($health.status) ($($health.service))" -ForegroundColor Green
} catch {
    Write-Host "Failed to connect to API Gateway on Port 8000. Is docker-compose running?" -ForegroundColor Red
    exit 1
}

# 2. Register a customer
Write-Host "`n1. Creating customer..." -ForegroundColor Yellow
$customerBody = @{
    name = "Shreyash"
    email = "shreyash@bits.edu.in"
    phone = "9999999999"
    address = "Flat 302, Phase 1, Bangalore"
} | ConvertTo-Json
$customer = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/customers" -Method Post -Body $customerBody -ContentType "application/json"
Write-Host "Created Customer ID: $($customer.id), Name: $($customer.name)" -ForegroundColor Green

# 3. List customers
Write-Host "`n2. Listing customers..." -ForegroundColor Yellow
$customers = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/customers" -Method Get
Write-Host "Total Customers: $($customers.Count)" -ForegroundColor Green

# 4. Get available experts in Mumbai
Write-Host "`n3. Searching for available experts in Mumbai with kitchen cleaning skills..." -ForegroundColor Yellow
$experts = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/experts?city=Mumbai&status=available&skill=kitchen" -Method Get
foreach ($e in $experts) {
    Write-Host "Expert ID: $($e.id), Name: $($e.name), Skill: $($e.skills), Status: $($e.status), Hourly Rate: $($e.hourly_rate)" -ForegroundColor Green
}

# Choose Expert 1 (Priya Sharma)
$expertId = 1

# 5. Create a booking (Duration 3 hours)
Write-Host "`n4. Creating booking for Customer ID $($customer.id) with Expert ID $expertId..." -ForegroundColor Yellow
$bookingBody = @{
    customer_id = $customer.id
    expert_id = $expertId
    service_type = "kitchen cleaning"
    duration_hours = 3
    booking_date = "2026-07-20"
} | ConvertTo-Json
$booking = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/bookings" -Method Post -Body $bookingBody -ContentType "application/json"
Write-Host "Created Booking ID: $($booking.id), Cost: $($booking.total_cost), Status: $($booking.status)" -ForegroundColor Green

# 6. Verify expert status is updated to busy
Write-Host "`n5. Verifying Expert status..." -ForegroundColor Yellow
$expert = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/experts/$expertId" -Method Get
Write-Host "Expert $($expert.name) Status: $($expert.status) (Expected: busy)" -ForegroundColor Green

# 7. Test API Composition (Booking Detail)
Write-Host "`n6. Querying detailed booking summary via Gateway API composition..." -ForegroundColor Yellow
$detail = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/bookings/$($booking.id)/detail" -Method Get
Write-Host "--- Booking Detailed Summary ---" -ForegroundColor Cyan
Write-Host "Booking ID: $($detail.booking_id)"
Write-Host "Service Type: $($detail.service_type)"
Write-Host "Total Cost: $($detail.total_cost)"
Write-Host "Status: $($detail.status)"
Write-Host "Customer Name: $($detail.customer.name) ($($detail.customer.email))"
Write-Host "Expert Name: $($detail.expert.name) (Rating: $($detail.expert.rating))"
Write-Host "--------------------------------" -ForegroundColor Cyan

# 8. Complete booking
Write-Host "`n7. Completing booking ID $($booking.id) to release expert..." -ForegroundColor Yellow
$statusBody = @{
    status = "completed"
} | ConvertTo-Json
$update = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/bookings/$($booking.id)/status" -Method Put -Body $statusBody -ContentType "application/json"
Write-Host "Status update message: $($update.message)" -ForegroundColor Green

# 9. Verify expert is available again
Write-Host "`n8. Verifying Expert is available..." -ForegroundColor Yellow
$expert = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/experts/$expertId" -Method Get
Write-Host "Expert $($expert.name) Status: $($expert.status) (Expected: available)" -ForegroundColor Green

Write-Host "`n=== All API Gateway Endpoints Tested Successfully! ===" -ForegroundColor Green
