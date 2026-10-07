import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Member } from "../../domain/model/member";
import { fakeItem } from "../../domain/model/row.fake";
import type { ActivityAlert, ExpiryAlert, StockAlert } from "../../domain/projections/alerts";
import { AlertCard, type AlertCardProps } from "./alert-card";

afterEach(cleanup);

const exp: ExpiryAlert = {
  kind: "exp",
  key: "exp:x:2026-10-07",
  resolveKeys: ["exp:x:2026-10-07"],
  group: "today",
  resolved: false,
  item: fakeItem({ name: "Iogurte natural" }),
  qty: 2,
  daysLeft: 1,
};

const low: StockAlert = {
  kind: "low",
  key: "low:x:start",
  resolveKeys: ["low:x:start"],
  group: "today",
  resolved: false,
  item: fakeItem(),
  qty: 1,
  since: "2026-10-06T08:00:00.000Z",
  sinceMovement: null,
  onList: false,
  average: null,
};

const activity: ActivityAlert = {
  kind: "activity",
  key: "activity:use:RAFA:2026-10-06",
  resolveKeys: ["act:1"],
  group: "today",
  resolved: false,
  activity: "use",
  actorId: "RAFA",
  day: "2026-10-06",
  at: "2026-10-06T12:00:00.000Z",
  entries: [],
};

const RAFA = { id: "RAFA", name: "Rafa", color: "salvia", photo: null } as unknown as Member;

function show(overrides: Partial<AlertCardProps> = {}) {
  const props: AlertCardProps = {
    alert: exp,
    title: "Iogurte natural vence amanhã",
    meta: "2 un · Geladeira",
    action: { kind: "use", label: "Marcar como usado" },
    busy: false,
    error: null,
    onAction: vi.fn(),
    ...overrides,
  };
  const view = render(
    <ul>
      <AlertCard {...props} />
    </ul>,
  );
  return { props, view };
}

describe("AlertCard", () => {
  it("vencimento pendente: icone accent-2, texto e botao que chama onAction", () => {
    const { props, view } = show();
    expect(view.container.querySelector(".bg-accent-2-200")).not.toBeNull();
    expect(screen.getByText("Iogurte natural vence amanhã")).toBeTruthy();
    expect(screen.getByText("2 un · Geladeira")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar como usado, Iogurte natural vence amanhã" }),
    );
    expect(props.onAction).toHaveBeenCalledTimes(1);
    const li = view.container.querySelector("li");
    expect(li?.getAttribute("data-alert-key")).toBe(exp.key);
    expect(li?.className).not.toContain("opacity-[0.55]");
  });

  it("resolvido: opacidade, tag Resolvido e sem botao", () => {
    const { view } = show({ alert: { ...exp, resolved: true }, action: null });
    expect(view.container.querySelector("li")?.className).toContain("opacity-[0.55]");
    expect(screen.getByText("Resolvido")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("estoque usa o tom accent", () => {
    const { view } = show({ alert: low, title: "Café abaixo do mínimo" });
    expect(view.container.querySelector(".bg-accent-200")).not.toBeNull();
    expect(view.container.querySelector(".bg-accent-2-200")).toBeNull();
  });

  it("atividade mostra o avatar do morador", () => {
    show({ alert: activity, actor: RAFA, title: "Rafa usou 1 pct de Café" });
    expect(screen.getByRole("img", { name: "Rafa", hidden: true })).toBeTruthy();
  });

  it("busy desabilita o botao", () => {
    show({ busy: true });
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("erro aparece como alerta", () => {
    show({ error: "Falhou." });
    expect(screen.getByRole("alert").textContent).toBe("Falhou.");
  });
});
