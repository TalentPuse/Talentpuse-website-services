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

  it("không crash khi result KHÔNG phải JSON (handler cũ trả chuỗi)", () => {
    render(
      <AppendNoteCard name="append_note" toolCallId="t1"
        parameters={{ card: "Data Analyst", note: "x" }}
        status="complete" result="Đã thêm ghi chú vào Data Analyst." />,
    );
    expect(screen.getByText("Đã thêm ghi chú vào Data Analyst.")).toBeInTheDocument();
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
