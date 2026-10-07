import { describe, expect, it } from "vitest";
import { isPhotoDataUrl, type MemberDraft, normalizeMemberDraft } from "./member";

const ok: MemberDraft = { name: "Ana", color: "salvia", photo: null };

describe("normalizeMemberDraft", () => {
  it("faz trim do nome", () => {
    expect(normalizeMemberDraft({ ...ok, name: "  Ana  " }).name).toBe("Ana");
  });

  it("recusa nome vazio ou so espacos", () => {
    expect(() => normalizeMemberDraft({ ...ok, name: "" })).toThrow("Informe seu nome.");
    expect(() => normalizeMemberDraft({ ...ok, name: "   " })).toThrow("Informe seu nome.");
  });

  it("recusa nome com 41 caracteres", () => {
    expect(() => normalizeMemberDraft({ ...ok, name: "a".repeat(41) })).toThrow(
      "Use até 40 letras no nome.",
    );
    expect(normalizeMemberDraft({ ...ok, name: "a".repeat(40) }).name).toHaveLength(40);
  });

  it("recusa cor desconhecida", () => {
    expect(() => normalizeMemberDraft({ ...ok, color: "rosa" as never })).toThrow(
      "Cor desconhecida.",
    );
  });

  it("recusa foto svg e url remota", () => {
    for (const photo of ["data:image/svg+xml;base64,AAAA", "https://x.com/a.png"]) {
      expect(() => normalizeMemberDraft({ ...ok, photo })).toThrow("Formato de foto não aceito.");
    }
  });

  it("aceita foto webp", () => {
    const photo = "data:image/webp;base64,AAAA";
    expect(normalizeMemberDraft({ ...ok, photo }).photo).toBe(photo);
  });
});

describe("isPhotoDataUrl", () => {
  it("null nao e foto", () => {
    expect(isPhotoDataUrl(null)).toBe(false);
  });
});
