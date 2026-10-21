// The society tab ("X.Hội"): PlayerInfoUIAction.updatePlayerSocietyUI, processSocietyAction and
// getSocietyExplain / initSocietyText (CFR and Vineflower decompiles). It reuses the attribute
// panel of ui/31; "G.Thích" explains the focused row by its index. Not ported: the title powers
// (TitleInfo, from the server; the "use a title" hint is shown) and the VIP expiry time.
import { GContainer, GLabel } from '../../gui/GWidget';
import type { Player } from '../../actor/Player';
import * as GameWorld from '../../main/GameWorld';
import { UIHandler, alertMessage } from '../UIHandler';
import { EVENT_ATTRIBUTE_PANEL, TYPE_PLAYER_ATTRIBUTE } from './playerAttribute';

const EVENT_LIST = 35;
const EVENT_ROW = 36;
const EVENT_EXPLAIN = 3104;
const TYPE_RAIDERS_PLAYER_INFO = 127;
/** Model.getMoneyText(11 / 12 / 13): GameText.STR_MONEY1..3. */
const MONEY_TEXT: Record<number, string> = { 11: 'KNB', 12: 'Lá', 13: 'Bạc' };

/** PlayerInfoUIAction.SOCIETY_EXPLAIN, by row index. */
const SOCIETY_EXPLAIN = [
  "Tiền hiện tại /cFFFF00%U/p\n Vàng có thể tri trả phí dịch vụ tăng thêm, có thể thay thế Kim Diệp để chi trả. Vàng có được khi nạp thẻ.",
  "Tiền hiện tại/c9acaff%U/p\n Kim Diệp là tiền khóa, không thể giao dịch, có thể dùng mua đạo cụ tăng điểm khóa. Kim Diệp nhận được khi làm nhiệm vụ và nạp tiền.",
  "Tiền hiện tại/cc45712%U/p\n Đồng là tiền game, dùng để mua các loại đạo cụ. Đồng có được khi làm nhiệm vụ, quái đánh rơi.",
  "Vào thời gian chỉ định của mỗi ngày có thể tham gia phó bản đoàn đội, nhận Điểm Vinh Dự.",
  "Vào thời gian chỉ định mỗi ngày tham gia Đấu Trường thi đấu cùng người chơi khác, thắng sẽ nhận được Điểm Thi Đấu.",
  "Hàng ngày vào Đấu Trường Thiên Không khiêu chiến thủ vệ, chiến thắng sẽ nhận được Điểm Khiêu Chiến.",
  "Lực chiến hiện tạ:%U\nTính tổng Lực Chiến theo danh sách thuộc tính người chơi mỗi thuộc tính nhân cho hệ số.",
  "Độ Phù ma：%U/10000\nCó thể nhận được thông qua hấp thu trang bị, tiến hành phù ma trang bị thông qua tiêu hao điểm Phù ma, sắp chỉ định thuộc tính Phù ma đính kèm lên trang bị. Đồng thời cần đạo cụ Phù ma tương ứng khi Phù ma",
  "Khi nhân vật /c00FF00 của bạn max level/p, toàn bộ EXP bạn nhận được sẽ chuyển thành EXP Thần Kì. Dùng EXP Thần Kì thăng Cấp Thần Kì.Cấp Thần Kì /c00FF00tăng thuộc tính chiến đấu của bạn/p, giúp bạn chiếm ưu thế trong chiến đấu; tăng Cấp Thần Kì còn có thể /c00FF00tăng tỉ lệ rớt bảo của quái vật/p, và /c00FF00tăng tỉ lệ rớt cực phẩm của bảo rương /p.",
  "%U",
  "Dùng đạo cụ mở rộng kho có thể tăng ô kho.",
  "Tổng số quái tiêu diệt tới giờ.",
  "Số lần quyết đấu thắng.",
  "Tỉ lệ quyết đấu thắng.",
  "Bạn đời \nPhu thê đồng thời online có thể nhận 1.1 exp\nPhu thê dịch chuyển qua lại không cần dùng đá dịch chuyển",
  "Người chơi chỉ có thể trở thành đệ tử hoặc sư phụ (có thể nhận 5 đệ tử). Khi quan hệ duy trì 3 ngày trở lên, sư phụ có thể nhận được Kim Diệp của 5% số tiền đệ tử nạp. Đệ tử cấp 40 hoặc cao hơn cấp sư phụ, sẽ tự động thoát khỏi quan hệ sư đồ.",
  "/c00FF00%U/p",
  "Khi nước liên minh xảy ra quốc chiến, bạn có thể xin vào viện quân, giúp nước liên minh tác chiến!",
  "Khi tra album của người khác, có thể chọn đối tượng yêu thầm!",
];

