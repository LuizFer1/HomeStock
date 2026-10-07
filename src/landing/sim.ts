// Simulacao do app no hero: tudo o que a tela mostra e funcao pura do passo.
// Sem DOM aqui; o sim-view.ts so aplica o quadro.

export const STEPS = 11;
export const STEP_MS = 2000;
export const POP_MS = 260;

export type SimScreen = "home" | "scan" | "list";
export type MsgKey = "leite" | "sabao" | "scan" | "cafe" | "list";

/** Passo inicial de cada aba. */
export const TAB_START: Record<SimScreen, number> = { home: 0, scan: 3, list: 7 };

export function nextStep(step: number): number {
  return (step + 1) % STEPS;
}

export function msgKey(step: number): MsgKey {
  if (step === 0) return "leite";
  if (step <= 2) return "sabao";
  if (step <= 5) return "scan";
  if (step === 6) return "cafe";
  return "list";
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number): string {
  return brl.format(value);
}

export interface HomeRow {
  letter: "C" | "S" | "I";
  name: string;
  note: string;
  qty: string;
  tone: "warn" | "ok" | "out" | "info";
  highlight: "none" | "warn" | "ok";
}

export interface SimFrame {
  step: number;
  screen: SimScreen;
  pct: number;
  ringDash: string;
  value: string;
  acabando: number;
  naLista: number;
  rows: [HomeRow, HomeRow, HomeRow];
  fabPulse: boolean;
  scanFound: boolean;
  savePressed: boolean;
  checked: number;
  listDone: string;
  listWidth: string;
  listLeft: string;
  msg: MsgKey;
  msgTitle: string;
  msgSub: string;
}

/** Precos da lista de compras em centavos: somar inteiros evita erro de ponto flutuante. */
const LIST_CENTS = [3490, 897, 3540, 799, 650];
const LIST_SIZE = LIST_CENTS.length;
/** Circunferencia do anel (r 38 em viewBox 92) arredondada, como no handoff. */
const RING = 239;

function screenOf(step: number): SimScreen {
  if (step >= 3 && step <= 5) return "scan";
  if (step >= 7) return "list";
  return "home";
}

function message(step: number, checked: number): { title: string; sub: string } {
  switch (msgKey(step)) {
    case "leite":
      return { title: "Leite vence em 3 dias", sub: "vocês usam ~3 até lá" };
    case "sabao":
      return { title: "Rafa usou o último sabão", sub: "já entrou na lista" };
    case "scan":
      return { title: "Lendo código de barras", sub: "Café em grãos 1 kg" };
    case "cafe":
      return { title: "Ana guardou 2 cafés", sub: "estoque em dia de novo" };
    case "list":
      return { title: `Lista: ${checked} de ${LIST_SIZE} comprados`, sub: "Rafa está no mercado" };
  }
}

export function simFrame(step: number): SimFrame {
  const sabao = step >= 1 ? 0 : 1;
  const cafe = step >= 6 ? 3 : 1;
  const pct = cafe >= 3 ? 86 : sabao === 0 ? 80 : 82;
  const cents = 128450 - (sabao === 0 ? 3490 : 0) + (cafe >= 3 ? 8580 : 0);
  const checked = step >= 7 ? step - 7 : 0;
  const leftCents = LIST_CENTS.slice(checked).reduce((a, b) => a + b, 0);
  const msg = message(step, checked);

  return {
    step,
    screen: screenOf(step),
    pct,
    ringDash: `${Math.round((RING * pct) / 100)} ${RING}`,
    value: formatBRL(cents / 100),
    acabando: 3 + (sabao === 0 ? 1 : 0) + (cafe < 2 ? 1 : 0),
    naLista: 5 + (sabao === 0 ? 1 : 0),
    rows: [
      {
        letter: "C",
        name: "Café em grãos",
        note: cafe < 2 ? "Abaixo do mínimo" : "Reposto agora",
        qty: `${cafe} pct`,
        tone: cafe < 2 ? "warn" : "ok",
        highlight: step === 6 ? "ok" : "none",
      },
      {
        letter: "S",
        name: "Sabão em pó",
        note: sabao ? "Último pacote" : "Esgotado · na lista",
        qty: `${sabao} un`,
        tone: sabao ? "warn" : "out",
        highlight: step === 1 || step === 2 ? "warn" : "none",
      },
      {
        letter: "I",
        name: "Iogurte natural",
        note: "Vence amanhã",
        qty: "2 un",
        tone: "info",
        highlight: "none",
      },
    ],
    fabPulse: step === 2,
    scanFound: step >= 4,
    savePressed: step === 5,
    checked,
    listDone: `${checked} de ${LIST_SIZE}`,
    listWidth: `${checked * (100 / LIST_SIZE)}%`,
    listLeft: formatBRL(leftCents / 100),
    msg: msgKey(step),
    msgTitle: msg.title,
    msgSub: msg.sub,
  };
}
