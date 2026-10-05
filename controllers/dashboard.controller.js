import { fetchDashboardStats } from "../services/db.js";

export async function getDashboardStats(req, res) {
    const stats = await fetchDashboardStats();
    return res.status(200).json({ success: true, message: "Dashboard stats fetched successfully", data: stats });
}