/** VIP privileges by the player's VIP2 level (initSocietyText). */
const VIP_TEXT = [
  "Mọi nhân vật tài khoản này có đặc quyền VIP:\n1.Có/c00ff00VIPTinh Linh/p，thuộc tính tăng thêm của Tinh Linh Bảo Hộ。\n2.Có/c00ff00VIP đánh dấu thân phân tôn quý/phiển thị。\n3.Có/c00ff00VIPshop/pquyền mua。\n4.Có/c00ff00VIPđạo cụ và trang bị/p quyền sử dụng。\n5.Có/c00ff00VIPThành tụ riêng/p。\n6.Tiến hành/c00ff00VIPVấn đáp/p，Mỗi ngày nhận phần thưởng。\n7.Có/c00ff00VIP kho riêng/p。\n8.Mỗi ngày Login，đều được tặng/c00ff00VIP quà/p。\n9.Sử dụng shop Lò Dung，có nhiều lượt dung luyện。\n10.mỗi ngày độ năng động+100。",
  "Tất cả nhân vật của tài khoản đều có quyền VIP:\n1. Có /c00ff00Tinh Linh VIP/p, tăng thuộc tính Tinh Linh Thủ Hộ.\n2. Có hiện /c00ff00Biểu Tượng VIP tôn quý/p.\n3. Có quyền mua trong /c00ff00Shop VIP/p.\n4. Có quyền dùng /c00ff00đạo cụ và trang bị VIP/p.\n5. Có /c00ff00thành tích VIP/p.\n6. Tiến hành /c00ff00Vấn Đáp VIP/p nhận quà.\n7. Có /c00ff00kho cá nhân VIP/p.\n8. Login mỗi ngày /c00ff00nhận quà VIP/p.\n9. Dùng Shop Dung Luyện, thêm lần dung luyện.\n10.Mỗi ngày Sôi Nổi +100。\n",
  "Đặc quyền VIP2 (chỉ nhân vật này):\n1. Có tất cả Đ.Quyền /c00ff00VIP1/p.\n2. Trên cơ bản VIP1 /c00ff00thêm số lần Vấn Đáp VIP/p.\n3. Có /c00ff00Quà Login Ngày VIP2/p.\n4. Trên cơ bản VIP1 /c00ff00thêm số lần Dung Luyện VIP/p.\n5. Có /c00ff00Shop VIP/p.\n6. Thêm giới hạn bạn bè, DS ẩn.\n",
  "Đặc quyền VIP3 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền /c00ff00VIP2/p.\n2. Trên cơ bản VIP2/c00ff00thêm số lần Vấn Đáp VIP/p.\n3. Có /c00ff00Quà Login Ngày VIP3/p.\n4. Trên cơ bản VIP2/c00ff00thêm số lần Dung Luyện VIP/p.\n",
  "Đặc quyền VIP4 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền /c00ff00VIP3/p.\n2. Có /c00ff00thành tích VIP4/p.\n",
  "Đặc quyền VIP5 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền  /c00ff00VIP4/p.\n2. Có /c00ff00thành tích danh hiệu VIP5/p.\n3. Có /c00ff00biểu tượng màu VIP5/p.\n4. Có /c00ff00Shop VIP/p.\n5. Thêm giới hạn bạn bè, DS ẩn.\n6. Mở khóa/c00ff00vipKho VIP cao (20 ô)/p。\n",
  "Đặc quyền VIP6 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền  /c00ff00VIP5/p.\n2. Có /c00ff00thành tích danh hiệu VIP6/p.\n3. Có /c00ff00biểu tượng màu VIP6/p.\n4. /c00ff00Giao dịch miễn thuế/p.\n5./c00ff00Chat không tốn loa nhỏ/p.\n6. Rút ngắn CD chat /c00ff00kênh TG/p.\n7. Tăng số ô/c00ff00viptrong Kho Vip (20 ô)/p。\n",
  "Đặc quyền VIP7 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền /c00ff00VIP6/p.\n2. Có /c00ff00thành tích danh hiệu VIP7/p.\n3. Có /c00ff00biểu tượng màu VIP7/p.\n4. /c00ff00Cộng số ô kho (12 ô)/p.\n5. Tăng số ô/c00ff00viptrong Kho Vip (20 ô)/p。\n",
  "Đặc quyền VIP8 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền /c00ff00VIP7/p.\n2. Có /c00ff00thành tích danh hiệu VIP8/p.\n3. Có /c00ff00biểu tượng màu VIP8/p.\n4. Có /c00ff00Dùng hàng loạt, hợp thành (bao gồm hợp đá, vé EXP, Phù Ma), tính năng bán/p.\n5. Có /c00ff00Shop VIP/p.\n6. /c00ff00Ưu đãi đạo cụ Shop VIP/p.\n7.Thêm giới hạn bạn bè, DS ẩn.\n8. Tăng số ô/c00ff00viptrong Kho Vip (20 ô)/p。\n",
  "Đặc quyền VIP9 (chỉ nhân vật này)\n1. Có tất cả Đ.Quyền /c00ff00VIP8/p.\n2. Có /c00ff00thành tích danh hiệu VIP9/p.\n3. Có /c00ff00biểu tượng màu VIP9/p.\n4. /c00ff00Đổi màu chữ kênh chat/p.\n5. Tăng số ô/c00ff00viptrong Kho Vip (20 ô)/p。\n",
];

