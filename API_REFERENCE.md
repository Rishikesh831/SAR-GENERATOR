# Backend API Reference - SAR Generator

## Quick API Reference

### Base URL
- **Development**: `http://localhost:3000`
- **Production**: Configure via `FRONTEND_URL` env variable

### Response Format (All Endpoints)
```json
{
  "success": true/false,
  "data": {},
  "message": "Success message",
  "error": null or "Error details",
  "timestamp": "ISO 8601 timestamp"
}
```

---

## Endpoints Overview

### 🏥 Health & Status

#### GET `/`
```bash
curl http://localhost:3000/
```
Response:
```json
{
  "status": "online",
  "message": "SAR Generator API is live!",
  "timestamp": "2024-03-26T12:00:00.000Z",
  "version": "1.0.0"
}
```

#### GET `/health`
```bash
curl http://localhost:3000/health
```
Response:
```json
{
  "status": "OK",
  "timestamp": "2024-03-26T12:00:00.000Z",
  "uptime": 1234.5
}
```

#### GET `/api/status`
```bash
curl http://localhost:3000/api/status
```
Response:
```json
{
  "success": true,
  "status": "operational",
  "message": "Backend is operational and ready to serve requests",
  "services": {
    "database": "connected",
    "api": "ready",
    "cors": "enabled"
  }
}
```

---

## 🎯 PRIMARY INTEGRATION ENDPOINT

### POST `/api/sar/generate`
**Purpose**: Generate enhanced SAR report (Frontend Integration Point)

**Frontend Code**:
```typescript
const response = await fetch(MODEL_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    entityId: entity,
    baselineReport: baseReport,
    context: { transactions, networkEdges, externalRisk, historicalSARs }
  })
});
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/api/sar/generate \
  -H "Content-Type: application/json" \
  -d '{
    "entityId": "CUST-12345",
    "baselineReport": {
      "caseId": "SAR-2024-001",
      "dateGenerated": "2024-03-26T12:00:00Z",
      "reportingInstitution": "Bank XYZ",
      "reportingUnit": "Compliance",
      "entityId": "CUST-12345",
      "riskCategory": "High",
      "riskScore": 75,
      "kycStatus": "verified",
      "primaryCountry": "US",
      "riskTypes": ["structuring"],
      "txnCount": 25,
      "suspiciousTxnCount": 8,
      "totalAmount": 125000,
      "avgAmount": 5000,
      "maxSingleAmount": 9900,
      "periodStart": "2024-03-01",
      "periodEnd": "2024-03-26",
      "countriesInvolved": ["US", "BVI"],
      "transactionRows": [],
      "activityDescription": "Multiple suspicious transactions detected",
      "patternsObserved": ["structuring"],
      "networkConnections": 5,
      "connectedEntities": [],
      "relationshipTypes": [],
      "regulatoryBreaches": [],
      "regulatoryImpactScore": 0,
      "evidenceItems": [],
      "conclusion": "Activity warrants investigation",
      "aiConfidence": 85,
      "modelVersion": "Local-Rules-v1"
    },
    "context": {
      "transactions": [
        {
          "sender_account": "ACC-001",
          "receiver_account": "ACC-002",
          "amount": 9500,
          "type": "Wire Transfer",
          "merchant_category": "Unknown",
          "device": "Platform",
          "country": "US",
          "is_suspicious": true,
          "pattern": "structuring",
          "transaction_id": "TXN-001",
          "timestamp": "2024-03-26T10:30:00Z",
          "hour": 10,
          "day": "Wed",
          "is_high_risk_country": false,
          "log_amount": 3.977
        }
      ],
      "networkEdges": [
        {
          "entity_a": "CUST-12345",
          "entity_b": "CUST-67890",
          "relationship": "frequent_transactions",
          "strength": 0.85
        }
      ],
      "externalRisk": [
        {
          "entity": "CUST-12345",
          "source": "OFAC",
          "risk_type": "sanctions_match",
          "risk_score": 95,
          "description": "Potential OFAC match",
          "date": "2024-03-26"
        }
      ],
      "historicalSARs": [
        {
          "sar_id": "SAR-2023-001",
          "typology": "structuring",
          "country": "US",
          "risk_score": 88,
          "narrative": "Previous structuring pattern"
        }
      ]
    }
  }'
```

