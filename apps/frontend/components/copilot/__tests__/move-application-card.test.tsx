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

  it("không crash khi status=complete mà parameters vẫn thiếu field (đọc từ payload JSON)", () => {
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{}}
        status="complete"
        result={JSON.stringify({
          message: "Đã chuyển xong.",
          card: "Business Analyst",
          from: "saved",
          to: "offer",
        })}
      />,
    );
    expect(screen.getByText("Đã chuyển xong.")).toBeInTheDocument();
  });

  it("hiện tên card và cột đích khi hoàn tất, đọc từ PAYLOAD (kết quả thật) chứ không phải parameters (thứ model yêu cầu)", () => {
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        // Cố tình khác payload để chứng minh card đọc payload, không đọc parameters.
        parameters={{ card: "ba", status: "interviewing" }}
        status="complete"
        result={JSON.stringify({
          message: 'Đã chuyển "Business Analyst" từ saved sang interviewing.',
          card: "Business Analyst",
          from: "saved",
          to: "interviewing",
        })}
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
    // phải degrade về chuỗi thô như mọi status lạ khác, không throw. Test này
    // vẫn phải đúng nguyên ý nghĩa cũ sau khi đổi sang đọc payload: đưa
    // "__proto__" vào field `to` của payload thay vì `parameters.status`.
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{ card: "Business Analyst", status: "__proto__" }}
        status="complete"
        result={JSON.stringify({
          message: 'Đã chuyển "Business Analyst" sang __proto__.',
          card: "Business Analyst",
          from: "saved",
          to: "__proto__",
        })}
      />,
    );
    expect(screen.getByText("Business Analyst")).toBeInTheDocument();
    expect(screen.getByText("__proto__")).toBeInTheDocument();
  });

  it("hiện thông báo trung lập, KHÔNG mũi tên/badge/tên card, khi result không phải JSON (không tìm thấy card ⇒ CHƯA chuyển được gì)", () => {
    // Chuỗi thật quan sát được ở browser thật: tool không tìm thấy "Tester QA"
    // nên KHÔNG ghi gì vào DB, nhưng trước bản vá card vẫn vẽ "Tester QA → Từ
    // chối" như đã xong.
    const leakyResult =
      'Không tìm thấy card nào khớp "Tester QA". Hỏi user xem họ muốn nói job nào.';
    const { container } = render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{ card: "Tester QA", status: "rejected" }}
        status="complete"
        result={leakyResult}
      />,
    );
    expect(screen.getByText("Chưa chuyển được — xem trả lời bên dưới.")).toBeInTheDocument();
    expect(screen.queryByText("Từ chối")).not.toBeInTheDocument();
    expect(screen.queryByText("Tester QA")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("→");
    expect(container.textContent).not.toContain(leakyResult);
  });

  it("không rò UUID nội bộ của candidate ra card khi result nhập nhằng (nhiều card khớp)", () => {
    // Chuỗi thật quan sát được ở browser thật khi gõ "chuyển data sang offer"
    // với 4 card khớp — result này viết cho AGENT đọc (kèm id nội bộ), KHÔNG
    // phải để hiện thẳng lên card.
    const leakyResult =
      'Có nhiều card khớp "data", hỏi lại user chọn cái nào:\n' +
      '- "Data Engineer" tại Apollo Solutions VN (rejected, id=35dce134-345d-4f69-8a61-3e00687098cb)\n' +
      '- "Data Analyst" tại SUNJIN (applied, id=8f14e45f-ceea-467e-bd7e-1a234f5c6d7e)';
    const { container } = render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{ card: "data", status: "offer" }}
        status="complete"
        result={leakyResult}
      />,
    );
    expect(screen.getByText("Chưa chuyển được — xem trả lời bên dưới.")).toBeInTheDocument();
    expect(screen.queryByText("Offer")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("35dce134-345d-4f69-8a61-3e00687098cb");
    expect(container.textContent).not.toContain("8f14e45f-ceea-467e-bd7e-1a234f5c6d7e");
    expect(container.textContent).not.toContain(leakyResult);
  });
});
