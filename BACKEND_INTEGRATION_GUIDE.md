# Backend Integration Guide - Frontend Alignment

## Executive Summary

Your frontend is built to work with data sources through React Context without requiring structural changes. To integrate with the backend:

1. **Frontend expects the backend to provide SAR generation API** (trained model endpoint)
2. **Frontend is also set up to consume reference data** from backend endpoints
3. **No frontend changes required** - only backend modifications needed

---

## Phase 1: API Endpoints Analysis

### Primary Integration Point: SAR Generation API

The frontend's `SARGenerate.tsx` has a trained model endpoint integration:

```typescript
// From SARGenerate.tsx line 41
const MODEL_ENDPOINT = ((import.meta.env.VITE_SAR_MODEL_ENDPOINT ?? "").trim();

// Request sent to backend
POST MODEL_ENDPOINT
{
  entityId: string,
  baselineReport: FullSARReport,
  context: {
    transactions: CsvTransaction[],
    networkEdges: NetworkEdge[],
    externalRisk: ExternalRiskItem[],
    historicalSARs: HistoricalSAR[]
  }
}

// Expected Response
{
  report?: Partial<FullSARReport>,
  narrative?: string,
  conclusion?: string,
  modelVersion?: string,
  aiConfidence?: number
}
```

---

## Phase 2: Backend Files That Need Modification

### 1. **Authentication & Middleware Layer**
- **File**: `backend/middlewares/apiResponse.js` (CREATE NEW)
- **Purpose**: Standardized response formatting
- **Responsibility**: Wrap all responses with success/error metadata

### 2. **API Routes**
- **File**: `backend/routes/sarRoutes.js` (CREATE NEW)
- **Purpose**: SAR generation and management endpoints
- **Endpoints to add**:
  - `POST /api/sar/generate` - Generate SAR report
  - `GET /api/sar/:id` - Get SAR by ID
  - `POST /api/sar/:id/narrative` - Generate narrative

- **File**: `backend/routes/referenceRoutes.js` (CREATE NEW)
- **Purpose**: Reference data endpoints
- **Endpoints to add**:
  - `GET /api/reference/regulatory-rules`
  - `GET /api/reference/typologies`
  - `GET /api/reference/countries`

### 3. **Controllers**
- **File**: `backend/controllers/SARGenerationController.js` (CREATE NEW)
- **Purpose**: Handle SAR generation logic using rule engine
- **Key method**: `generateSARReport(entityId, context)`

- **File**: `backend/controllers/ReferenceDataController.js` (CREATE NEW)
- **Purpose**: Provide reference data to frontend

### 4. **Configuration**
- **File**: `backend/index.js` (MODIFY)
- **Changes needed**:
  - Import new routes
  - Mount new routes
  - Configure proper CORS
  - Add error handling middleware

---

## Phase 3: Response Data Structures

### FullSARReport Structure (What frontend expects)

```typescript
{
  // Header Section
  caseId: string,
  dateGenerated: string,
  reportingInstitution: string,
  reportingUnit: string,

  // Subject Section
  entityId: string,
  riskCategory: "Critical" | "High" | "Medium" | "Low",
  riskScore: number,        // 0-100
  kycStatus: string,
  primaryCountry: string,
  riskTypes: string[],

  // Transaction Summary
  txnCount: number,
  suspiciousTxnCount: number,
  totalAmount: number,
  avgAmount: number,
  maxSingleAmount: number,
  periodStart: string,
  periodEnd: string,
  countriesInvolved: string[],
  transactionRows: Array<{
    date: string,
    amount: number,
    type: string,
    from: string,
    to: string,
    indicator: string
  }>,

  // Suspicious Activity
  activityDescription: string,
  patternsObserved: string[],
  networkConnections: number,
  connectedEntities: string[],
  relationshipTypes: string[],

  // Regulatory Breaches
  regulatoryBreaches: Array<{
    rule: string,
    ref: string,
    severity: "critical" | "high" | "medium" | "low",
    description: string,
    trigger: string,
    explanation: string,
    confidence: number
  }>,
  regulatoryImpactScore: number,

  // Evidence & Risk
  evidenceItems: string[],
  riskIndicators: string[],
  historicalPrecedent: string,

  // Conclusion
  conclusion: string,
  aiConfidence: number,
  modelVersion: string
}
```

