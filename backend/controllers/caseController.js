export const getAllCases = async (req, res) => {
    try {
        // Mocking a database call for now
        const allcases = "SELECT * from Cases GROUP BY case_id";
        
        if (allcases) {
            res.status(200).json({ message: "all cases successful ", data: allcases });
        } else {
            res.status(400).json({ message: "No cases found" });
        }
    } catch (e) {
        res.status(500).json({ message: "Internal server error", error: e.message });
    }
};