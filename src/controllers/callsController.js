import { prisma } from "../lib/prisma.js";

export async function listCalls(req, res, next) {
  try {
    const { adminId, from, to } = req.query;
    const where = {};
    if (adminId) where.adminId = adminId;
    if (from) where.startTime = { ...where.startTime, gte: new Date(from) };
    if (to) where.endTime = { ...where.endTime, lte: new Date(to) };

    const calls = await prisma.call.findMany({
      where,
      include: { participants: true },
      orderBy: { startTime: "asc" },
    });
    res.json(calls);
  } catch (e) {
    next(e);
  }
}

export const deleteCall = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.call.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Call deleted successfully",
    });
  } catch (error) {
    console.error("Delete call error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete call",
    });
  }
};
