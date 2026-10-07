import { Camera, Image as ImageIcon } from "lucide-preact";
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { ItemDraft } from "../../data/repository";
import { DEFAULT_CATEGORY_ID } from "../../domain/defaults/seeds";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import {
  type Category,
  type Item,
  type Location,
  MAX_ITEM_NAME,
  MAX_ITEM_SIZE,
  MAX_ITEM_UNIT,
} from "../../domain/model/item";
import { isPhotoDataUrl } from "../../domain/model/member";
import { quantities } from "../../domain/projections/stock";
import { describeError } from "../session/session";
import { closeIfStill } from "../shell/route";
import { UnknownScreen } from "../shell/unknown-screen";
import { BTN_SECONDARY, Button, PICK_FOCUS } from "../ui/button";
import { CountStepper } from "../ui/count-stepper";
import { ErrorText } from "../ui/error-text";
import { FormHeader } from "../ui/form-header";
import { TextField } from "../ui/text-field";
import { initialOf, saveLabel } from "./labels";
import { PriceField } from "./price-field";

export interface ItemFormProps {
  ctx: AppContext;
  mode: "create" | "edit";
  /** Obrigatorio no modo edit. */
  id?: Ulid;
  /** Entre o cabecalho e a foto: o visor do scanner e a nota de codigo novo. */
  top?: ComponentChildren;
  /** Codigo lido pela camera: preenche o campo e leva o foco ao Nome. */
  scannedEan?: string | null;
  /** Conta as leituras: o mesmo codigo lido de novo ainda preenche o campo e foca o Nome. */
  scanSeq?: number;
  /** Id do texto que descreve o Nome (a nota de codigo novo): o leitor de tela o le ao focar. */
  nameDescribedBy?: string;
  /** Codigo de 8 a 14 digitos confirmado no campo (change: blur ou Enter). */
  onEanCommit?: (ean: string) => void;
  /** Criar: "name" (padrao) ou "heading" (camera abrindo: o teclado cobriria o visor). */
  initialFocus?: "name" | "heading";
  /** `kind` da tela para o closeIfStill; padrao "item-new" ou "item-edit" pelo modo. */
  screenKind?: "scan" | "item-new" | "item-edit";
}

interface FormValues {
  name: string;
  size: string;
  unit: string;
  /** "" = nenhuma categoria viva escolhida (a apagada nao vira chip). */
  categoryId: string;
  locationId: Ulid | null;
  qty: number;
  min: number;
  usualQty: number;
  expiresAt: string;
  ean: string;
  photo: string | null;
}

// `.field > label` do markup.
const LABEL = "mb-[5px] block text-[12px] text-text/70";
const EAN_MAX = 14;
// O input fica sr-only: o anel de foco aparece no label que o envolve.
const PICK = `${BTN_SECONDARY} ${PICK_FOCUS}`;
// Erros que o campo Nome resolve: o foco vai a ele, e nao a mensagem.
const NAME_ERRORS = new Set(["Dê um nome ao item.", `Use até ${MAX_ITEM_NAME} letras no nome.`]);

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, "pt-BR");
}

function initialValues(
  item: Item | undefined,
  qty: number,
  categories: readonly Category[],
  locations: readonly Location[],
): FormValues {
  if (item === undefined) {
    const preferred = categories.find((c) => c.id === DEFAULT_CATEGORY_ID);
    return {
      name: "",
      size: "",
      unit: "un",
      categoryId: preferred?.id ?? categories[0]?.id ?? "",
      locationId: null,
      qty: 1,
      min: 1,
      usualQty: 1,
      expiresAt: "",
      ean: "",
      photo: null,
    };
  }
  return {
    name: item.name,
    size: item.size,
    unit: item.unit,
    categoryId: categories.some((c) => c.id === item.categoryId) ? item.categoryId : "",
    // Local apagado vira "Nenhum": nao ha chip para ele.
    locationId: locations.some((l) => l.id === item.locationId) ? item.locationId : null,
    qty: Math.max(0, qty),
    min: item.min,
    usualQty: item.usualQty,
    expiresAt: item.expiresAt ?? "",
    ean: item.ean ?? "",
    // Foto fora do formato nao aparece no Detalhe e travaria o salvar.
    photo: isPhotoDataUrl(item.photo) ? item.photo : null,
  };
}

