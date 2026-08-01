import { render, screen } from "@testing-library/react";
import JobMatchScore from "../JobMatchScore";

const base = {
  score: 78,
  reasons: ["Khớp 7/9 kỹ năng tin này yêu cầu"],
  matched_skills: ["python"],
  missing_skills: ["airflow", "dbt"],
  skill_basis: "required" as const,
  skills_matched: 7,
  skills_total: 9,
  criteria_used: ["city", "level", "skills", "title"],
};

test("ho so rong thi moi dien ho so, KHONG hien 0%", () => {
  render(<JobMatchScore match={null} />);
  expect(screen.queryByText(/0\s*%/)).not.toBeInTheDocument();
  expect(screen.getByText(/hồ sơ/i)).toBeInTheDocument();
});

test("hien diem phan tram va cau giai thich", () => {
  render(<JobMatchScore match={base} />);
  expect(screen.getByText("78%")).toBeInTheDocument();
  expect(screen.getByText(/Khớp 7\/9 kỹ năng/)).toBeInTheDocument();
});

test("liet ke ky nang con thieu", () => {
  render(<JobMatchScore match={base} />);
  expect(screen.getByText("airflow")).toBeInTheDocument();
  expect(screen.getByText("dbt")).toBeInTheDocument();
});

test("noi ro da cham tren bao nhieu tieu chi", () => {
  render(<JobMatchScore match={base} />);
  expect(screen.getByText(/4\/5 tiêu chí/)).toBeInTheDocument();
});

test("co so 'mentioned' khong hien phan ky nang con thieu", () => {
  // Tin khong co ky nang cau truc => ta KHONG BIET no yeu cau gi.
  // Hien "con thieu: ..." o day la bia dat va se thanh loi khuyen sai.
  render(<JobMatchScore match={{ ...base, skill_basis: "mentioned", missing_skills: [] }} />);
  expect(screen.queryByText(/còn thiếu/i)).not.toBeInTheDocument();
});
