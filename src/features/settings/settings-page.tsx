import { ChevronLeft, ChevronRight } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { isAlive } from "../../domain/model/base";
import {
  EXPIRING_DAY_OPTIONS,
  MAX_PREF_TEXT,
  type PrefKey,
  type PrefValues,
} from "../../domain/model/prefs";
import { describeError, type Session } from "../session/session";
import { localDate } from "../session/today";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Chip } from "../ui/chip";
import { ErrorText } from "../ui/error-text";
import { IconButton } from "../ui/icon-button";
import { MEMBER_COLOR_STYLE } from "../ui/member-color";
import { SwitchRow } from "../ui/switch-row";
import { LeaveSection } from "./leave-section";
import { Group, InlineTextRow, Row } from "./settings-group";
import type { SettingsStore } from "./store";

export interface SettingsPageProps {
  session: Session;
  store: SettingsStore;
  /** `update.version`: ISO do build, ou null. */
  version: string | null;
  onBack: () => void;
  onEditProfile: () => void;
  onOpenPlaces: () => void;
  onLeave: () => Promise<void>;
}

export function SettingsPage({
  session,
  store,
  version,
  onBack,
  onEditProfile,
  onOpenPlaces,
  onLeave,
}: SettingsPageProps) {
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Escrita lenta que termina depois de outra nao pode apagar o alerta da mais nova.
  const ticket = useRef(0);

  // Ao abrir (inclusive ao voltar do wizard) o foco vai ao titulo; o botao que abriu sumiu.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const me = session.localMember.value;
  const prefs = session.prefs.value;
  const { members, categories, locations } = session.data.value;
  const residents = members.filter(isAlive).sort((a, b) => {
    if (a.id === me?.id) return -1;
    if (b.id === me?.id) return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
  const stamp = version === null ? null : localDate(version);

  async function write<K extends PrefKey>(key: K, value: PrefValues[K]) {
    ticket.current += 1;
    const mine = ticket.current;
    try {
      await store.setPref(key, value);
      if (mine === ticket.current) setError(null);
    } catch (cause) {
      if (mine === ticket.current) setError(describeError(cause));
    }
  }

  const days = prefs.expiringDays;

  return (
    <main class="no-scrollbar px-[22px] pt-11 pb-7">
      {error !== null ? <ErrorText class="mb-3">{error}</ErrorText> : null}
      <div class="flex items-center gap-3">
        <IconButton label="Voltar" onClick={onBack}>
          <ChevronLeft size={20} strokeWidth={2.75} />
        </IconButton>
        <h1 ref={heading} tabIndex={-1} class="text-[32px]">
          Ajustes
        </h1>
      </div>

      {me !== null ? (
        <div class="mt-4 flex items-center gap-3.5 rounded-[32px] bg-surface p-4">
          <Avatar name={me.name} color={me.color} photo={me.photo} size={64} />
          <div class="min-w-0 flex-1">
            <div class="truncate font-heading text-[22px] leading-[1.1]">{me.name}</div>
            <div class="text-[12px] font-semibold text-neutral-700">
              Neste aparelho · {MEMBER_COLOR_STYLE[me.color].label}
            </div>
          </div>
          <Button variant="secondary" class="bg-bg" onClick={onEditProfile}>
            Editar
          </Button>
        </div>
      ) : null}

      <Group label="Casa">
        <InlineTextRow
          label="Nome da casa"
          value={prefs.houseName}
          fallback={`Casa de ${me?.name ?? "você"}`}
          maxLength={MAX_PREF_TEXT}
          onSave={(value) => store.setPref("houseName", value)}
        />
        <Row
          label="Moradores"
          tall
          trailing={
            <span class="flex">
              {residents.map((member, index) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  color={member.color}
                  photo={member.photo}
                  size={32}
                  class={`border-2 border-neutral-100 ${index > 0 ? "-ml-2" : ""}`}
                />
              ))}
            </span>
          }
        />
        <Row
          label="Categorias e locais"
          value={`${categories.filter(isAlive).length} · ${locations.filter(isAlive).length}`}
          trailing={
            <span class="text-neutral-500">
              <ChevronRight size={16} strokeWidth={2.75} />
            </span>
          }
          onClick={onOpenPlaces}
        />
      </Group>

      <Group label="Alertas">
        <SwitchRow
          label="Estoque baixo"
          hint="Quando um item fica abaixo do mínimo"
          checked={prefs.alertLow}
          onChange={(on) => void write("alertLow", on)}
        />
        <SwitchRow
          label="Vencimento próximo"
          hint={days === 1 ? "Avisar 1 dia antes" : `Avisar ${days} dias antes`}
          checked={prefs.alertExpiring}
          onChange={(on) => void write("alertExpiring", on)}
        />
        {prefs.alertExpiring ? (
          <fieldset
            aria-label="Dias de antecedência"
            class="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0 pb-3"
          >
            {EXPIRING_DAY_OPTIONS.map((n) => (
              <Chip
                key={n}
                label={n === 1 ? "1 dia" : `${n} dias`}
                active={days === n}
                onClick={() => void write("expiringDays", n)}
              />
            ))}
          </fieldset>
        ) : null}
        <SwitchRow
          label="Atividade da casa"
          hint="Quando outro morador usa ou compra algo"
          checked={prefs.alertActivity}
          onChange={(on) => void write("alertActivity", on)}
        />
      </Group>

      <Group label="Compras">
        <SwitchRow
          label="Gerar lista automaticamente"
          hint="Itens abaixo do mínimo entram sozinhos"
          checked={prefs.autoList}
          onChange={(on) => void write("autoList", on)}
        />
        <InlineTextRow
          label="Mercado preferido"
          value={prefs.preferredStore}
          fallback="Nenhum"
          maxLength={MAX_PREF_TEXT}
          onSave={(value) => store.setPref("preferredStore", value)}
        />
      </Group>

      <Group label="Dados">
        <Row
          label="Exportar estoque"
          value="CSV"
          trailing={
            <span class="text-neutral-500">
              <ChevronRight size={16} strokeWidth={2.75} />
            </span>
          }
          onClick={() => store.exportStock()}
        />
      </Group>

      <LeaveSection onLeave={onLeave} />

      <p class="mt-2.5 text-center text-[11px] text-neutral-600">
        {stamp === null ? "HomeStock" : `HomeStock · versão de ${stamp}`}
      </p>
    </main>
  );
}
