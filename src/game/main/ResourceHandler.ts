// Port of com.hz.main.ResourceHandler: lookups into the packed .pd/.pn resource files.
import { DataInputStream } from '../common/DataStream';
import { binarySearch } from '../common/Tool';
import { NAME_SUFFIX_PAGE_DATA, NAME_SUFFIX_PAGE_NAME, NAME_SUFFIX_PNG, PATH_ANI, PATH_MAP, getFileByte } from '../common/Utilities';

const ANI_PNG_PAK = 19;
export const PACKAGE_DATA_MAP = 1;
export const PACKAGE_DATA_FR = 3;

/** Map images/palettes sent by the server, keyed by id (palettes at setPlKey(..)+10000). */
export const mapImage = new Map<number, Uint8Array>();
export let packFrData: Uint8Array[] | null = null;
export let packFrIDList: number[] | null = null;
export let packImgData: Uint8Array[] | null = null;
export let packImgIDList: number[] | null = null;

function getAniPlPakIDByIndex(i: number): number {
  if (i < 6000) return 200;
  if (i < 8000) return 201;
  if (i < 8385) return 202;
  if (i < 10000) return 203;
  return i < 20000 ? 204 : -1;
}

function getAniPngPakIDByIndex(i: number): number {
  if (i < 2000) return 10;
  if (i < 4000) return 11;
  if (i < 5000) return 12;
  if (i < 6000) return 13;
  if (i < 7000) return 14;
  if (i < 8000) return 15;
  if (i < 8065) return 30;
  if (i < 8129) return 31;
  if (i < 8193) return 32;
  if (i < 8257) return 33;
  if (i < 8321) return 34;
  if (i < 8385) return 35;
  if (i < 8449) return 36;
  if (i < 8513) return 37;
  if (i < 8577) return 38;
  if (i < 8641) return 39;
  if (i < 8705) return 40;
  if (i < 8833) return 41;
  if (i < 12000) return 16;
  if (i < 14000) return i >= 12117 ? 22 : 17;
  if (i < 14061) return 18;
  if (i < 14125) return 49;
  if (i < 15000) return 48;
  if (i < 16000) return 19;
  if (i < 17000) return 20;
  if (i < 18082) return 21;
  if (i < 19000) return 23;
  return i < 20000 ? 24 : -1;
}

function getAniSprPakIDByIndex(i: number): number {
  if (i < 100) return 50;
  if (i < 200) return 100;
  if (i < 300) return 101;
  if (i < 400) return 102;
  if (i < 500) return 103;
  if (i < 600) return 104;
  if (i < 621) return 105;
  if (i < 700) return 98;
  if (i < 800) return 106;
  if (i < 1100) return 109;
  if (i < 1300) return 107;
  if (i < 1400) return 108;
  if (i >= 2000 && i < 4000) {
    const p = ((i - 2000) / 100 | 0) + 120;
    if (p !== 129 || i < 2963 || i >= 3000) return p;
    return 130;
  }
  if (i < 30000 || i >= 34999) return -1;
  const p = ((i - 30000) / 100 | 0) + 150;
  if (p !== 154 || i < 30463 || i >= 30500) return p;
  return 180;
}

export function isNeedChangeColorId(i: number): boolean {
  if (i < 11000) return true;
  if (i >= 30000 && i < 32000) return true;
  if (i < 12000 || i >= 13000) return i >= 14000 && i < 15000;
  return true;
}

export function loadAllIDList(): void {
  packImgIDList = loadPackageName(PATH_MAP, PACKAGE_DATA_MAP);
  packFrIDList = loadPackageName(PATH_ANI, PACKAGE_DATA_FR);
  packFrData = loadPackageData(PATH_ANI, PACKAGE_DATA_FR);
}

export function loadMapPackData(): void {
  packImgData = loadPackageData(PATH_MAP, PACKAGE_DATA_MAP);
}

export function loadPackageData(dir: string, i: number): Uint8Array[] | null {
  const b = getFileByte(dir + i + NAME_SUFFIX_PAGE_DATA);
  if (!b) return null;
  try {
    return formBytesPackData(new DataInputStream(b));
  } catch {
    return null;
  }
}

export function loadPackageName(dir: string, i: number): number[] | null {
  const b = getFileByte(dir + i + NAME_SUFFIX_PAGE_NAME);
  if (!b) return null;
  try {
    return formBytesPackName(new DataInputStream(b));
  } catch {
    return null;
  }
}

function formBytesPackData(dis: DataInputStream): Uint8Array[] {
  const n = dis.readShort();
  const out: Uint8Array[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = new Uint8Array(dis.readShort());
    dis.readFully(out[i]);
  }
  return out;
}

function formBytesPackName(dis: DataInputStream): number[] {
  const n = dis.readShort();
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = dis.readShort();
  return out;
}

export function getPackImageData(data: Uint8Array[] | null, ids: number[] | null, id: number): Uint8Array | null {
  if (!data || data.length <= 0) return null;
  const k = binarySearch(ids, id);
  return k < 0 ? null : data[k];
}

export function getAniPlDataInPack(i: number): Uint8Array | null {
  const pak = getAniPlPakIDByIndex(i);
  return pak < 0 ? null : getAniData(i, pak, PATH_ANI);
}

export function getAniPngDataInPack(i: number): Uint8Array | null {
  const pak = getAniPngPakIDByIndex(i);
  if (pak !== ANI_PNG_PAK) return pak < 0 ? null : getAniData(i, pak, PATH_ANI);
  return getFileByte(PATH_ANI + i + NAME_SUFFIX_PNG);
}

export function getAniSprDataInPack(i: number): Uint8Array | null {
  const pak = getAniSprPakIDByIndex(i);
  return pak < 0 ? null : getAniData(i, pak, PATH_ANI);
}

/** Pack file of a resource id, so the web loader can preload it (not in Java). */
export function aniPakFiles(id: number): string[] {
  const out: string[] = [];
  const png = getAniPngPakIDByIndex(id);
  out.push(png === ANI_PNG_PAK ? PATH_ANI + id + NAME_SUFFIX_PNG : PATH_ANI + png + NAME_SUFFIX_PAGE_DATA);
  const pl = getAniPlPakIDByIndex(id);
  if (pl >= 0) out.push(PATH_ANI + pl + NAME_SUFFIX_PAGE_DATA);
  return out;
}

export function sprPakFile(id: number): string | null {
  const p = getAniSprPakIDByIndex(id);
  return p < 0 ? null : PATH_ANI + p + NAME_SUFFIX_PAGE_DATA;
}

/** .pd layout: short n, short ids[n], short m, u16 offsets[m], then the concatenated blobs. */
export function getAniData(i: number, pak: number, dir: string): Uint8Array | null {
  const b = getFileByte(dir + pak + NAME_SUFFIX_PAGE_DATA);
  if (!b) return null;
  try {
    const dis = new DataInputStream(b);
    const k = binarySearch(formBytesPackName(dis), i);
    if (k < 0) return null;
    const offs = formBytesPackName(dis);
    const start = offs[k] & 0xffff;
    const out = new Uint8Array((offs[k + 1] & 0xffff) - start);
    dis.skip(start);
    dis.readFully(out);
    return out;
  } catch {
    return null;
  }
}
