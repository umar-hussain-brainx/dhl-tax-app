import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = parseInt(url.searchParams.get("limit")) || 100;
  const startDate = new Date(url.searchParams.get("startDate"));
  const endDate = new Date(url.searchParams.get("endDate"));
  const status = url.searchParams.get("status");

  const skip = (page - 1) * limit;

  // Build where clause
  const where = {
    ...(startDate.getTime() === 0 ? {} : {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    }),
    ...(status && status !== 'all' ? { status } : {}),
  };

  const [rates, total] = await Promise.all([
    prisma.shippingRateWithTaxDuty.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
    }),
    prisma.shippingRateWithTaxDuty.count({
      where,
    }),
  ]);

  return json({ rates, total });
} 