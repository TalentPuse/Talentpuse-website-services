import { render, screen, fireEvent } from "@testing-library/react";
import JobRow from "../JobRow";
import type { PublicJobRow, TrackedKey } from "@/lib/api";

// CaptureButton goi useAuth. Khong mock thi provider vang mat va ca hang do.
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ token: "t", user: null }),
}));

function makeJob(over: Partial<PublicJobRow> = {}): PublicJobRow {
  return {
    source: "vietnamworks",
    source_job_id: "123",
    title: "Senior Data Engineer",
    company_name: "Zalopay",
    company_logo_url: null,
    city_canonical: "Hồ Chí Minh",
    job_level: "Senior",
    job_category: "Data",
    salary_million: 45,
    source_url: "https://example.com/job/123",
    posted_at: "2026-07-28T00:00:00Z",
    skills: ["python", "spark"],
    match_score: null,
    ...over,
  };
}

test("hien tieu de, cong ty, luong va thong tin phu tren mot hang", () => {
  render(<JobRow job={makeJob()} />);

  expect(screen.getByText("Senior Data Engineer")).toBeInTheDocument();
  expect(screen.getAllByText("Zalopay").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/45 triệu/).length).toBeGreaterThan(0);
  // getAll, khong phai get: JSDOM khong ap dung media query nen CA nhanh mobile
  // lan nhanh desktop deu nam trong DOM. Tren trinh duyet that chi mot cai hien.
  expect(screen.getAllByText(/Hồ Chí Minh/).length).toBeGreaterThan(0);
});

test("luong KHONG bi lam mo — day la thong tin nguoi tim viec doc dau tien", () => {
  // Nguoi dung yeu cau don thong tin phu sang phai va lam mo. Luong nam ben
  // phai NHUNG khong thuoc nhom bi lam mo: no la tieu chi loc so mot cua nguoi
  // tim viec, mo no di la chon mat thu quan trong nhat de lay them dac.
  render(<JobRow job={makeJob()} />);
  const salary = screen.getByTestId("job-row-salary");
  expect(salary.className).not.toContain("text-text-muted");
});

test("khong co luong thi ghi 'Thỏa thuận', khong de trong", () => {
  render(<JobRow job={makeJob({ salary_million: null })} />);
  expect(screen.getAllByText("Thỏa thuận").length).toBeGreaterThan(0);
});

test("bam vao hang thi mo panel chi tiet", () => {
  const onOpenDetail = jest.fn();
  render(<JobRow job={makeJob()} onOpenDetail={onOpenDetail} />);

  fireEvent.click(screen.getByRole("button", { name: /Senior Data Engineer/ }));

  expect(onOpenDetail).toHaveBeenCalledTimes(1);
});

test("bam phim Enter tren hang cung mo panel", () => {
  const onOpenDetail = jest.fn();
  render(<JobRow job={makeJob()} onOpenDetail={onOpenDetail} />);

  fireEvent.keyDown(screen.getByRole("button", { name: /Senior Data Engineer/ }), {
    key: "Enter",
  });

  expect(onOpenDetail).toHaveBeenCalledTimes(1);
});

test("bam nut Luu KHONG duoc mo panel theo", () => {
  // Nut nam ben trong hang bam duoc. Neu su kien noi len, moi lan luu job la
  // panel bat ra che mat danh sach — nguoi dung phai dong roi tim lai cho cu.
  const onOpenDetail = jest.fn();
  render(<JobRow job={makeJob()} onOpenDetail={onOpenDetail} />);

  fireEvent.click(screen.getByRole("button", { name: /Lưu job/ }));

  expect(onOpenDetail).not.toHaveBeenCalled();
});

test("co match_score thi hien %, ho so rong (null) thi KHONG hien 0%", () => {
  const { rerender } = render(<JobRow job={makeJob({ match_score: 82 })} />);
  expect(screen.getByText("82%")).toBeInTheDocument();

  rerender(<JobRow job={makeJob({ match_score: null })} />);
  expect(screen.queryByText(/^\d+%$/)).not.toBeInTheDocument();
});

test("job da nam trong pipeline thi trang thai luon hien, khong an sau hover", () => {
  // Nut hanh dong chi hien khi re chuot — tru khi job DA duoc luu/apply. An
  // trang thai do di nghia la nguoi dung khong biet minh da apply roi va apply
  // lai lan hai.
  const tracked: TrackedKey = {
    id: "a1",
    source: "vietnamworks",
    source_job_id: "123",
    status: "applied",
  };
  render(<JobRow job={makeJob()} tracked={tracked} />);

  expect(screen.getByTestId("job-row-actions").className).not.toContain("md:opacity-0");
});
