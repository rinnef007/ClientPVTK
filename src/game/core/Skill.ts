// The parts of com.hz.core.Skill and com.hz.core.Define (Vineflower / jadx decompiles) the skill
// tab reads: a skill's name, level, type and its description (Skill.getDesc with
// Define.getPowerDesc and Utilities.composeString). Skills come from the server
// (Skill.fromBaseBytes); offline they are demo data. getPowerDesc is ported for the 118 cases that
// follow the plain "Name+value[suffix]" form; the other 79 (states, revive, item effects…) are not.
import { isNullText } from '../common/Tool';
import { uiFont } from '../gui/GWidget';
import { PowerString } from '../string/PowerString';

export const SKILL_TYPE_PASSIVE = 1;
export const SKILL_TYPE_AUTO = 2;
export const SKILL_TYPE_ACTIVE = 3;
export const SKILL_TYPE_FORMATION = 4;

/** Define.skillTypeText (GameText.STR_PASSIVE_SKILL / STR_ROUND_SKILL_TITLE / STR_ACTIVE_SKILL). */
const SKILL_TYPE_TEXT = ['', 'Bị động', 'Tự động', 'Chủ động', 'Lãng quên'];
const SKILL_WEAPON_TEXT = ['Không hạn chế', 'Tay không, Loại kiếm, Loại đao, Vũ khí nặng, Vũ khí dài', 'Kiếm nhẹ, Đao nhẹ', 'Kiếm nặng, Đao nặng, Vũ khí nặng, Vũ khí dài', 'Nỏ nhẹ, Nỏ nặng, Cung', 'Vũ khí đơn thủ hoặc tay không', 'Hạn chế kiếm đơn thủ', 'Hạn chế cầm 2 kiếm đơn thủ', 'Hạn chế kiếm nặng', 'Hạn chế đao', 'Hạn chế cầm 2 đao đơn thủ', 'Hạn chế đao nặng', 'Hạn chế vũ khí nặng', 'Hạn chế vũ khí dài', 'Nỏ nhẹ, Nỏ nặng', 'Hạn chế cầm 2 nỏ nhẹ', 'Hạn chế nỏ nặng', 'Cung', 'Tay không', 'Trượng', 'Hạn chế kiếm', 'Hạn chế đao đơn thủ', 'Hạn chế pháp khí', 'Súng Nhẹ, Súng Nặng', 'Súng Nhẹ', 'Súng Nặng', 'Khinh Chùy, Trọng Chùy', 'Khinh Chùy', 'Trọng Chùy', 'Quạt'];
const SKILL_AREA_TEXT = ['Đơn thể', '2 người trước sau', '2 người trên dưới', '3 người trên dưới', '4 người trên dưới', '5 người trên dưới', 'Chữ thập', 'Hình vuông', 'Đường thẳng 6 người', 'Toàn bộ', '1 địch', '2 địch trước sau', '2 địch trên dưới', '3 địch trên dưới', '4 địch trên dưới', '5 địch trên dưới', 'Chữ thập địch', 'Hình vuông địch', 'Đường thẳng 6 địch', 'Toàn bộ địch', 'Bản thân', '2 người trước sau mình', '2 người trên dưới mình', '3 người trên dưới mình', '4 người trên dưới mình', '5 người trên dưới mình', 'Chữ thập', 'Hình vuông', 'Đường thẳng 6 người', 'Toàn bộ', 'Tự thân', 'Mục tiêu HP thấp nhất bên địch hiện tại', 'Mục tiêu HP cao nhất bên địch hiện tại', 'Mục tiêu HP thấp nhất bên ta hiện tại', 'Mục tiêu HP cao nhất bên ta hiện tại', 'Chủ nhân', 'Toàn thể bên ta (Không gồm bản thân)', 'Toàn bộ (Không gồm bản thân)', 'Trân thú và chủ nhân'];
const ATK_TYPE_TEXT = ['Chém gần', 'Chém xa', 'Đâm gần', 'Đâm xa', 'Ma công', 'Phù chú', 'Chúc phúc'];
/** Define.bufferText: battle states by bit (3 is "Mất Máu", 10 "Suy Yếu"). */
export const BUFFER_TEXT = ['Không', 'Trúng Độc', 'Hỏa Thiêu', 'Mất Máu', 'Giảm thuộc tính', 'Cấm Ngôn', 'Phong Kĩ', 'Phong Ma', 'Định Thân', 'Hỗn Loạn', 'Suy Yếu', 'Tăng thuộc tính', 'Hồi MP duy trì', 'Hồi HP duy trì', 'Ảo Ảnh', 'Vô hiệu Ma Công', 'Vô hiệu Vật Lý', 'Miễn Phong Ma', 'Miễn Định Thân', 'Miễn Hỗn Loạn', 'Miễn mọi giảm ích', 'Vô Địch', 'Miễn Cấm Ngôn', 'Miễn Phong Kĩ', 'Miễn Suy Yếu', 'Tăng Ích', 'Giảm Ích', 'Tâm Bất Tử', 'Cải Tử Hoàn Sinh', 'Rối Tử Vong', 'Xua đuổi', 'Trào Phúng', 'Miễn dịch trào phúng'];

