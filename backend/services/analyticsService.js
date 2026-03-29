/**
 * Analytics Service
 * Combines CSV statistical data with ML insights for dashboard analytics
 */

/**
 * Generate analytics for a case
 * 
 * @param {Object} caseData - Full case with transactions
 * @param {Object} mlInsights - ML analysis results
 * @param {Object} riskAttribution - Risk attribution results
 * @returns {Object} - Analytics data
 */
export function generateAnalytics(caseData, mlInsights = {}, riskAttribution = {}) {
    const transactions = caseData.transactions || [];

    // ─── CSV-derived stats ───────────────────────────────────────────────────

    const amounts = transactions.map(t => parseFloat(t.amount || 0));
    const totalAmount = amounts.reduce((s, a) => s + a, 0);
    const currencies = {};
    const categories = {};
    const dailyVolume = {};
    const countries = {};

    transactions.forEach(t => {
        // Currency breakdown
        const cur = t.currency || "INR";
        currencies[cur] = (currencies[cur] || 0) + 1;

        // Category breakdown
        const cat = t.category || "Other";
        categories[cat] = (categories[cat] || 0) + 1;

        // Daily volume
        const date = t.timestamp instanceof Date
            ? t.timestamp.toISOString().split("T")[0]
            : String(t.timestamp).split("T")[0];
        if (!dailyVolume[date]) dailyVolume[date] = { count: 0, amount: 0 };
        dailyVolume[date].count++;
        dailyVolume[date].amount += parseFloat(t.amount || 0);

        // Country breakdown
        const sCountry = t.senderDetails?.country || "Unknown";
        const rCountry = t.receiverDetails?.country || "Unknown";
        countries[sCountry] = (countries[sCountry] || 0) + 1;
        if (rCountry !== sCountry) countries[rCountry] = (countries[rCountry] || 0) + 1;
    });

    const csvStats = {
        transaction_count: transactions.length,
        total_amount: Math.round(totalAmount),
        average_amount: transactions.length > 0 ? Math.round(totalAmount / transactions.length) : 0,
        max_amount: amounts.length > 0 ? Math.round(Math.max(...amounts)) : 0,
        min_amount: amounts.length > 0 ? Math.round(Math.min(...amounts)) : 0,
        median_amount: amounts.length > 0 ? Math.round(median(amounts)) : 0,
        std_deviation: amounts.length > 1 ? Math.round(stdDev(amounts)) : 0,
        flagged_count: transactions.filter(t => t.isFlagged).length,
        flagged_percentage: transactions.length > 0
            ? Math.round((transactions.filter(t => t.isFlagged).length / transactions.length) * 100)
            : 0,
        currency_breakdown: currencies,
        category_breakdown: categories,
        country_breakdown: countries,
        daily_volume: Object.entries(dailyVolume)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({ date, ...data })),
        time_range: {
            start: transactions.length > 0
                ? new Date(Math.min(...transactions.map(t => new Date(t.timestamp)))).toISOString()
                : null,
            end: transactions.length > 0
                ? new Date(Math.max(...transactions.map(t => new Date(t.timestamp)))).toISOString()
                : null,
        },
    };

    // ─── ML-derived insights ─────────────────────────────────────────────────

    const mlInsightsData = {
        risk_score: mlInsights?.risk_score || null,
        risk_level: mlInsights?.risk_level || null,
        patterns_detected: mlInsights?.patterns || [],
        alerts: mlInsights?.alerts || [],
        clusters: mlInsights?.clusters || [],
        anomaly_count: (mlInsights?.alerts?.length || 0) + (mlInsights?.patterns?.length || 0),
    };

    // ─── Risk attribution insights ───────────────────────────────────────────

    const riskInsights = {
        composite_risk_score: riskAttribution?.risk_score || null,
        risk_level: riskAttribution?.risk_level || null,
        typologies: riskAttribution?.typologies || [],
        rule_signals_count: riskAttribution?.rule_signals?.length || 0,
        flagged_chains_count: riskAttribution?.flagged_chains?.length || 0,
        breakdown: riskAttribution?.composite_breakdown || {},
    };

    // ─── Velocity analysis ───────────────────────────────────────────────────

    const sortedDates = Object.keys(dailyVolume).sort();
    const velocity = {
        peak_day: sortedDates.length > 0
            ? sortedDates.reduce((max, d) => dailyVolume[d].amount > (dailyVolume[max]?.amount || 0) ? d : max, sortedDates[0])
            : null,
        peak_amount: sortedDates.length > 0
            ? Math.round(Math.max(...Object.values(dailyVolume).map(d => d.amount)))
            : 0,
        average_daily_volume: sortedDates.length > 0
            ? Math.round(totalAmount / sortedDates.length)
            : 0,
        active_days: sortedDates.length,
    };

    return {
        csv_stats: csvStats,
        ml_insights: mlInsightsData,
        risk_insights: riskInsights,
        velocity,
        case_metadata: {
            case_id: caseData.displayId || caseData.id,
            status: caseData.status,
            jurisdiction: caseData.jurisdiction,
            created_at: caseData.createdAt,
            updated_at: caseData.updatedAt,
        },
        generated_at: new Date().toISOString(),
    };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr) {
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}
