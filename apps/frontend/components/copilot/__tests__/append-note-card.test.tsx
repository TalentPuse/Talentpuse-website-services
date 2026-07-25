import { render, screen } from "@testing-library/react";
import AppendNoteCard from "../cards/AppendNoteCard";

describe("AppendNoteCard", () => {
  it("hiện dòng note vừa thêm khi result là JSON", () => {
    render(
      <AppendNoteCard
        name="append_note"
        toolCallId="t1"
        parameters={{ card: "Data Analyst", note: "HR hẹn vòng 2" }}
        status="complete"
        result={JSON.stringify({
          message: "Đã ghi chú.",
          line: "[25/07] HR hẹn vòng 2",
          card: "Data Analyst",
        })}
      />,
    );
    expect(screen.getByText("[25/07] HR hẹn vòng 2")).toBeInTheDocument();
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
  });

  it("hiện thông báo trung lập, KHÔNG hiện tên card, khi result không phải JSON (không tìm thấy card ⇒ CHƯA ghi được gì)", () => {
    const leakyResult = 'Không tìm thấy card nào khớp "Tester QA".';
    const { container } = render(
      <AppendNoteCard name="append_note" toolCallId="t1"
        parameters={{ card: "Tester QA", note: "gọi lại" }}
        status="complete" result={leakyResult} />,
    );
    expect(screen.getByText("Chưa ghi được ghi chú — xem trả lời bên dưới.")).toBeInTheDocument();
    expect(screen.queryByText("Tester QA")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(leakyResult);
  });

  it("không rò UUID nội bộ của candidate ra card khi result nhập nhằng (nhiều card khớp)", () => {
    // Chuỗi thật quan sát được ở browser thật khi gõ 'ghi chú vào data: gọi HR
    // lại' — result này viết cho AGENT đọc (kèm id nội bộ), KHÔNG phải để
    // hiện thẳng lên card, và trước bản vá "data" còn bị vẽ đậm như tên card
    // thật dù chưa ghi được gì.
    const leakyResult =
      'Có nhiều card khớp "data", hỏi lại user:\n' +
      '- "Data Engineer" tại Apollo Solutions VN (rejected, id=35dce134-345d-4f69-8a61-3e00687098cb)\n' +
      '- "Data Analyst" tại SUNJIN (applied, id=8f14e45f-ceea-467e-bd7e-1a234f5c6d7e)';
    const { container } = render(
      <AppendNoteCard
        name="append_note"
        toolCallId="t1"
        parameters={{ card: "data", note: "gọi HR lại" }}
        status="complete"
        result={leakyResult}
      />,
    );
    expect(screen.getByText("Chưa ghi được ghi chú — xem trả lời bên dưới.")).toBeInTheDocument();
    expect(screen.queryByText("data")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("35dce134-345d-4f69-8a61-3e00687098cb");
    expect(container.textContent).not.toContain("8f14e45f-ceea-467e-bd7e-1a234f5c6d7e");
    expect(container.textContent).not.toContain(leakyResult);
  });

  it("không crash khi parameters rỗng lúc đang stream", () => {
    render(
      <AppendNoteCard name="append_note" toolCallId="t1" parameters={{}} status="inProgress" />,
    );
    expect(screen.getByText(/đang ghi chú/i)).toBeInTheDocument();
  });

  it("không crash và không render object thô khi field trong payload KHÔNG phải string", () => {
    render(
      <AppendNoteCard
        name="append_note"
        toolCallId="t1"
        parameters={{ card: "Data Analyst", note: "x" }}
        status="complete"
        result={JSON.stringify({
          message: "Đã ghi chú.",
          line: { nested: true },
          card: "Data Analyst",
        })}
      />,
    );
    // line không phải string nên không được render trực tiếp (React sẽ throw
    // nếu một object lọt vào JSX) — phải rơi về nhánh message/fallback an toàn.
    expect(screen.getByText("Đã ghi chú.")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });
});