const text = (table: string[], i: number, prefix: string) => (i >= 0 && i < table.length ? table[i] : `${prefix}_${i}`);
export const getSkillTypeString = (t: number) => text(SKILL_TYPE_TEXT, t, 'skillType');
export const getSkillWeaponString = (t: number) => text(SKILL_WEAPON_TEXT, t, 'weapon');
export const getSkillAreaString = (t: number) => text(SKILL_AREA_TEXT, t, 'skillArea');
export const getAtkTypeString = (t: number) => text(ATK_TYPE_TEXT, t, 'atkType');
export const getBufferString = (t: number) => text(BUFFER_TEXT, t, 'buffer');

/** Define.getPowerDesc: power id → [text when the total is ≥ 0, text when negative, suffix]. */
const POWER_DESC: Record<number, [string, string, string]> = {
  1: ["Sức Mạnh+", "Sức Mạnh", ""],
  2: ["Sức Mạnh+", "Sức Mạnh", "%"],
  3: ["Thể Lực+", "Thể Lực", ""],
  4: ["Thể Lực+", "Thể Lực", "%"],
  5: ["Nhanh Nhẹn+", "Nhanh Nhẹn", ""],
  6: ["Nhanh Nhẹn+", "Nhanh Nhẹn", "%"],
  7: ["Trí Lực+", "Trí Lực", ""],
  8: ["Trí Lực+", "Trí Lực", "%"],
  9: ["Cảm Trí+", "Cảm Trí", ""],
  10: ["Cảm Trí+", "Cảm Trí", "%"],
  11: ["HP Tối Đa+", "HP Tối Đa", ""],
  12: ["HP Tối Đa+", "HP Tối Đa", "%"],
  13: ["MP Tối Đa+", "MP Tối Đa", ""],
  14: ["MP Tối Đa+", "MP Tối Đa", "%"],
  23: ["Tốc Độ Ra Đòn+", "Tốc Độ Ra Đòn", "%"],
  24: ["Chuẩn Xác+", "Chuẩn Xác", "%"],
  25: ["Tránh Né +", "Tránh Né", "%"],
  26: ["Chuẩn Ma Pháp+", "Chuẩn Ma Pháp", "%"],
  27: ["Chí Mạng+", "Chí Mạng", "%"],
  28: ["Lực Chém+", "Lực Chém", "%"],
  29: ["Lực Đâm+", "Lực Đâm", "%"],
  30: ["Ma Công+", "Ma Công", "%"],
  31: ["Phòng Chém+", "Phòng Chém", "%"],
  32: ["Phòng Đâm+", "Phòng Đâm", "%"],
  33: ["Ma Thủ+", "Ma Thủ", "%"],
  34: ["Kháng Trạng Thái cơ bản+", "Kháng Trạng Thái cơ bản", "%"],
  35: ["Miễn Sát Thương+", "Miễn Sát Thương", "%"],
  37: ["Đỡ Đòn+", "Đỡ Đòn", "%"],
  38: ["Thấu Rõ+", "Thấu Rõ", "%"],
  39: ["Phá Giáp+", "Phá Giáp", "%"],
  40: ["Thuẫn Pháp Lực+", "Thuẫn Pháp Lực", "%"],
  41: ["Phản Kích+", "Phản Kích", "%"],
  42: ["Phản Ma+", "Phản Ma", "%"],
  43: ["Hút HP+", "Hút HP+", "%"],
  44: ["Hút MP+", "Hút MP", "%"],
  45: ["Xuyên Ma Pháp+", "Xuyên Ma Pháp", "%"],
  46: ["Ép Chuẩn Xác+", "Ép Chuẩn Xác", "%"],
  49: ["HP+", "HP", ""],
  53: ["Tốc Độ Ra Đòn+", "Tốc Độ Ra Đòn", ""],
  54: ["Chuẩn Xác+", "Chuẩn Xác", ""],
  55: ["Tránh Né +", "Tránh Né ", ""],
  56: ["Chuẩn Ma Pháp+", "Chuẩn Ma Pháp", ""],
  57: ["Điểm Chí Mạng+", "Điểm Chí Mạng", ""],
  58: ["Lực Chém+", "Lực Chém", ""],
  59: ["Lực Đâm+", "Lực Đâm", ""],
  60: ["Ma Công+", "Ma Công", ""],
  61: ["Phòng Chém+", "Phòng Chém", ""],
  62: ["Phòng Đâm+", "Phòng Đâm", ""],
  63: ["Ma Thủ+", "Ma Thủ", ""],
  64: ["Kháng Trạng Thái+", "Kháng Trạng Thái", ""],
  65: ["Miễn Sát Thương+", "Miễn Sát Thương", ""],
  67: ["Đỡ Đòn+", "Đỡ Đòn", ""],
  68: ["Thấu Rõ+", "Thấu Rõ", ""],
  69: ["Phá Giáp", "Phá Giáp", ""],
  70: ["Thuẫn Pháp Lực+", "Thuẫn Pháp Lực", ""],
  71: ["Phản Kích+", "Phản Kích", ""],
  72: ["Phản Ma+", "Phản Ma", ""],
  73: ["Hút HP cơ bản+", "Hút HP cơ bản", ""],
  74: ["Hút MP cơ bản+", "Hút MP cơ bản", ""],
  75: ["Xuyên Ma Pháp+", "Xuyên Ma Pháp", ""],
  76: ["Ép Chuẩn Xác cơ bản+", "Ép Chuẩn Xác cơ bản", ""],
  77: ["Mỗi hiệp tự hồi HP+", "Mỗi hiệp tự hồi HP", ""],
  78: ["Mỗi hiệp tự trừ MP+", "Mỗi hiệp tự trừ MP", ""],
  81: ["Sát thương đi kèm kĩ năng +", "Sát thương đi kèm kĩ năng ", ""],
  84: ["Điểm Chí Mạng đi kèm+", "Điểm Chí Mạng đi kèm", ""],
  85: ["Ép Chuẩn Xác đi kèm+", "Ép Chuẩn Xác đi kèm", "%"],
  86: ["Bỏ qua +", "Bỏ qua", "điểm Pháp Thủ của mục tiêu"],
  89: ["Sát thương trân thú+", "Sát thương trân thú", "%"],
  90: ["HP Trân Thú Tối Đa+", "HP Trân Thú Tối Đa", "%"],
  91: ["MP Trân Thú Tối Đa+", "MP Trân Thú Tối Đa", "%"],
  92: ["Sức Mạnh Trân Thú+", "Sức Mạnh Trân Thú", "%"],
  93: ["Thể Lực Trân Thú+", "Thể Lực Trân Thú", "%"],
  94: ["Nhanh Nhẹn Trân Thú+", "Nhanh Nhẹn Trân Thú", "%"],
  95: ["Trí Lực Trân Thú+", "Trí Lực Trân Thú", "%"],
  96: ["Cảm Trí Trân Thú+", "Cảm Trí Trân Thú", "%"],
  104: ["Tới bản đồ thế giới +", "Tới bản đồ thế giới", ""],
  105: ["ToXY+", "ToXY ", ""],
  107: ["Cài lại nhiệm vụ+", "Cài lại nhiệm vụ", ""],
  112: ["Danh hiệu+", "Danh hiệu", ""],
  122: ["Số lần tấn công khi dùng kiếm+", "Số lần tấn công khi dùng kiếm", ""],
  123: ["Số lần tấn công khi dùng đao+", "Số lần tấn công khi dùng đao", ""],
  124: ["Số lần tấn công khi dùng vũ khí nặng+", "Số lần tấn công khi dùng vũ khí nặng", ""],
  125: ["Số lần tấn công khi dùng vũ khí dài+", "Số lần tấn công khi dùng vũ khí dài", ""],
  126: ["Số lần tấn công khi dùng trượng+", "Số lần tấn công khi dùng trượng", ""],
  127: ["Số lần tấn công khi tay không+", "Số lần tấn công khi tay không", ""],
  128: ["Số lần tấn công khi dùng vũ khí tầm xa+", "Số lần tấn công khi dùng vũ khí tầm xa", ""],
  129: ["Số lần tấn công khi dùng vật tay cầm+", "Số lần tấn công khi dùng vật tay cầm", ""],
  130: ["Lần Tấn Công+", "Lần Tấn Công", ""],
  133: ["Sát thương vũ khí kiếm, Độ Bền +", "Sát thương vũ khí kiếm, Độ Bền ", "%"],
  134: ["Sát thương đao, Độ Bền +", "Sát thương đao, Độ Bền ", "%"],
  135: ["Sát thương vũ khí nặng, Độ Bền +", "Sát thương vũ khí nặng, Độ Bền", "%"],
  136: ["Sát thương vũ khí dài, Độ Bền +", "Sát thương vũ khí dài, Độ Bền ", "%"],
  137: ["Sát thương vũ khí trượng, Độ Bền +", "Sát thương vũ khí trượng, Độ Bền", "%"],
  138: ["Sát thương tay không+", "Sát thương tay không", "%"],
  139: ["Sát thương vũ khí tầm xa, Độ Bền +", "Sát thương vũ khí tầm xa, Độ Bền ", "%"],
  140: ["Sát thương vật tay cầm, Độ Bền +", "Sát thương vật tay cầm, Độ Bền", "%"],
  141: ["Sát thương vũ khí, Độ Bền +", "Sát thương vũ khí, Độ Bền", "%"],
  142: ["Độ bền trang bị phòng cụ+", "Độ bền trang bị phòng cụ", "%"],
  145: ["Hồi HP+", "Hồi HP", ""],
  146: ["Hồi HP+", "Hồi HP", "%"],
  147: ["Hồi MP+", "Hồi MP", ""],
  148: ["Hồi MP+", "Hồi MP", "%"],
  168: ["Bỏ qua Phản Kích+", "Bỏ qua Phản Kích", ""],
  169: ["Bỏ qua hồi ma pháp+", "Bỏ qua hồi ma pháp", ""],
  170: ["Bỏ qua Đỡ Đòn+", "Bỏ qua Đỡ Đòn", ""],
  171: ["Bỏ qua động sát+", "Bỏ qua động sát", ""],
  172: ["Bỏ qua Kháng Trạng Thái+", "Bỏ qua Kháng Trạng Thái", ""],
  173: ["Bỏ qua Miễn Sát Thương+", "Bỏ qua Miễn Sát Thương", ""],
  174: ["Số lần tấn công khi dùng pháp bảo+", "Số lần tấn công khi dùng pháp bảo", ""],
  175: ["Sát thương vũ khí pháp khí, Độ Bền +", "Sát thương vũ khí pháp khí, Độ Bền ", "%"],
  178: ["Hộ thuẫn miễn thương+", "Hộ thuẫn miễn thương", ""],
  190: ["Dùng súng công+", "Dùng súng công", ""],
  191: ["ST, Độ Bền vũ khí Súng+", "ST, Độ Bền vũ khí Súng", "%"],
  192: ["Số lần công khi dùng chùy+", "Số lần công dùng chù", ""],
  193: ["Bền, ST vũ khí Chùy+", "Bền, ST vũ khí Chùy", "%"],
  194: ["Số lần công khi dùng Quạt+", "Số lần công dùng Quạt", ""],
  195: ["Bền, ST vũ khí Quạt+", "Bền, ST vũ khí Quạt", "%"],
  196: ["Bền, ST vũ khí hệ pháp+", "Bền, ST vũ khí hệ pháp", "%"],
};