**Response** (Success):
```json
{
  "success": true,
  "data": {
    "report": {
      "caseId": "SAR-2024-001",
      "dateGenerated": "2024-03-26T12:00:00Z",
      "reportingInstitution": "Bank XYZ",
      "reportingUnit": "Compliance",
      "entityId": "CUST-12345",
      "riskCategory": "Critical",
      "riskScore": 88,
      "kycStatus": "verified",
      "primaryCountry": "US",
      "riskTypes": ["structuring", "BSA_violation"],
      "txnCount": 25,
      "suspiciousTxnCount": 8,
      "totalAmount": 125000,
      "avgAmount": 5000,
      "maxSingleAmount": 9900,
      "periodStart": "2024-03-01",
      "periodEnd": "2024-03-26",
      "countriesInvolved": ["US", "BVI"],
      "transactionRows": [],
      "activityDescription": "Backend analysis identified 8 suspicious transactions...",
      "patternsObserved": ["structuring"],
      "networkConnections": 5,
      "connectedEntities": [],
      "relationshipTypes": [],
      "regulatoryBreaches": [
        {
          "rule": "BSA Suspicious Activity Report",
          "ref": "31 USC §5318(g)",
          "severity": "critical",
          "trigger": "8 suspicious transactions totalling $125,000",
          "description": "Requires reporting of suspicious activity over $5,000",
          "explanation": "The observed patterns meet the statutory threshold...",
          "confidence": 97
        }
      ],
      "regulatoryImpactScore": 92,
      "evidenceItems": [],
      "riskIndicators": [],
      "historicalPrecedent": "Previous structuring patterns detected in 2023",
      "conclusion": "Activity meets SAR filing threshold",
      "aiConfidence": 87,
      "modelVersion": "Local-Rules-v1 (Backend Rule Engine)"
    },
    "narrative": "SAR NARRATIVE REPORT\n\nSUBJECT: CUST-12345\n...",
    "conclusion": "Activity meets SAR filing threshold",
    "modelVersion": "Local-Rules-v1 (Backend Rule Engine)",
    "aiConfidence": 87
  },
  "message": "SAR report generated successfully",
  "error": null,
  "timestamp": "2024-03-26T12:00:05.000Z"
}
```

**Response** (Validation Error):
```json
{
  "success": false,
  "data": null,
  "message": "Validation Error",
  "error": {
    "entityId": "Entity ID is required"
  },
  "timestamp": "2024-03-26T12:00:05.000Z"
}
```

---

## 📚 Reference Data Endpoints

### GET `/api/reference/data`
Get all reference data (rules, typologies, countries)

```bash
curl http://localhost:3000/api/reference/data
```

Response:
```json
{
  "success": true,
  "data": {
    "regulatoryRules": [
      {
        "id": "BSA-5318",
        "title": "BSA Suspicious Activity Report",
        "reference": "31 USC §5318(g)",
        "severity": "critical",
        "jurisdiction": "USA",
        "description": "...",
        "applicablePatterns": ["all"],
        "threshold": 5000,
        "filingDeadline": 30
      }
    ],
    "typologies": [
      {
        "id": "structuring",
        "name": "Structuring / Smurfing",
        "description": "Dividing transactions...",
        "riskLevel": "high",
        "patterns": ["multiple_micro_deposits"],
        "indicativeAmount": "multiple deposits $9,500-$9,900",
        "example": "Customer deposits $9,500 daily..."
      }
    ],
    "highRiskCountries": [
      {
        "code": "BVI",
        "name": "British Virgin Islands",
        "risk": "high",
        "source": "FATF"
      }
    ],
    "timestamp": "2024-03-26T12:00:05.000Z"
  },
  "message": "All reference data retrieved successfully"
}
```

### GET `/api/reference/regulatory-rules`
Get only regulatory rules with optional filtering

```bash
# Get all rules
curl http://localhost:3000/api/reference/regulatory-rules

# Filter by jurisdiction
curl "http://localhost:3000/api/reference/regulatory-rules?jurisdiction=USA"

# Filter by severity
curl "http://localhost:3000/api/reference/regulatory-rules?severity=critical"
```

### GET `/api/reference/regulatory-rules/:id`
Get specific regulatory rule

```bash
curl http://localhost:3000/api/reference/regulatory-rules/BSA-5318
```

### GET `/api/reference/typologies`
Get all AML/CFT typologies

```bash
# Get all typologies
curl http://localhost:3000/api/reference/typologies

# Filter by risk level
curl "http://localhost:3000/api/reference/typologies?riskLevel=high"
```

### GET `/api/reference/typologies/:id`
Get specific typology

```bash
curl http://localhost:3000/api/reference/typologies/structuring
```

### GET `/api/reference/countries`
Get high-risk countries list

```bash
# Get all countries
curl http://localhost:3000/api/reference/countries

# Filter by source
curl "http://localhost:3000/api/reference/countries?source=FATF"

# Filter by risk level
curl "http://localhost:3000/api/reference/countries?riskLevel=high"
```

