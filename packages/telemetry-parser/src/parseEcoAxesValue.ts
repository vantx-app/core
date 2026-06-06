export function parseEcoAxesValue(val: any): number | null {
  if (val === undefined || val === null) return null;
  try {
    const bigVal = BigInt(val);
    if (bigVal > 65535n) {
      // 8-byte packed axes value containing signed 16-bit components (in milli-G)
      const rawZ = Number(bigVal & 0xffffn);
      const rawY = Number((bigVal >> 16n) & 0xffffn);
      const rawX = Number((bigVal >> 32n) & 0xffffn);

      const toSigned16 = (u16: number) => (u16 & 0x8000 ? u16 - 0x10000 : u16);

      const x = Math.abs(toSigned16(rawX));
      const y = Math.abs(toSigned16(rawY));
      const z = Math.abs(toSigned16(rawZ));

      return Math.max(x, y, z);
    }
    // Legacy centi-G value, multiply by 10 to convert to milli-G
    return Number(val) * 10;
  } catch {
    return Number(val) * 10;
  }
}
