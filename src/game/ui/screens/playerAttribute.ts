// The attribute tab ("T.Tính" / pet "Th.Tính"): PlayerInfoUIAction.updatePlayerAttributeUI,
// addPlayerAttributeToWindow, processAttributeAction, getPlayerAttributeText / initAttributeText
// and the Battle.calc cases those texts use (CFR, Vineflower and jadx decompiles). The rows come
// from ui/31 (panel 3105, list 35, row template 36); "G.Thích" explains a row with its values.
// Not ported: the pet's innate status text (MyPet.getPetBornStatusInfo, shown as "Không").
import { GContainer, GLabel, GWindow } from '../../gui/GWidget';
import type { Player } from '../../actor/Player';
import { TYPE_PET, TYPE_PLAYER } from '../../actor/Model';
import { UIHandler, alertMessage } from '../UIHandler';

export const TYPE_PLAYER_ATTRIBUTE = 31;
export const EVENT_ATTRIBUTE_PANEL = 3105;
const EVENT_ATTRIBUTE_LIST = 35;
const EVENT_ATTRIBUTE_ROW = 36;
const EVENT_EXPLAIN = 3104;
const TYPE_RAIDERS_PLAYER_INFO = 127;

/** PlayerInfoUIAction.ATTRIBUTE_TEXT: one description per row id (39..44 use 32..37). */
const ATTRIBUTE_TEXT = [
  "HP:/c00FF00%U/p",
  "Pháp lực:/c00FF00%U/p",
  "HP tối đa:/c00FF00%U/p\nMP tối đa:/c00FF00%U/p\nTăng tỉ lệ rớt bảo vật (Bao gồm quái rớt, bảo rương mở ra). Tỉ lệ rớt tăng theo cấp thần kỳ.\n\nGiảm địch thủ: Đỡ Đòn, Thấu Rõ, Phản Kích, Hồi Ma Pháp, Phòng Chém, Phòng Thủ Pháp Thuật, Phòng Đâm, Chí Mạng, Chuẩn Pháp Thuật. Cấp thần kỳ càng cao hiệu quả càng rõ ràng.",
  "%U",
  "Tốc Độ Ra Đòn quyết định thứ tự hành động trong mỗi hiệp đấu. Nhanh Nhẹn (Lớn) và Cảm Trí (Nhỏ) có thể tăng Tốc Độ Ra Đòn.",
  "Sát thương hiện tại/c00FF00%U/p, Sát Thương Vũ Khí càng cao, sát thương trong chiến đấu càng lớn.",
  "1 lệnh tấn công của bạn, sẽ tấn công mục tiêu /c00FF00%U/p lần. Tỉ lệ Chuẩn Xác, Chí Mạng mỗi lần sẽ tính độc lập. Tổng lực công/Số lần tấn công + Sát Thương Vũ Khí = Lực tấn công của mỗi lần.",
  "Khi dùng vũ khí, kĩ năng loại chém sẽ dùng Lực Chém tính sát thương. Mục tiêu dùng Phòng Chém để tính phòng thủ. Sức Mạnh (Lớn) và Nhanh Nhẹn (Nhỏ) có thể tăng Lực Chém.",
  "Khi dùng vũ khí, kĩ năng loại đâm sẽ dùng Lực Đâm tính sát thương. Mục tiêu dùng Phòng Đâm tính phòng thủ. Sức Mạnh và Nhanh Nhẹn có thể tăng Lực Đâm.",
  "Khi dùng vũ khí, kĩ năng loại ma pháp sẽ dùng Ma Công tính sát thương. Mục tiêu dùng Ma Thủ tính phòng thủ. Trí Lực (Lớn) và Cảm Trí (Nhỏ) có thể tăng Ma Công.",
  "Khi chịu tấn công chém cùng cấp (/c00FF00%U/p) của địch, sẽ giảm /c00FF00%U%/p sát thương gây ra cho bạn. Cấp của địch càng cao, hiệu ứng giảm càng thấp và ngược lại. Thể Lực (Lớn) có thể tăng Phòng Chém.",
  "Khi chịu tấn công đâm cùng cấp (/c00FF00%U/p) của địch, sẽ giảm /c00FF00%U%/p sát thương gây ra cho bạn. Cấp của địch càng cao, hiệu ứng giảm càng thấp và ngược lại. Thể Lực (Lớn) có thể tăng Phòng Chém.",
  "Khi chịu tấn công ma pháp cùng cấp (/c00FF00%U /p) của địch, sẽ giảm /c00FF00%U%/p sát thương gây ra cho bạn. Cấp của địch càng cao, hiệu ứng giảm càng thấp và ngược lại. Cảm Trí (Lớn) và Trí Lực (Nhỏ) có thể tăng Ma Thủ.",
  "Né Tránh càng cao, tỉ lệ Chuẩn Xác của địch càng thấp. Nhanh Nhẹn và Cảm Trí có thể tăng Né Tránh.",
  "Chuẩn Vật Lý giảm Né Tránh của mục tiêu bằng tỉ lệ Chuẩn Xác. Chuẩn Vật Lý càng cao, tỉ lệ trúng địch của tấn công vật lý càng lớn.",
  "Dùng Ma Công tấn công địch cùng cấp (/c00FF00%U/p), sẽ có /c00FF00%U%/p  trúng kẻ địch. Và Ma Công của bạn sẽ tăng /c00FF00%U%/p.",
  "Khi tấn công địch cùng cấp (/c00FF00%U/p), sẽ có /c00FF00%U%/p gây ra x1.5 sát thương chí mạng.",
  "Khi bạn chịu trạng thái bất lợi, có /c00FF00%U%/p khiến trạng thái này vô hiệu. Khi hiệp đấu kết thúc, có /c00FF00%U%/p hủy bỏ 1 trạng thái bất lợi trên người. Cảm Trí (Lớn) và Trí Lực (Nhỏ) có thể tăng Kháng Trạng Thái.",
  "Khi chịu sát thương, sẽ giảm /c00FF00%U%/p sát thương. Khi gặp giảm %HP, sẽ giảm /c00FF00%U%/p hiệu ứng giảm trừ. Cao nhất 70%.",
  "Khi chịu tấn công vật lý cùng cấp (/c00FF00%U/p) của địch, sẽ có /c00FF00%U%/p cơ hội đỡ tấn công của đối phương, tỉ lệ Đỡ Đòn cao nhất là /c00FF0070%/p. Đỡ đòn thành công, sẽ không phải chịu sát thương. Nếu lần tấn công này, có nhiều lần tấn công, mỗi khi đỡ đòn thành công sẽ giảm 10% tỉ lệ Đỡ Đòn.",
  "Khi tấn công vật lý, bỏ qua /c00FF00%U/p điểm Chém và Phòng Đâm của mục tiêu.",
  "Khi tấn công ma pháp, bỏ qua /c00FF00%U/p điểm Ma Thủ của mục tiêu.",
  "Khi dùng tấn công vật lý, có /c00FF00%U%/p tỉ lệ Chuẩn Xác tất nhiên. Tối đa /c00FF00%U%/p.",
  "Trước mỗi hiệp đấu tự động hồi /c00FF00%U/p điểm HP.",
  "Trước mỗi hiệp đấu tự động hồi /c00FF00%U/p điểm MP.",
  "Thuẫn Pháp Lực có thể triệt tiêu bất cứ sát thương và hiệu ứng bất lợi nào trong chiến đấu. Mỗi khi triệt tiêu 1 điểm sát thương cần 1 điểm Thuẫn Pháp Lực và 1điểm MP. Khi MP không đủ, Thuẫn Pháp Lực vô hiệu.",
  "Có /c00FF00%U%/p xác suất tự động phản kích tấn công loại vật lý, khiến /c00FF00%U%/p sát thương phản thương lại cho kẻ tấn công. Tối đa có thể phản kích 70% sát thương.",
  "Có /c00FF00%U%/p xác suất tự động phản kích tấn công loại ma pháp, khiến /c00FF00%U%/p sát thương phản thương lại cho kẻ tấn công. Tối đa có thể phản kích 70% sát thương.",
  "Khi gây sát thương cho mục tiêu, tự hồi phục HP tương đương /c00FF00%U%/p sát thương.",
  "Khi gây sát thương cho mục tiêu, tự hồi phục MP tương đương /c00FF00%U%/p sát thương.",
  "Có /c00FF00%U%/p xác suất vô hiệu hiệu ứng tấn công ma pháp, phù chú gây ra cho bạn.Thấu rõ pháp thuật cần tiêu hao điểm MP đối phương dùng ma pháp. MP không đủ sẽ không thể thi triển.",
  "Mi có thể giảm /c00FF00%U/p lần sát thương tấn công. Chú ý, hộ thuẫn miễn thương không thể làm mất đi các trạng thái bất lợi khác ngoài sát thương",
  "Giá trị bỏ qua phản kích hiện tại：/c00FF00%U/p",
  "Giá trị bỏ qua hồi ma pháp hiện tại：/c00FF00%U/p",
  "Giá trị bỏ qua đỡ hiện tại：/c00FF00%U/p",
  "Giá trị bỏ qua động sát hiện tại：/c00FF00%U/p",
  "Giá trị bỏ qua kháng trạng thái hiện tại：/c00FF00%U/p",
  "Giá trị bỏ qua miễn sát thương hiện tại：/c00FF00%U/p",
];