/** Utilities.manageString: each %U takes the next value. */
function manageString(s: string, values: string[]): string {
  let i = 0;
  return s.replace(/%U/g, () => values[i++] ?? '');
}

/** GameWorld.isVip (the expiry check is the server's). */
const isVip = (p: Player) => p.vipLevel >= 1;

/** initSocietyText: the %U values of each explanation. */
function societyChangeText(p: Player): string[][] {
  const vipName = 'VIP';
  const vip2 = GameWorld.myPlayer?.vipLevel2 ?? 0;
  const privileges = VIP_TEXT[vip2] ?? '';
  // For the player's own active VIP Java says how long it lasts (bag slot 17's expiry): not known offline.
  const vipText = `${manageString('Sau khi mở %U;', [vipName])}${privileges}`;
  const titles = 'Dùng danh hiệu mới có thể giúp nhân vật nhận được mọi thuộc tính của danh hiệu ';
  return [
    [`${p.get(11)}`], [`${p.get(12)}`], [`${p.get(13)}`], [], [], [],
    [`${p.combatPoint}`], [`${p.enchantValue}`], [`${p.exp2}`, `${p.expMax2}`], [vipText],
    [], [], [], [], [], [], [titles], [], [],
  ];
}

export function getSocietyExplain(p: Player, n: number): string {
  if (n < 0 || n >= SOCIETY_EXPLAIN.length) return 'Chưa miêu tả!';
  return manageString(SOCIETY_EXPLAIN[n], societyChangeText(p)[n] ?? []);
}

