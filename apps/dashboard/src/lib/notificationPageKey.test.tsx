// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { notificationNav, useNotificationPageKey } from "./notificationLinks";

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={["/bot-messages?phone=1"]}>{children}</MemoryRouter>;
const setup = () => renderHook(() => ({ key: useNotificationPageKey(), navigate: useNavigate() }), { wrapper });

describe("useNotificationPageKey", () => {
  it("changes on each click on a notification, so the page opens what it points to", () => {
    const { result } = setup();
    const first = result.current.key;
    act(() => result.current.navigate("/bot-messages?phone=2", notificationNav()));
    const second = result.current.key;
    expect(second).not.toBe(first);
    act(() => result.current.navigate("/bot-messages?phone=3", { state: { fromNotification: Date.now() + 1 } }));
    expect(result.current.key).not.toBe(second);
  });

  it("stays the same on the page's own navigation", () => {
    const { result } = setup();
    act(() => result.current.navigate("/bot-messages?phone=2", notificationNav()));
    const key = result.current.key;
    act(() => result.current.navigate("/bot-messages?phone=9", { replace: true }));
    expect(result.current.key).toBe(key);
  });
});
