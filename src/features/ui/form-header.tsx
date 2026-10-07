import { X } from "lucide-preact";
import type { Ref } from "preact";
import { IconButton } from "./icon-button";

export interface FormHeaderProps {
  title: string;
  /** O titulo recebe o foco quando a tela abre ou troca de controles. */
  headingRef: Ref<HTMLHeadingElement>;
  /** Id do texto que o leitor de tela le junto ao focar o titulo. */
  describedBy?: string;
  onClose: () => void;
}

/** Cabecalho dos formularios de 2d: H1 26 focavel e "Fechar" (X 20). */
export function FormHeader({ title, headingRef, describedBy, onClose }: FormHeaderProps) {
  return (
    <div class="flex items-center justify-between">
      <h1 ref={headingRef} tabIndex={-1} aria-describedby={describedBy} class="text-[26px]">
        {title}
      </h1>
      <IconButton label="Fechar" onClick={onClose}>
        <X size={20} strokeWidth={2.75} />
      </IconButton>
    </div>
  );
}
