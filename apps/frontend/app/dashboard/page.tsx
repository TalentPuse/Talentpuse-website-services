import { api } from "@/lib/api";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [overview, topSkills, paying, salary, companies, categories] = await Promise.all([
    api.overview(),
    api.topSkills(15),
    api.highestPayingSkills(10),
    api.salaryByLevel(),
    api.topCompanies(20),
    api.categories(),
  ]);

  return (
    <DashboardClient
      overview={overview}
      topSkills={topSkills}
      paying={paying}
      salary={salary}
      companies={companies}
      categories={categories}
    />
  );
}
