import { render, screen } from "@testing-library/react";
import MoveApplicationCard from "../cards/MoveApplicationCard";

describe("MoveApplicationCard", () => {
  it("không crash khi đang stream và parameters còn RỖNG", () => {
    // parameters KHÔNG được zod validate — runtime chỉ partialJSONParse.
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{}}
        status="inProgress"
      />,
    );
    expect(screen.getByText(/đang chuyển/i)).toBeInTheDocument();
  });

  it("không crash khi status=complete mà parameters vẫn thiếu field", () => {
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{}}
        status="complete"
        result="Đã chuyển xong."
      />,
    );
    expect(screen.getByText("Đã chuyển xong.")).toBeInTheDocument();
  });

  it("hiện tên card và cột đích khi hoàn tất", () => {
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{ card: "Business Analyst", status: "interviewing" }}
        status="complete"
        result='Đã chuyển "Business Analyst" từ saved sang interviewing.'
      />,
    );
    expect(screen.getByText("Business Analyst")).toBeInTheDocument();
    expect(screen.getByText("Phỏng vấn")).toBeInTheDocument();
  });

  it("gộp inProgress và executing thành cùng một trạng thái chờ", () => {
    const { rerender } = render(
      <MoveApplicationCard name="move_application" toolCallId="t1"
        parameters={{ card: "X" }} status="inProgress" />,
    );
    expect(screen.getByText(/đang chuyển/i)).toBeInTheDocument();
    rerender(
      <MoveApplicationCard name="move_application" toolCallId="t1"
        parameters={{ card: "X" }} status="executing" />,
    );
    expect(screen.getByText(/đang chuyển/i)).toBeInTheDocument();
  });

  it("trả về chuỗi thô cho status là khóa prototype thay vì crash", () => {
    // "__proto__" khiến `in` và bracket access đi lạc lên prototype chain
    // (STATUS_LABEL["__proto__"] === Object.prototype) thay vì undefined —
    // phải degrade về chuỗi thô như mọi status lạ khác, không throw.
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{ card: "Business Analyst", status: "__proto__" }}
        status="complete"
        result='Đã chuyển "Business Analyst" sang __proto__.'
      />,
    );
    expect(screen.getByText("Business Analyst")).toBeInTheDocument();
    expect(screen.getByText("__proto__")).toBeInTheDocument();
  });
});