/** Define.getPowerDesc(power, value, bonus 0): "Sức Mạnh+5", "Lực Chém+10%", "Sức Mạnh-3"; null if not ported. */
export function getPowerDesc(power: number, value: number): string | null {
  const d = POWER_DESC[power];
  if (d == null) return null;
  return `${value >= 0 ? d[0] : d[1]}${value}${d[2]}`;
}

/**
 * Utilities.composeString: lines of [text, colour]; two short texts share a line, padded with
 * spaces to half of `width` (Java int division: a width of -2 or -3 gives one item per line).
 */
export function composeString(items: [string, number | null][], width: number): string {
  let out = '';
  let lineStart = true;
  const half = Math.trunc(width / 2);
  for (const [s, color] of items) {
    if (isNullText(s)) continue;
    const w = uiFont.stringWidth(s);
    let piece = s;
    let full = true;
    if (half === -1) piece = `${s}\n`;
    else if (half >= w) full = false;
    else piece = `${lineStart ? '' : '\n'}${s}\n`;
    out += color == null ? piece : PowerString.makeColorString(piece, color);
    if (full) {
      lineStart = true;
      continue;
    }
    if (!lineStart) out += '\n';
    else {
      const sw = uiFont.stringWidth(' ');
      if (sw <= 0) {
        out += '\n';
        lineStart = false;
        continue;
      }
      let ww = w;
      do {
        out += ' ';
        ww += sw;
      } while (ww < half);
    }
    lineStart = !lineStart;
  }
  return out + (lineStart ? '' : '\n');
}

