import { api } from "@/lib/api";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [overview, topSkills, cities, levels, companies, categories] = await Promise.all([
    api.overview(),
    api.topSkills(15),
    api.dashboardCities(15),
    api.dashboardLevels(15),
    api.topCompanies(20),
    api.categories(),
  ]);

  return (
    <DashboardClient
      overview={overview}
      topSkills={topSkills}
      cities={cities}
      levels={levels}
      companies={companies}
      categories={categories}
    />
  );
}