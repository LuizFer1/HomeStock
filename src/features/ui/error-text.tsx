/** Mensagem de erro sob o campo ou a acao. `class` so ajusta a margem. */
export function ErrorText({ children, class: extra }: { children: string; class?: string }) {
  return (
    <p role="alert" class={`text-[13px] font-semibold text-accent-700 ${extra ?? ""}`}>
      {children}
    </p>
  );
}
