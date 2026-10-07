import { ScanBarcode } from "lucide-preact";
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import { itemWithEan } from "../../domain/model/ean";
import { ItemForm } from "../item/item-form";
import { RestockForm } from "../item/restock-form";
import { ScanView } from "./scan-view";

export interface AddItemPageProps {
  ctx: AppContext;
  /** "scan" (FAB) abre a camera ao montar; "item-new" (Estoque vazio) nao. */
  kind: "scan" | "item-new";
}

/** Pilula "Código {ean}": sem ela, a camera some e nada visivel diz o que aconteceu. */
function NewCodeNote({ ean }: { ean: string }) {
  return (
    <div
      role="status"
      class="mt-3 flex items-center gap-[10px] rounded-pill bg-surface py-2 pr-4 pl-2"
    >
      <span
        aria-hidden="true"
        class="grid size-9 flex-none place-items-center rounded-full bg-text text-bg"
      >
        <ScanBarcode size={18} strokeWidth={2.75} />
      </span>
      <div class="min-w-0">
        <p class="font-semibold text-[13px] text-text">Código {ean}</p>
        <p class="text-[11px] text-neutral-700">Item novo · preencha o nome</p>
      </div>
    </div>
  );
}

/**
 * Tela "Novo item" do 2d: o visor no topo e, abaixo, a reposicao (codigo de item
 * cadastrado) ou o formulario de criar. Uma tela so: o roteador nao tem `replace`,
 * e empilhar o formulario sobre o scanner faria o voltar cair na camera aberta.
 */
export function AddItemPage({ ctx, kind }: AddItemPageProps): JSX.Element {
  const { session } = ctx;
  const [foundId, setFoundId] = useState<Ulid | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [readOnce, setReadOnce] = useState(false);
  // Conta as leituras da camera: o mesmo codigo lido de novo ainda e uma leitura nova
  // (preenche o campo de novo ou recomeca a reposicao).
  const [scanSeq, setScanSeq] = useState(0);

  // A busca e sincrona sobre o snapshot em memoria: nao ha resposta atrasada a ignorar.
  function handleCode(ean: string, source: "camera" | "typed") {
    setReadOnce(true);
    if (source === "camera") setScanSeq((n) => n + 1);
    const hit = itemWithEan(session.data.value.items, ean);
    if (hit !== null) {
      setFoundId(hit.id);
      // A nota de codigo novo de uma leitura anterior ja nao vale.
      setScanned(null);
      return;
    }
    // Codigo digitado e desconhecido ja esta no campo: nao ha o que fazer.
    if (source === "camera") {
      setFoundId(null);
      setScanned(ean);
    }
  }

  // Apagado (aqui ou no sync) com a reposicao aberta: volta ao criar.
  const found =
    foundId === null
      ? null
      : (session.data.value.items.find((i) => i.id === foundId && isAlive(i)) ?? null);

  const scanView = (autoStart: boolean) => (
    <ScanView
      env={ctx.scanner}
      autoStart={autoStart}
      idleLabel={readOnce ? "Ler outro código" : "Ler código"}
      onCode={(ean) => handleCode(ean, "camera")}
    />
  );

  if (found !== null) {
    return (
      <RestockForm
        // Outro item, ou o mesmo lido de novo: remonta (valores do zero e foco no titulo).
        key={`${found.id}:${scanSeq}`}
        ctx={ctx}
        item={found}
        top={scanView(false)}
        screenKind={kind}
      />
    );
  }

  return (
    <ItemForm
      ctx={ctx}
      mode="create"
      screenKind={kind}
      top={
        <>
          {scanView(kind === "scan" && !readOnce)}
          {scanned !== null && <NewCodeNote ean={scanned} />}
        </>
      }
      scannedEan={scanned}
      scanSeq={scanSeq}
      onEanCommit={(ean) => handleCode(ean, "typed")}
      initialFocus={kind === "scan" && !readOnce ? "heading" : "name"}
    />
  );
}
