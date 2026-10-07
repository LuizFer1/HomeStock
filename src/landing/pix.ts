/** Campo EMV: id + tamanho em 2 digitos + valor. */
export function pixField(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

/** CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 digitos hex maiusculos. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixRequest {
  key: string;
  name: string; // ASCII, 1 a 25
  city: string; // ASCII, 1 a 15
  amount: number; // > 0, em reais
}

// Printaveis ASCII: o BR Code nao aceita acento e o tamanho conta caracteres.
const ASCII = /^[\x20-\x7e]+$/;

/** BR Code estatico com valor. Lanca (mensagem interna, sem acento) fora dos limites. */
export function pixPayload(req: PixRequest): string {
  const { key, name, city, amount } = req;
  if (key.length === 0 || key.length > 77) throw new Error("pix: chave invalida");
  if (!ASCII.test(name) || name.length > 25) throw new Error("pix: nome invalido");
  if (!ASCII.test(city) || city.length > 15) throw new Error("pix: cidade invalida");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("pix: valor invalido");

  const body =
    pixField("00", "01") +
    pixField("26", pixField("00", "br.gov.bcb.pix") + pixField("01", key)) +
    pixField("52", "0000") +
    pixField("53", "986") +
    pixField("54", amount.toFixed(2)) +
    pixField("58", "BR") +
    pixField("59", name) +
    pixField("60", city) +
    pixField("62", pixField("05", "***")) +
    // O CRC cobre tudo ate o proprio id e tamanho ("6304"), inclusive.
    "6304";
  return body + crc16(body);
}