/** Campo com rotulo visivel (`.field` do markup); a reposicao usa o mesmo. */
export function Field(props: { id: string; label: string; children: ComponentChildren }) {
  return (
    <div class="min-w-0">
      <label htmlFor={props.id} class={LABEL}>
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function ChipGroup(props: {
  legend: string;
  options: readonly { id: string | null; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <fieldset class="m-0 min-w-0 border-0 p-0">
      <legend class={`${LABEL} p-0`}>{props.legend}</legend>
      <div class="flex flex-wrap gap-2">
        {props.options.map((option) => {
          const active = option.id === props.value;
          return (
            <button
              key={option.id ?? ""}
              type="button"
              aria-pressed={active}
              onClick={() => props.onChange(option.id)}
              class={`min-h-11 rounded-pill px-4 font-semibold text-[13px] ${
                active ? "bg-text text-bg" : "bg-surface text-text"
              }`}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Criar e editar item (markup 2d, linhas 334 a 378). */
export function ItemForm({
  ctx,
  mode,
  id,
  top,
  scannedEan,
  scanSeq,
  nameDescribedBy,
  onEanCommit,
  initialFocus,
  screenKind,
}: ItemFormProps): JSX.Element | null {
  const { session, router, items, toast } = ctx;
  const data = session.data.value;
  const create = mode === "create";

  const categories = data.categories.filter(isAlive).sort(byName);
  const locations = data.locations.filter(isAlive).sort(byName);
  const item = create ? undefined : data.items.find((i) => i.id === id && isAlive(i));

  // Uma vez so: o snapshot que muda por baixo (outra aba) nao apaga o que a pessoa digitou.
  const [initial] = useState(() =>
    initialValues(
      item,
      item === undefined ? 0 : (quantities(data.movements).get(item.id) ?? 0),
      categories,
      locations,
    ),
  );
  const [name, setName] = useState(initial.name);
  const [size, setSize] = useState(initial.size);
  const [unit, setUnit] = useState(initial.unit);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [locationId, setLocationId] = useState(initial.locationId);
  const [qty, setQty] = useState(initial.qty);
  const [min, setMin] = useState(initial.min);
  const [usualQty, setUsualQty] = useState(initial.usualQty);
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [ean, setEan] = useState(initial.ean);
  const [photo, setPhoto] = useState(initial.photo);
  // So no criar: a edicao nao mexe em preco.
  const [priceText, setPriceText] = useState("");
  const [priceMinor, setPriceMinor] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Conta cada falha: a mesma mensagem duas vezes ainda precisa mover o foco.
  const [failures, setFailures] = useState(0);
  const [busy, setBusy] = useState(false);
  // Foto escolhida ainda no pipeline: salvar agora gravaria sem ela.
  const [photoBusy, setPhotoBusy] = useState(false);

  // Ref e nao estado: dois toques no mesmo render leem o mesmo `busy` velho.
  const submitting = useRef(false);
  // A pagina do scanner pode trocar o formulario pela reposicao durante a gravacao:
  // a tela nao fecha por baixo dela.
  const mounted = useRef(true);
  // Escolher de novo ou "Remover foto" invalida a escolha em voo.
  const pickTicket = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const nameId = useId();
  const sizeId = useId();
  const unitId = useId();
  const expiresId = useId();
  const eanId = useId();
  const priceId = useId();

  useEffect(() => {
    // Criar: o nome e o primeiro passo, o teclado ja abre nele. Editar: o titulo,
    // porque o botao que abriu a tela sumiu.
    // Com a camera abrindo, o teclado cobriria o visor: o foco vai ao titulo.
    if (create && initialFocus !== "heading") document.getElementById(nameId)?.focus();
    else heading.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  // Depois do foco inicial: codigo lido preenche o campo e o foco segue para o Nome.
  useEffect(() => {
    if (scannedEan === undefined || scannedEan === null || scannedEan === "") return;
    setEan(scannedEan);
    document.getElementById(nameId)?.focus();
  }, [scannedEan, scanSeq]);

  useEffect(() => {
    if (failures === 0 || error === null) return;
    if (NAME_ERRORS.has(error)) document.getElementById(nameId)?.focus();
    else errorBox.current?.focus();
  }, [failures]);

  // Apagado em outro lugar (ou sem id): nada a editar, volta.
  if (!create && item === undefined) return <UnknownScreen onBack={router.back} />;

  const nameEmpty = name.trim() === "";
  const kind = screenKind ?? (create ? "item-new" : "item-edit");

  async function pick(event: JSX.TargetedEvent<HTMLInputElement, Event>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    pickTicket.current += 1;
    const ticket = pickTicket.current;
    setPhotoBusy(true);
    try {
      const next = await ctx.processItemPhoto(file);
      if (ticket !== pickTicket.current) return;
      setPhoto(next);
      setPhotoError(null);
    } catch (cause) {
      if (ticket === pickTicket.current) setPhotoError(describeError(cause));
    } finally {
      // Sem isso, escolher o mesmo arquivo de novo nao dispara `change`.
      input.value = "";
      if (ticket === pickTicket.current) setPhotoBusy(false);
    }
  }

  function removePhoto() {
    pickTicket.current += 1;
    setPhoto(null);
    setPhotoError(null);
    setPhotoBusy(false);
    // O botao some com a foto: o foco segue para a Galeria, ao lado.
    galleryInput.current?.focus();
  }

  async function submit() {
    if (submitting.current || nameEmpty || photoBusy) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    // Lido antes do await: o voltar do sistema pode desempilhar durante a gravacao.
    const depth = router.stack.value.length;
    const draft: ItemDraft = {
      name,
      size,
      unit,
      categoryId,
      locationId,
      min,
      usualQty,
      expiresAt: expiresAt === "" ? null : expiresAt,
      ean: ean.trim() === "" ? null : ean,
      photo,
    };
    try {
      if (create) {
        const saved = await items.create(draft, qty, priceMinor);
        toast.show(`${saved.name} guardado`);
      } else if (id !== undefined) {
        await items.save(id, draft, qty === initial.qty ? null : qty);
      }
      // A tela sai: a trava fica fechada para um toque perdido nao gravar de novo.
      if (mounted.current) closeIfStill(router, depth, kind);
    } catch (cause) {
      submitting.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setError(describeError(cause));
      setFailures((n) => n + 1);
    }
  }

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const locationOptions = [
    { id: null, name: "Nenhum" },
    ...locations.map((l) => ({ id: l.id, name: l.name })),
  ];

  const eanField = (
    <Field id={eanId} label="Código de barras">
      <TextField
        dense
        id={eanId}
        inputMode="numeric"
        autoComplete="off"
        maxLength={EAN_MAX}
        value={ean}
        onInput={(event) => setEan(event.currentTarget.value)}
        onChange={(event) => {
          const digits = event.currentTarget.value.replace(/\s+/g, "");
          if (/^\d{8,14}$/.test(digits)) onEanCommit?.(digits);
        }}
      />
    </Field>
  );

  return (
    <main class="min-h-dvh bg-bg px-[22px] pt-11 pb-6">
      <FormHeader
        title={create ? "Novo item" : "Editar item"}
        headingRef={heading}
        onClose={router.back}
      />

      {top}

      <div class="mt-3 flex items-center gap-3">
        <div class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[24px] bg-accent">
          {photo !== null ? (
            <img src={photo} alt="Foto do item" class="washed size-full object-cover" />
          ) : (
            <span aria-hidden="true" class="font-heading text-[40px] text-bg leading-none">
              {initialOf(name)}
            </span>
          )}
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <label class={PICK}>
            <Camera size={18} strokeWidth={2.75} />
            Câmera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              onChange={(event) => void pick(event)}
            />
          </label>
          <label class={PICK}>
            <ImageIcon size={18} strokeWidth={2.75} />
            Galeria
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              class="sr-only"
              onChange={(event) => void pick(event)}
            />
          </label>
          {photo !== null && (
            <Button variant="ghost" onClick={removePhoto}>
              Remover foto
            </Button>
          )}
        </div>
      </div>
      {photoError !== null && <ErrorText class="mt-2">{photoError}</ErrorText>}

      <div class="mt-4 flex flex-col gap-3">
        <Field id={nameId} label="Nome">
          <TextField
            dense
            id={nameId}
            aria-describedby={nameDescribedBy}
            maxLength={MAX_ITEM_NAME}
            value={name}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </Field>
        <div class="grid grid-cols-2 gap-[10px]">
          <Field id={sizeId} label="Tamanho">
            <TextField
              dense
              id={sizeId}
              placeholder="1 kg"
              maxLength={MAX_ITEM_SIZE}
              value={size}
              onInput={(event) => setSize(event.currentTarget.value)}
            />
          </Field>
          <Field id={unitId} label="Unidade">
            <TextField
              dense
              id={unitId}
              placeholder="un"
              maxLength={MAX_ITEM_UNIT}
              value={unit}
              onInput={(event) => setUnit(event.currentTarget.value)}
            />
          </Field>
        </div>
        <CountStepper label="Quantidade" value={qty} min={create ? 1 : 0} onChange={setQty} />
        <CountStepper
          label="Mínimo"
          hint="Abaixo disso entra na lista"
          value={min}
          min={0}
          onChange={setMin}
        />
        <CountStepper
          label="Compra usual"
          hint="Quanto comprar de cada vez"
          value={usualQty}
          min={1}
          onChange={setUsualQty}
        />
        <div class="grid grid-cols-2 gap-[10px]">
          <Field id={expiresId} label="Validade">
            <TextField
              dense
              id={expiresId}
              type="date"
              value={expiresAt}
              onInput={(event) => setExpiresAt(event.currentTarget.value)}
            />
          </Field>
          {create ? (
            <Field id={priceId} label="Preço unitário">
              <PriceField
                id={priceId}
                value={priceText}
                onChange={(text, minor) => {
                  setPriceText(text);
                  setPriceMinor(minor);
                }}
              />
            </Field>
          ) : (
            eanField
          )}
        </div>
        {create && eanField}
        <ChipGroup
          legend="Categoria"
          options={categoryOptions}
          value={categoryId}
          onChange={(next) => setCategoryId(next ?? "")}
        />
        <ChipGroup
          legend="Local"
          options={locationOptions}
          value={locationId}
          onChange={setLocationId}
        />
      </div>

      {error !== null && (
        // Alvo do foco quando o erro nao e de um campo: o leitor de tela le a mensagem.
        <div ref={errorBox} tabIndex={-1} class="mt-4">
          <ErrorText alert={NAME_ERRORS.has(error)}>{error}</ErrorText>
        </div>
      )}
      {photoBusy && <p class="mt-4 text-center text-[12px] text-neutral-700">Preparando a foto…</p>}

      <Button
        block
        class="mt-[14px] min-h-[52px] text-[16px]"
        disabled={nameEmpty || busy || photoBusy}
        onClick={() => void submit()}
      >
        {create ? saveLabel(qty, unit, priceMinor) : "Salvar"}
      </Button>
    </main>
  );
}
