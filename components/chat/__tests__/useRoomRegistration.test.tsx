import { renderHook, waitFor } from "@testing-library/react";

import { useRoomRegistration } from "../useRoomRegistration";
import { chatApi } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  chatApi: { createRoom: jest.fn() },
}));

const createRoom = chatApi.createRoom as jest.Mock;

const ROOM = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Tìm job",
  created_at: "2026-07-11T00:00:00",
  updated_at: "2026-07-11T00:00:00",
  last_message: null,
};

beforeEach(() => {
  createRoom.mockReset();
  createRoom.mockResolvedValue(ROOM);
});

it("không gọi API khi chưa có tin nhắn user nào", () => {
  renderHook(() =>
    useRoomRegistration({
      token: "t",
      threadId: ROOM.id,
      firstUserMessage: null,
      onRoomCreated: jest.fn(),
    }),
  );
  expect(createRoom).not.toHaveBeenCalled();
});

it("đăng ký room với đúng threadId và title cắt từ tin nhắn đầu", async () => {
  const onRoomCreated = jest.fn();
  renderHook(() =>
    useRoomRegistration({
      token: "t",
      threadId: ROOM.id,
      firstUserMessage: "Tìm job Data Engineer ở HCM",
      onRoomCreated,
    }),
  );

  await waitFor(() => expect(createRoom).toHaveBeenCalledTimes(1));
  expect(createRoom).toHaveBeenCalledWith("t", {
    id: ROOM.id,
    title: "Tìm job Data Engineer ở HCM",
  });
  await waitFor(() => expect(onRoomCreated).toHaveBeenCalledWith(ROOM));
});

it("chỉ đăng ký MỘT lần dù rerender nhiều lần", async () => {
  const { rerender } = renderHook(
    (msg: string) =>
      useRoomRegistration({
        token: "t",
        threadId: ROOM.id,
        firstUserMessage: msg,
        onRoomCreated: jest.fn(),
      }),
    { initialProps: "Tìm job" },
  );

  await waitFor(() => expect(createRoom).toHaveBeenCalledTimes(1));
  rerender("Tìm job");
  rerender("Tìm job");
  expect(createRoom).toHaveBeenCalledTimes(1);
});

it("cắt title dài quá 60 ký tự", async () => {
  const long = "a".repeat(80);
  renderHook(() =>
    useRoomRegistration({
      token: "t",
      threadId: ROOM.id,
      firstUserMessage: long,
      onRoomCreated: jest.fn(),
    }),
  );
  await waitFor(() => expect(createRoom).toHaveBeenCalled());
  expect(createRoom.mock.calls[0][1].title).toBe("a".repeat(60) + "...");
});

it("API lỗi thì nuốt lặng — chat vẫn phải chạy", async () => {
  createRoom.mockRejectedValue(new Error("boom"));
  const onRoomCreated = jest.fn();
  renderHook(() =>
    useRoomRegistration({
      token: "t",
      threadId: ROOM.id,
      firstUserMessage: "Tìm job",
      onRoomCreated,
    }),
  );
  await waitFor(() => expect(createRoom).toHaveBeenCalled());
  expect(onRoomCreated).not.toHaveBeenCalled();
});
