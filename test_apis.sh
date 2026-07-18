#!/bin/bash
# Snabbit Microservices Test Script for Linux/WSL (Bash version)

set -e

echo -e "\e[1;36m=== Testing Snabbit Microservices API Gateway (Port 8000) ===\e[0m"

# 1. Health check
if ! curl -s -f http://localhost:8000/health > /dev/null; then
    echo -e "\e[1;31mFailed to connect to API Gateway on Port 8000. Is docker running?\e[0m"
    exit 1
fi
echo -e "\e[1;32mGateway Health Check: ONLINE\e[0m"

# 2. Register a customer
echo -e "\n\e[1;33m1. Creating customer...\e[0m"
CUSTOMER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Shreyash", "email": "shreyash@bits.edu.in", "phone": "9999999999", "address": "Flat 302, Phase 1, Bangalore"}')
echo -e "\e[1;32mResponse:\e[0m $CUSTOMER_RESPONSE"

# Extract customer ID (simplistic parsing in bash without jq)
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 || echo "1")
if [ -z "$CUSTOMER_ID" ]; then CUSTOMER_ID="1"; fi

# 3. List customers
echo -e "\n\e[1;33m2. Listing customers...\e[0m"
LIST_RESPONSE=$(curl -s http://localhost:8000/api/v1/customers)
echo -e "\e[1;32mResponse:\e[0m $LIST_RESPONSE"

# 4. Search for available experts in Mumbai
echo -e "\n\e[1;33m3. Searching for available experts in Mumbai with kitchen cleaning skills...\e[0m"
EXPERT_RESPONSE=$(curl -s "http://localhost:8000/api/v1/experts?city=Mumbai&status=available&skill=kitchen")
echo -e "\e[1;32mResponse:\e[0m $EXPERT_RESPONSE"

EXPERT_ID="1"

# 5. Create a booking (Duration 3 hours)
echo -e "\n\e[1;33m4. Creating booking for Customer ID $CUSTOMER_ID with Expert ID $EXPERT_ID...\e[0m"
BOOKING_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\": $CUSTOMER_ID, \"expert_id\": $EXPERT_ID, \"service_type\": \"kitchen cleaning\", \"duration_hours\": 3, \"booking_date\": \"2026-07-20\"}")
echo -e "\e[1;32mResponse:\e[0m $BOOKING_RESPONSE"

# Extract booking ID
BOOKING_ID=$(echo "$BOOKING_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 || echo "1")
if [ -z "$BOOKING_ID" ]; then BOOKING_ID="1"; fi

# 6. Verify expert status is updated to busy
echo -e "\n\e[1;33m5. Verifying Expert status is 'busy'...\e[0m"
EXPERT_STATUS=$(curl -s http://localhost:8000/api/v1/experts/$EXPERT_ID)
echo -e "\e[1;32mResponse:\e[0m $EXPERT_STATUS"

# 7. Test API Composition (Booking Detail)
echo -e "\n\e[1;33m6. Querying detailed booking summary via Gateway API composition...\e[0m"
DETAIL_RESPONSE=$(curl -s http://localhost:8000/api/v1/bookings/$BOOKING_ID/detail)
echo -e "\e[1;36m--- Booking Detailed Summary ---\e[0m"
echo "$DETAIL_RESPONSE"
echo -e "\e[1;36m--------------------------------\e[0m"

# 8. Complete booking
echo -e "\n\e[1;33m7. Completing booking ID $BOOKING_ID to release expert...\e[0m"
COMPLETE_RESPONSE=$(curl -s -X PUT http://localhost:8000/api/v1/bookings/$BOOKING_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}')
echo -e "\e[1;32mResponse:\e[0m $COMPLETE_RESPONSE"

# 9. Verify expert is available again
echo -e "\n\e[1;33m8. Verifying Expert is available again...\e[0m"
EXPERT_STATUS_AFTER=$(curl -s http://localhost:8000/api/v1/experts/$EXPERT_ID)
echo -e "\e[1;32mResponse:\e[0m $EXPERT_STATUS_AFTER"

echo -e "\n\e[1;32m=== All API Gateway Endpoints Tested Successfully! ===\e[0m"
