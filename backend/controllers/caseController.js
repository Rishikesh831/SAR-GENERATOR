
// get all cases
export const getAllCases = async (req, res) => {
    try {
        // Mocking a database call for now
        const allcases = await prisma.cases.findMany();

        if (allcases) {
            res.status(200).json({ message: "all cases successful ", data: allcases });
        } else {
            res.status(400).json({ message: "No cases found" });
        }
    } catch (e) {
        res.status(500).json({ message: "Internal server error", error: e.message });
    }
};

// create a new case
export const postcase = async (req, res) => {
    const { transactions } = req.body;
    try {
        const new_case = await prisma.cases.create({
            data: transactions
        })
        return res.status(200).json({ message: "case created successfully! ", data: new_case.id })
    } catch (error) {
        res.status(404).json({ message: error })
    }

}


// find case by id
export const getcasebyid = async (req, res) => {
    const caseid = req.params.id;
    try {
        const case_details = await prisma.cases.findUnique({
            where: { id: caseid },
            include: { transactions: true }
        })
        if (case_details) {
            return res.status(200).json({ message: "case found!", data: case_details })
        }
        else {
            return res.status(400).json({ message: "case not found" })
        }
    } catch (error) {
        return res.status(500).json({ error });
    }
}



// trigger analysis 
export const analysecase = async (req, res) => {
    const caseid = req.params.id;
    try {
        const case_details = await prisma.cases.findUnique({
            where: { id: caseid }
        })
        if (case_details) {
            const response = await prisma.cases.update({
                where: { id: caseid },
                data: { status: "PROCESSING" }
                // push to websocket

            })
            return res.status(200).json({ message: `case with id ${caseid} is processing` })

        }
    } catch (error) {
        return res.status(500).json({ message: error });
    }
}


export const deletecase = async (req, res) => {
    const caseid = req.params.id;
    try {
        const case_details = await prisma.cases.findUnique({
            where: { id: caseid }
        })
        if (case_details) {
            const response = await prisma.cases.deleteOne({
                where: { id: caseid },

            })
            return res.status(200).json({ message: `case with id ${caseid} deleted` })

        }
    } catch (error) {
        return res.status(500).json({ message: error });
    }
}