function add(win: GContainer, tpl: GContainer, name: string, value: string): void {
  const row = tpl.getClone() as GContainer;
  const n = row.getJavaChildByEvent(3102);
  if (n instanceof GLabel) n.setText(name);
  const v = row.getJavaChildByEvent(3103);
  if (v instanceof GLabel) v.setText(value);
  win.add(row);
}

/** Money, honour, arena points, combat power, enchant points, god EXP, status, storage, PK, relations. */
export function updatePlayerSocietyUI(ui: UIHandler, p: Player): void {
  let panel = ui.getGWidgetByEventType(EVENT_ATTRIBUTE_PANEL);
  if (panel == null) {
    const sub = UIHandler.createUIFromXML(TYPE_PLAYER_ATTRIBUTE);
    panel = sub.getGWidgetByEventType(EVENT_ATTRIBUTE_PANEL);
    ui.addEventGWidget(panel);
    ui.addEventGWidget(sub.getGWidgetByEventType(EVENT_LIST));
    ui.addEventGWidget(sub.getGWidgetByEventType(EVENT_ROW));
  }
  if (panel != null) ui.getFrameContainer()?.add(panel);
  const win = ui.getGWindowByEventType(EVENT_LIST);
  const tpl = ui.getGWidgetByEventType(EVENT_ROW);
  if (win == null || !(tpl instanceof GContainer)) return;
  win.clear();
  const row = (name: string, value: string | number) => add(win, tpl, name, `${value}`);
  if (ui.getType() !== TYPE_RAIDERS_PLAYER_INFO) for (const k of [11, 12, 13]) row(MONEY_TEXT[k], p.get(k));
  row('Vinh dự', p.get(68));
  row('Thi đấu', p.arenaPoint);
  row('Khiêu chiến', p.skyarenaPoint);
  row('Lực Chiến', p.combatPoint);
  row('Điểm Phụ Ma', `${p.enchantValue}/10000`);
  row('EXP Thần Kì', `${p.exp2}/${p.expMax2}`);
  let status = 'Thường';
  if (isVip(p)) status = `VIP${p.vipLevel > 1 ? `Lv ${p.vipLevel}` : ''}`;
  const me = GameWorld.myPlayer;
  if (me != null && me.vipLevel2 > 0 && isVip(me)) status = `VIP${me.vipLevel2}`;
  row('Địa vị', status);
  row('Số ô kho', `${p.get(15)}/60`);
  row('Số quái giết', p.get(18));
  row('PK thắng', p.get(19));
  row('Tỉ lệ PK thắng', p.getPKWin());
  row('Bạn đời', p.partnerName.trim() ? p.partnerName : 'Không');
  row('Sư đồ', p.masterFlag === 1 ? 'Sư phụ' : p.masterFlag === 2 ? 'Đệ tử' : 'Không');
  row('Danh hiệu', p.title.trim() ? p.title : 'Không');
  row('Viện quân', p.helpCountry.trim() ? p.helpCountry : 'Không');
  row('Yêu thầm', p.lovePlayer.trim() ? p.lovePlayer : 'Không');
  win.setFirstFocus();
  ui.show();
}

/** processSocietyAction: "G.Thích" explains the focused row (raiders info skips the 3 money rows). */
export function processSocietyAction(ui: UIHandler, p: Player, action: number): void {
  const win = ui.getGWindowByEventType(EVENT_LIST);
  if (win == null) return;
  const w = ui.getActionGWidget();
  for (let c = w; c != null; c = c.parent) {
    if (c.parent === win) {
      if (win.focusWidget !== c) win.setFocus(c);
      break;
    }
  }
  if (win.focusWidget == null) return;
  if (action === 0 && w?.getEventType() !== EVENT_EXPLAIN) return;
  let n = win.focusIndex;
  if (ui.getType() === TYPE_RAIDERS_PLAYER_INFO) n += 3;
  alertMessage(getSocietyExplain(p, n), 'Gợi ý', 6, 0, true);
}