/** Utilities.manageString: each %U takes the next value. */
function manageString(s: string, values: string[]): string {
  let i = 0;
  return s.replace(/%U/g, () => values[i++] ?? '');
}

/** Tool.getPointValue(v, 1): v / 10 with one decimal, trailing zeros dropped. */
function getPointValue(v: number): string {
  if (v === 0) return '0';
  let s = String(Math.abs(v));
  const n = s.length - 1;
  s = n > 0 ? `${s.slice(0, n)}.${s.slice(n)}` : `0.${s}`;
  while (s.endsWith('0')) s = s.slice(0, -1);
  if (s.endsWith('.')) s = s.slice(0, -1);
  return v < 0 ? `-${s}` : s;
}

/**
 * Battle.calc(i, p, target, DUMMY_SKILL) against a same-level target with no other values, as
 * initAttributeText uses it (Battle.getLevelIncludeLevel2 = level + god level 118, which is 0).
 */
function calc(i: number, p: Player): number {
  const lv = p.getLevel();
  const div = (n: number) => (n <= 0 ? 1 : n);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const t = Math.trunc;
  switch (i) {
    case 3: return t((p.get(44) * 10) / div(lv));
    case 8: return clamp(t(t((p.get(39) * 80) / 100) / div(lv + 12)), 0, 75);
    case 9: return clamp(t(t((p.get(40) * 80) / 100) / div(lv + 12)), 0, 75);
    case 10: return clamp(t(t((p.get(41) * 80) / 100) / div(lv + 12)), 0, 75);
    case 14: return t((p.get(45) * 15) / div(lv));
    case 21: return clamp(t((p.get(51) * 7) / div(lv)), 0, 70);
    case 22: return clamp(t((p.get(53) * 7) / div(lv)), 0, 100);
    case 23: return Math.min(Math.max(0, t((p.get(55) * 7) / div(lv))), p.get(64));
    case 24: return Math.min(Math.max(0, t((p.get(56) * 7) / div(lv))), p.get(64));
    default: return 0;
  }
}