---

## Phase 4: CORS & Middleware Configuration

### Current Setup in `index.js`:
```javascript
app.use(cors());
```

### Updated Setup Needed:
```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});
```

---

## Phase 5: Environment Variables to Add

Create `.env` file in backend root:
```
PORT=3000
DATABASE_URL=your_database_url
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

---

## Phase 6: Bootstrap Testing

### Step 1: Start Backend
```bash
cd backend
npm install --legacy-peer-deps
npm start
```

### Step 2: Configure Frontend Environment
Create `frontend/.env.local`:
```
VITE_SAR_MODEL_ENDPOINT=http://localhost:3000/api/sar/generate
```

### Step 3: Start Frontend
```bash
cd frontend
npm run dev
```

### Step 4: Test SAR Generation
- Navigate to `/sar/generate` in frontend
- Click "Generate SAR Report"
- Verify the request goes to your backend endpoint
- Backend should return enhanced report

---

## Phase 7: Exact Files to Create/Modify

### CREATE NEW FILES:

#### 1. `backend/middlewares/apiResponse.js`
```javascript
export const sendResponse = (res, statusCode, data, message = '', success = true, error = null) => {
  res.status(statusCode).json({
    success,
    data,
    message,
    error,
    timestamp: new Date().toISOString()
  });
};

export const sendError = (res, statusCode, error, message = '') => {
  res.status(statusCode).json({
    success: false,
    data: null,
    message: message || error.message,
    error: error.message || error,
    timestamp: new Date().toISOString()
  });
};
```

#### 2. `backend/routes/sarRoutes.js`
[See detailed implementation below in Phase 8]

#### 3. `backend/routes/referenceRoutes.js`
[See detailed implementation below in Phase 8]

#### 4. `backend/controllers/SARGenerationController.js`
[See detailed implementation below in Phase 8]

#### 5. `backend/controllers/ReferenceDataController.js`
[See detailed implementation below in Phase 8]

### MODIFY EXISTING FILES:

#### 1. `backend/index.js`
- Add new route imports
- Mount new routes
- Configure CORS properly
- Add error middleware

---

## Expected Response Flow

### Request Flow:
1. Frontend loads CSV data and processes it locally
2. User clicks "Generate SAR"
3. Frontend creates baseline report using local rule engine
4. Frontend sends POST to `MODEL_ENDPOINT` with:
   - Generated baseline report
   - Context data (transactions, edges, external risk)
5. Backend receives request
6. Backend enhances report using ML/rules
7. Backend returns enhanced report
8. Frontend merges response with baseline report
9. Frontend displays enhanced SAR report

---

## Key Integration Points Summary

| Component | Current | After Integration |
|-----------|---------|-------------------|
| Frontend | Uses CSV files + local processing | Uses CSV files + calls backend for enhancement |
| Backend | Partial routes only | Full API endpoints matching frontend needs |
| Data Flow | Client-side only | Client-side + Server-side enhancement |
| CORS | Basic | Fully configured |
| Error Handling | Minimal | Comprehensive |

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] CORS allows requests from http://localhost:5173
- [ ] SAR generation endpoint returns proper response format
- [ ] Response includes all required FullSARReport fields
- [ ] Frontend successfully receives and processes response
- [ ] SAR report displays correctly in UI
- [ ] All reference data endpoints return data
- [ ] Error handling works (500, 404, validation errors)

---

## Next Steps

1. Create new middleware file for API responses
2. Create SAR generation controller with rule engine
3. Create reference data controller
4. Create new route files
5. Update index.js with new routes and middleware
6. Test end-to-end flow
7. Refine based on test results
