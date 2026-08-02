import { render, screen } from "@testing-library/react";

import MetricBlock from "@/components/admin/MetricBlock";

describe("MetricBlock", () => {
  it("renders children and the source label when ok", () => {
    render(
      <MetricBlock title="Traffic" source="umami" status="ok">
        <p>1234 lượt xem</p>
      </MetricBlock>
    );
    expect(screen.getByText("1234 lượt xem")).toBeInTheDocument();
    expect(screen.getByText(/umami/i)).toBeInTheDocument();
  });

  it("renders an explicit error, never a zero, when the source failed", () => {
    render(
      <MetricBlock
        title="Traffic"
        source="umami"
        status="error"
        error="Umami không phản hồi"
      >
        <p>1234 lượt xem</p>
      </MetricBlock>
    );
    expect(screen.getByText("Umami không phản hồi")).toBeInTheDocument();
    expect(screen.queryByText("1234 lượt xem")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