/** initAttributeText: the %U values of each description, by row id. */
function changeText(p: Player): string[][] {
  const v = (id: number) => `${p.get(id)}`;
  const c = (i: number) => `${calc(i, p)}`;
  const lv = `${p.getLevel()}`;
  // HP / MP max change since the screen opened (Model.getOld): no history offline, so 0.
  const diff = '0';
  const born = p.getType() === TYPE_PET || p.getType() === 7 ? 'Trân thú này không có trạng thái bẩm sinh.' : '';
  const v44 = getPointValue(p.get(44));
  const v48 = getPointValue(Math.min(p.get(48), 700));
  const v49 = getPointValue(p.get(49));
  const c23 = c(23);
  const c24 = c(24);
  return [
    [`${p.get(2)}/${p.get(29)}`],
    [`${p.get(3)}/${p.get(30)}`],
    [diff, diff],
    [born],
    [],
    [`${p.get(33)}~${p.get(34)}`],
    [v(35)],
    [],
    [],
    [],
    [lv, c(8)],
    [lv, c(9)],
    [lv, c(10)],
    [],
    [],
    [lv, `${Math.min(calc(3, p), 100)}`, v44],
    [lv, c(14)],
    [v48, v48],
    [v49, v49],
    [lv, c(21)],
    [v(52)],
    [v(59)],
    [v(46), '70'],
    [v(60)],
    [v(61)],
    [],
    [c23, c23],
    [c24, c24],
    [getPointValue(p.get(57))],
    [getPointValue(p.get(58))],
    [c(22)],
    [v(250)],
    [v(200)],
    [v(201)],
    [v(202)],
    [v(203)],
    [v(204)],
    [v(205)],
  ];
}

export function getPlayerAttributeText(p: Player, id: number): string {
  const i = id >= 39 && id <= 44 ? id - 7 : id;
  const values = changeText(p);
  if (i >= 0 && i < values.length) return manageString(ATTRIBUTE_TEXT[i] ?? '', values[i]);
  return 'Chưa miêu tả!';
}

function addRow(win: GWindow, tpl: GContainer, id: number, name: string, value: string): void {
  const row = tpl.getClone() as GContainer;
  const n = row.getJavaChildByEvent(3102);
  if (n instanceof GLabel) n.setText(name);
  // Rows 32..37 would get an icon (setIconValue(id - 32, 4096)); no row uses those ids.
  const val = row.getJavaChildByEvent(3103);
  if (val instanceof GLabel) val.setText(value);
  row.setObj(id);
  win.add(row);
}

