export type AlertCardData = {
  title: string | null;
  company_name: string | null;
  city_canonical: string | null;
  salary_million: number | null;
  source_url: string | null;
  source: string | null;
};

export type ChatMessage = {
  id: string;
  role: "bot" | "user";
  type: "alert" | "text";
  content: string;
  alerts?: AlertCardData[];
  timestamp: Date;
};
