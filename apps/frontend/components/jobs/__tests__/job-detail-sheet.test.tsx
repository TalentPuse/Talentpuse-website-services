import { render, screen, waitFor } from "@testing-library/react";
import JobDetailSheet from "../JobDetailSheet";

jest.mock("@/lib/api", () => ({ jobsApi: { detail: jest.fn() } }));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "tok" }) }));

const { jobsApi } = jest.requireMock("@/lib/api");

const detail = {
  source: "linkedin", source_job_id: "j1", title: "Data Engineer",
  company_name: "Acme", description: "Xay dung pipeline du lieu.",
  requirement: null, benefits: [], skills: [], match: null,
  company_logo_url: null, company_size_label: null, city_canonical: "HCMC",
  primary_address: null, job_level: null, job_category: null,
  employment_type: null, years_of_experience: null, working_days: null,
  degree_label: null, salary_million: null, salary_min_million: null,
  salary_max_million: null, source_url: null, posted_at: null,
  expired_at: null, num_of_views: null, num_of_applications: null,
};

beforeEach(() => jest.clearAllMocks());

test("khong goi API khi chua chon job nao", () => {
  render(<JobDetailSheet source={null} sourceJobId={null} onClose={jest.fn()} />);
  expect(jobsApi.detail).not.toHaveBeenCalled();
});

test("nap va hien JD khi mo", async () => {
  jobsApi.detail.mockResolvedValue(detail);
  render(<JobDetailSheet source="linkedin" sourceJobId="j1" onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText("Data Engineer")).toBeInTheDocument());
  expect(screen.getByText(/Xay dung pipeline/)).toBeInTheDocument();
});

test("loi API hien thong bao loi RIENG, khong hien nhu la tin khong co mo ta", async () => {
  jobsApi.detail.mockRejectedValue(new Error("500"));
  render(<JobDetailSheet source="linkedin" sourceJobId="j1" onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText(/Không tải được/i)).toBeInTheDocument());
  expect(screen.queryByText(/không có mô tả chi tiết/i)).not.toBeInTheDocument();
});

test("job nhap tay (khong co source_job_id) thi bao ro thay vi panel trong", () => {
  render(<JobDetailSheet source="manual" sourceJobId={null}
                         onClose={jest.fn()} manualTitle="Job tu nhap" />);
  expect(screen.getByText(/tự nhập/i)).toBeInTheDocument();
  expect(jobsApi.detail).not.toHaveBeenCalled();
});