/** Adds panel 3105 (from ui/31) to the screen and fills the list with the player's values. */
export function updatePlayerAttributeUI(ui: UIHandler, p: Player): void {
  let panel = ui.getGWidgetByEventType(EVENT_ATTRIBUTE_PANEL);
  if (panel == null) {
    const sub = UIHandler.createUIFromXML(TYPE_PLAYER_ATTRIBUTE);
    panel = sub.getGWidgetByEventType(EVENT_ATTRIBUTE_PANEL);
    ui.addEventGWidget(panel);
    ui.addEventGWidget(sub.getGWidgetByEventType(EVENT_ATTRIBUTE_LIST));
    ui.addEventGWidget(sub.getGWidgetByEventType(EVENT_ATTRIBUTE_ROW));
  }
  if (panel != null) ui.getFrameContainer()?.add(panel);
  const win = ui.getGWindowByEventType(EVENT_ATTRIBUTE_LIST);
  const tpl = ui.getGWidgetByEventType(EVENT_ATTRIBUTE_ROW);
  if (win == null || !(tpl instanceof GContainer)) return;
  win.clear();
  const add = (id: number, name: string, value: string | number) => addRow(win, tpl, id, name, `${value}`);
  if (ui.getType() === TYPE_RAIDERS_PLAYER_INFO) {
    add(0, 'HP Tối Đa', p.get(29));
    add(1, 'MP Tối Đa', p.get(30));
  }
  if (p.getType() === TYPE_PLAYER) add(2, 'Cấp Thần Kì ', `Lv ${p.get(118)}`);
  if (p.getType() === TYPE_PET || p.getType() === 7) add(3, 'Trạng thái bẩm sinh', 'Không');
  add(4, 'Tốc Độ Ra Đòn', p.get(31));
  add(5, p.getType() === TYPE_PLAYER ? 'S.Thương Vũ Khí' : 'Lực Tấn Công', `${p.get(33)}~${p.get(34)}`);
  const plain: [number, string, number][] = [
    [6, 'Lần Tấn Công', 35], [7, 'Lực Chém', 36], [8, 'Lực Đâm', 37], [9, 'Ma Công', 38], [10, 'Phòng Chém', 39],
    [11, 'Phòng Đâm', 40], [12, 'Ma Thủ', 41], [13, 'Né Tránh', 42], [14, 'Chuẩn Vật Lý', 43], [15, 'Chuẩn Ma Pháp', 44],
    [16, 'Điểm Chí Mạng', 45],
  ];
  for (const [id, name, key] of plain) add(id, name, p.get(key));
  // Shown from level 11, or earlier when non-zero.
  const high = p.get(106) > 10;
  const opt = (id: number, name: string, key: number, suffix = '') => {
    const n = p.get(key);
    if (high || n > 0) add(id, name, `${n}${suffix}`);
  };
  opt(17, 'Kháng Trạng Thái', 48);
  opt(18, 'Miễn Sát Thương', 49);
  opt(19, 'Đỡ Đòn', 51);
  opt(20, 'Phá Giáp', 52);
  opt(30, 'Thấu Rõ', 53);
  opt(25, 'Thuẫn Pháp Lực', 54);
  opt(26, 'Phản Kích', 55);
  opt(27, 'Phản Ma', 56);
  opt(28, 'Hút HP', 57);
  opt(29, 'Hút MP', 58);
  opt(21, 'Xuyên Ma Pháp', 59);
  opt(22, 'Ép Chuẩn Xác', 46, '%');
  opt(23, 'Tự Hồi HP', 60);
  opt(24, 'Tự Hồi MP', 61);
  add(31, 'Hộ thuẫn miễn thương', p.get(250));
  opt(39, 'Bỏ qua phản kích', 200);
  opt(40, 'Bỏ qua hồi ma pháp', 201);
  opt(41, 'Bỏ qua đỡ', 202);
  opt(42, 'Bỏ qua động sát', 203);
  opt(43, 'Bỏ qua kháng trạng thái', 204);
  opt(44, 'Bỏ qua miễn sát thương', 205);
  win.setFirstFocus();
  ui.show();
}

/** processAttributeAction: "G.Thích" (3104) explains the focused row. */
export function processAttributeAction(ui: UIHandler, p: Player, action: number): void {
  const win = ui.getGWindowByEventType(EVENT_ATTRIBUTE_LIST);
  if (win == null) return;
  const w = ui.getActionGWidget();
  // The tapped button's row becomes the focused one (Java reads the focused row).
  for (let c = w; c != null; c = c.parent) {
    if (c.parent === win) {
      if (win.focusWidget !== c) win.setFocus(c);
      break;
    }
  }
  const id = win.focusWidget?.getObj();
  if (typeof id !== 'number') return;
  if (action === 0 && w?.getEventType() !== EVENT_EXPLAIN) return;
  alertMessage(getPlayerAttributeText(p, id), 'Miêu tả thuộc tính', 20, 0, true);
}
