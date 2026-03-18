export const auditlog = async (caseid) => {
    const response = await prisma.cases.update(
        data,
        { where: { id: caseid } }
    )
}