export class Skill {
  id = 0;
  name = '';
  info = '';
  level = 0;
  addLevel = 0;
  type = 0;
  area = 0;
  skillAtkType = 0;
  skillWeapon = 0;
  round = 0;
  atk_time = 0;
  useMP = 0;
  useHP = 0;
  power1 = 0;
  powerValue1 = 0;
  power2 = 0;
  powerValue2 = 0;
  power3 = 0;
  powerValue3 = 0;
  statusBit1 = 0;
  statusBit2 = 0;
  statusBit3 = 0;
  /** Skill.getPowerValue: the value of `power` among the skill's three powers. */
  getPowerValue(power: number): number {
    let v = 0;
    if (this.power1 === power) v += this.powerValue1;
    if (this.power2 === power) v += this.powerValue2;
    if (this.power3 === power) v += this.powerValue3;
    return v;
  }
  isLearnByBook = false;
  isDefault = false;

  /** "Lv n", or "Lv base+bonus" when equipment adds levels. */
  getRealLevelInfo(): string {
    return this.addLevel > 0 ? `Lv ${this.level - this.addLevel}+${this.addLevel}` : `Lv ${this.level}`;
  }

  /** Only granted by equipment (no learnt level). */
  isAddSkill(): boolean {
    return this.addLevel > 0 && this.level - this.addLevel <= 0;
  }

