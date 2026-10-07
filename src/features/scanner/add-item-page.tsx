import { ScanBarcode } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useId, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import { itemWithEan } from "../../domain/model/ean";
import { ItemForm } from "../item/item-form";
import { RestockForm } from "../item/restock-form";
import { StatusPill } from "../ui/status-pill";
import { ScanView } from "./scan-view";

export interface AddItemPageProps {
  ctx: AppContext;
  /** "scan" (FAB) abre a camera ao montar; "item-new" (Estoque vazio) nao. */
  kind: "scan" | "item-new";
}

/** Pilula "Código {ean}": sem ela, a camera some e nada visivel diz o que aconteceu. */
function NewCodeNote({ ean, textId }: { ean: string; textId: string }) {
  return (
    <StatusPill
      tone="neutral"
      icon={<ScanBarcode size={18} strokeWidth={2.75} />}
      title={`Código ${ean}`}
      subtitle="Item novo · preencha o nome"
      textId={textId}
    />
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
  const noteId = useId();

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
    if (source === "camera") {
      setFoundId(null);
      setScanned(ean);
      return;
    }
    // Codigo digitado e desconhecido ja esta no campo; so a nota de outra leitura sai.
    if (ean !== scanned) setScanned(null);
  }

  // Apagado (aqui ou no sync) com a reposicao aberta: volta ao criar.
  const found =
    foundId === null
      ? null
      : (session.data.value.items.find((i) => i.id === foundId && isAlive(i)) ?? null);

  // Esquece o achado que sumiu: devolvido depois (desfazer, sync), nao reabre a
  // reposicao por cima do que a pessoa ja comecou a criar.
  useEffect(() => {
    if (foundId !== null && found === null) setFoundId(null);
  }, [foundId, found]);

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
          {scanned !== null && <NewCodeNote ean={scanned} textId={noteId} />}
        </>
      }
      scannedEan={scanned}
      scanSeq={scanSeq}
      nameDescribedBy={scanned !== null ? noteId : undefined}
      onEanCommit={(ean) => handleCode(ean, "typed")}
      initialFocus={kind === "scan" && !readOnce ? "heading" : "name"}
    />
  );
}
