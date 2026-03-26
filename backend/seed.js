import { db } from "./middlewares/dbconfig.js";
import { customers, cases, transactions, auditLogs } from "./src/db/schemas.ts";

const seedCustomers = [
    {
        displayId: "CUST-0001",
        name: "Meridian Holdings Ltd",
        accounts: ["ACC-4521", "ACC-4522"],
        riskRating: "high",
        kycStatus: "verified",
        businessType: "Investment Firm",
        country: "BVI",
        flagCount: "12",
    },
    {
        displayId: "CUST-0002",
        name: "Oakwood Financial Services",
        accounts: ["ACC-7832"],
        riskRating: "medium",
        kycStatus: "verified",
        businessType: "Banking",
        country: "US",
        flagCount: "4",
    },
    {
        displayId: "CUST-0003",
        name: "Zenith Trading Corp",
        accounts: ["ACC-1190", "ACC-1191"],
        riskRating: "high",
        kycStatus: "expired",
        businessType: "Import/Export",
        country: "PA",
        flagCount: "8",
    },
    {
        displayId: "CUST-0004",
        name: "Crimson Bay Ventures",
        accounts: ["ACC-6677"],
        riskRating: "low",
        kycStatus: "verified",
        businessType: "Technology",
        country: "US",
        flagCount: "1",
    },
    {
        displayId: "CUST-0005",
        name: "Silvergate Capital",
        accounts: ["ACC-3344", "ACC-3345"],
        riskRating: "high",
        kycStatus: "pending",
        businessType: "Crypto Exchange",
        country: "KY",
        flagCount: "15",
    },
    {
        displayId: "CUST-0006",
        name: "Baltic Freight Systems",
        accounts: ["ACC-8899"],
        riskRating: "medium",
        kycStatus: "verified",
        businessType: "Logistics",
        country: "CY",
        flagCount: "3",
    },
];

async function seed() {
    console.log("🌱 Seeding database...");

    // 1. Insert customers
    const insertedCustomers = [];
    for (const cust of seedCustomers) {
        const [inserted] = await db.insert(customers).values(cust).returning();
        insertedCustomers.push(inserted);
        console.log(`  ✅ Customer: ${inserted.displayId} — ${inserted.name}`);
    }

    // 2. Create cases for the first 3 customers (high-risk ones)
    const casesToCreate = [
        {
            customer: insertedCustomers[0], // Meridian Holdings
            displayId: "SAR-0001",
            status: "FLAGGED",
            riskScore: "0.94",
            riskLevel: "HIGH",
            jurisdiction: "FINCEN (USA)",
            assignedTo: "J. Morrison",
            txns: [
                { amount: "9800", currency: "USD", category: "Wire Transfer", isFlagged: true },
                { amount: "9700", currency: "USD", category: "Wire Transfer", isFlagged: true },
                { amount: "15000", currency: "USD", category: "ACH Transfer", isFlagged: false },
            ],
        },
        {
            customer: insertedCustomers[2], // Zenith Trading
            displayId: "SAR-0002",
            status: "DRAFT",
            riskScore: "0.87",
            riskLevel: "HIGH",
            jurisdiction: "AMLD (EU)",
            assignedTo: "S. Chen",
            txns: [
                { amount: "45000", currency: "EUR", category: "Trade Finance", isFlagged: true },
                { amount: "32000", currency: "EUR", category: "Wire Transfer", isFlagged: true },
            ],
        },
        {
            customer: insertedCustomers[4], // Silvergate
            displayId: "SAR-0003",
            status: "IN_REVIEW",
            riskScore: "0.91",
            riskLevel: "CRITICAL",
            jurisdiction: "FINCEN (USA)",
            assignedTo: "A. Petrov",
            txns: [
                { amount: "120000", currency: "USD", category: "Crypto Exchange", isFlagged: true },
                { amount: "85000", currency: "USD", category: "Wire Transfer", isFlagged: true },
                { amount: "95000", currency: "USD", category: "ACH Transfer", isFlagged: true },
                { amount: "5000", currency: "USD", category: "ATM Withdrawal", isFlagged: false },
            ],
        },
    ];

    let txnCounter = 1;

    for (const c of casesToCreate) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);

        const [newCase] = await db.insert(cases).values({
            displayId: c.displayId,
            status: c.status,
            riskScore: c.riskScore,
            riskLevel: c.riskLevel,
            jurisdiction: c.jurisdiction,
            assignedTo: c.assignedTo,
            customerId: c.customer.id,
            customerDetails: {
                id: c.customer.displayId,
                name: c.customer.name,
                country: c.customer.country,
                businessType: c.customer.businessType,
            },
            deadlineDate: deadline,
            violatedLaws: ["BSA 31 USC §5318(g)", "PMLA Section 3"],
            mlInsights: {
                risk_score: parseFloat(c.riskScore),
                risk_level: c.riskLevel,
                alerts: [{ type: "STRUCTURING_SMURFING", explanation: "Pattern detected." }],
                graph_patterns: [{
                    pattern_type: "smurfing",
                    nodes: ["A756", "B202"],
                    links: [{ source: "A756", target: "B202" }],
                }],
            },
        }).returning();

        console.log(`  ✅ Case: ${c.displayId} for ${c.customer.name}`);

        // Insert transactions for this case
        for (const txn of c.txns) {
            await db.insert(transactions).values({
                displayId: `TXN-${String(txnCounter++).padStart(6, "0")}`,
                caseId: newCase.id,
                amount: txn.amount,
                currency: txn.currency,
                timestamp: new Date(Date.now() - Math.random() * 30 * 86400000),
                category: txn.category,
                isFlagged: txn.isFlagged,
                senderDetails: {
                    acc_id: c.customer.accounts?.[0] || c.customer.displayId,
                    name: c.customer.name,
                    country: c.customer.country,
                },
                receiverDetails: {
                    acc_id: `RECV-${Math.floor(Math.random() * 9000 + 1000)}`,
                    name: "Counterparty Entity",
                    country: "US",
                },
            });
        }

        // Add audit log
        await db.insert(auditLogs).values({
            caseId: newCase.id,
            action: "CASE_INGESTED",
            actor: "SEED_SCRIPT",
            details: `Seed data: case ${c.displayId} for ${c.customer.name}`,
        });
    }

    console.log("\n🎉 Seeding complete!");
    console.log(`   ${insertedCustomers.length} customers`);
    console.log(`   ${casesToCreate.length} cases`);
    console.log(`   ${txnCounter - 1} transactions`);
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed error:", err);
    process.exit(1);
});