---

## 📋 SAR Management Endpoints

### GET `/api/sar/:id`
Retrieve a SAR report by ID

```bash
curl http://localhost:3000/api/sar/SAR-2024-001
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "SAR-2024-001",
    "caseId": "CASE-001",
    "entityId": "CUST-12345",
    "reportData": "{...full report...}",
    "narrative": "SAR NARRATIVE...",
    "status": "draft",
    "createdAt": "2024-03-26T12:00:00Z"
  },
  "message": "SAR report retrieved successfully"
}
```

### POST `/api/sar/:id/narrative`
Generate or enhance narrative for SAR

```bash
curl -X POST http://localhost:3000/api/sar/SAR-2024-001/narrative \
  -H "Content-Type: application/json" \
  -d '{
    "report": { ... full report ... },
    "context": { ... additional context ... }
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "narrative": "SAR NARRATIVE REPORT\n\nSUBJECT: CUST-12345\n...",
    "conclusion": "Activity warrants filing",
    "sarId": "SAR-2024-001"
  },
  "message": "Narrative generated successfully"
}
```

### POST `/api/sar/save`
Save SAR report to database

```bash
curl -X POST http://localhost:3000/api/sar/save \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "CASE-001",
    "entityId": "CUST-12345",
    "report": { ... full report ... },
    "narrative": "SAR NARRATIVE..."
  }'
```

---

## ❌ Error Responses

### 400 - Validation Error
```json
{
  "success": false,
  "data": null,
  "message": "Validation Error",
  "error": {
    "entityId": "Entity ID is required"
  },
  "timestamp": "2024-03-26T12:00:00.000Z"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "data": null,
  "message": "SAR Report not found",
  "error": "SAR Report not found",
  "timestamp": "2024-03-26T12:00:00.000Z"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "data": null,
  "message": "Failed to generate SAR report",
  "error": "Error details here",
  "timestamp": "2024-03-26T12:00:00.000Z"
}
```

---

## 🔗 CORS Headers

All endpoints support the following CORS headers:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

---

## 📊 Regulatory Rules Reference

### Implemented Rules:
1. **BSA-5318** - Suspicious Activity Report
2. **FINCEN-1020** - FinCEN SAR Filing Rule
3. **PATRIOT-352** - USA PATRIOT Act - AML Program
4. **FATF-R20** - Suspicious Transaction Reporting
5. **FATF-R24** - Beneficial Ownership
6. **EU-AMLD5** - EU 5th AML Directive
7. **MICA-REG** - EU Markets in Crypto-Assets

### Implemented Typologies:
1. **structuring** - Structuring / Smurfing
2. **layering** - Layering / High-Value Transfers
3. **integration** - Integration / Cash-Intensive
4. **crypto_laundering** - Cryptocurrency Conversion
5. **shell_company** - Shell Company Transfer
6. **trade_fraud** - Trade Finance Fraud
7. **round_amounts** - Round Amount Pattern
8. **rapid_movement** - Rapid Cross-Border Movement
9. **new_account_rapid_funding** - New Account Rapid Funding

---

## 📝 Integration Checklist

- [ ] Backend running on port 3000
- [ ] Frontend configured with `VITE_SAR_MODEL_ENDPOINT=http://localhost:3000/api/sar/generate`
- [ ] Frontend running on port 5173
- [ ] CORS working (no console errors)
- [ ] SAR generation endpoint responds
- [ ] Reference data endpoints accessible
- [ ] SAR reports display correctly in frontend
- [ ] Narrative generation works
- [ ] Error handling displays properly

---

## 🆘 Troubleshooting

### CORS Errors
**Issue**: `Access to fetch at 'http://localhost:3000/...' from origin 'http://localhost:5173' has been blocked by CORS policy`

**Solution**: 
- Check backend is running
- Verify frontend URL matches CORS whitelist in `index.js`
- Ensure `FRONTEND_URL` env var is set correctly

### 404 on SAR Endpoints
**Issue**: `POST http://localhost:3000/api/sar/generate 404 Not Found`

**Solution**:
- Check backend started successfully
- Verify routes imported in `index.js`
- Check server logs for startup messages

### Timeout Errors
**Issue**: Frontend times out waiting for SAR generation response

**Solution**:
- Check backend performance
- Verify database connection
- Check console logs for errors
- Increase timeout if needed (currently 12 seconds)

---

## 📞 Support

For issues or questions:
1. Check backend console logs
2. Check browser console for frontend errors
3. Test endpoints directly with cURL
4. Review this API reference documentation
5. Check BACKEND_INTEGRATION_GUIDE.md for architecture details