  getName(): string {
    return `${PowerString.makeColorString(this.name, 16776960)} (Lv ${this.level})`;
  }

  /**
   * Skill.getDesc(false, width): name and type, area and attack type, the powers (green), rounds,
   * hits, cost, weapon limit, then the info text. The learning cost part (getDesc(true)) and the
   * weapon check (red when the equipped weapon does not fit) are not ported.
   */
  getDesc(width: number): string {
    let s = '';
    if (this.name) s += `${this.getName()}    ${getSkillTypeString(this.type)}\n`;
    if (this.type !== SKILL_TYPE_PASSIVE) s += `${getSkillAreaString(this.area)}    ${getAtkTypeString(this.skillAtkType)}\n`;
    const items: [string, number | null][] = [];
    for (const [p, v, bit] of [[this.power1, this.powerValue1, this.statusBit1], [this.power2, this.powerValue2, this.statusBit2], [this.power3, this.powerValue3, this.statusBit3]]) {
      if (p === 0) continue;
      if (v !== 0) {
        const d = getPowerDesc(p, v) ?? '';
        items.push([bit !== 0 ? `${d},${getBufferString(bit)}` : d, 65280]);
      } else if (bit !== 0) {
        items.push([getBufferString(bit), 65280]);
      }
    }
    if (this.round > 0) items.push([`Kéo dài ${this.round} hiệp`, null]);
    if (this.atk_time !== 0) items.push([`Lần Tấn Công: ${this.atk_time > 0 ? '+' : ''}${this.atk_time}`, null]);
    let cost = this.useMP !== 0 ? ` ${this.useMP} MP` : '';
    if (this.useHP !== 0) cost += ` ${this.useHP} HP`;
    if (!isNullText(cost)) items.push([`Kĩ năng tiêu ehao: ${cost}`, null]);
    if (this.skillWeapon > 0) items.push([`Hạn chế vũ khí: ${getSkillWeaponString(this.skillWeapon)}`, null]);
    s += composeString(items, width);
    if (this.info) s += `${this.info}\n`;
    return s;
  }
}
