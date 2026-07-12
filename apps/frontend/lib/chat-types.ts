export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export type AlertCardData = {
  title: string | null;
  company_name: string | null;
  city_canonical: string | null;
  salary_million: number | null;
  source_url: string | null;
  source: string | null;
};
