import { render, screen, fireEvent } from "@testing-library/react";
import ApplicationCard from "../ApplicationCard";
import type { Application } from "@/lib/api";

jest.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    isDragging: false,
  }),
}));

function makeApp(over: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    source: "linkedin",
    source_job_id: "4434985467",
    title: "Senior Data Scientist",
    company_name: "Zalopay",
    city: "HCMC",
    source_url: "https://www.linkedin.com/jobs/view/4434985467",
    salary_million: null,
    status: "saved",
    applied_at: null,
    notes: null,
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  } as Application;
}

test("bam tieu de MO PANEL, KHONG dieu huong sang tin goc", () => {
  // Truoc ban va: tieu de la <a href target="_blank"> KEM onClick nhung KHONG
  // preventDefault. Do duoc tren trinh duyet that: defaultPrevented=false, nen
  // trinh duyet mo tab moi sang LinkedIn VA panel cung mo — tab moi cuop focus
  // nen nguoi dung khong bao gio thay panel. Duong dan toi tin goc van con
  // nguyen trong panel ("Xem tin gốc và ứng tuyển"), nen chan dieu huong o day
  // khong lam mat loi ra nao.
  const onOpenDetail = jest.fn();
  render(<ApplicationCard app={makeApp()} onDelete={jest.fn()} onOpenDetail={onOpenDetail} />);

  const title = screen.getByText("Senior Data Scientist");
  const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
  fireEvent(title, evt);

  expect(onOpenDetail).toHaveBeenCalledTimes(1);
  expect(evt.defaultPrevented).toBe(true);
});

test("job nhap tay (khong co source_url) van mo duoc panel", () => {
  const onOpenDetail = jest.fn();
  render(
    <ApplicationCard
      app={makeApp({ source: "manual", source_job_id: null, source_url: null, title: "Job tu nhap" })}
      onDelete={jest.fn()}
      onOpenDetail={onOpenDetail}
    />,
  );
  fireEvent.click(screen.getByText("Job tu nhap"));
  expect(onOpenDetail).toHaveBeenCalledTimes(1);
});
