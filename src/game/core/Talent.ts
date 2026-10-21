// The parts of com.hz.core.Talent (Vineflower decompile) the talent tab reads: name, rank level,
// type and the description (Talent.getDesc without the learning materials part). Talents come
// from the server (Talent.fromBaseBytes); offline they are demo data.
import { PowerString } from '../string/PowerString';
import { composeString, getPowerDesc } from './Skill';

export const TALENT_TYPE_ATTACK = 0;
export const TALENT_TYPE_DEFENCE = 1;
export const TALENT_TYPE_COMMON = 2;

export function getTalentTypeString(type: number): string {
  return type === 0 ? 'Công kích' : type === 1 ? 'Phòng thủ' : type === 2 ? 'Thông dụng' : '';
}

export class Talent {
  rankid = 0;
  ranklevel = 0;
  type = 0;
  name = '';
  maxTalentLevel = 0;
  power1 = 0;
  powerValue1 = 0;
  power2 = 0;
  powerValue2 = 0;
  power3 = 0;
  powerValue3 = 0;

  getName(): string {
    return `${PowerString.makeColorString(this.name, 16776960)} (Lv ${this.ranklevel})`;
  }

  /** Talent.getDesc(player, false, width): name and type, the highest learnable level, powers. */
  getDesc(width: number): string {
    let s = '';
    if (this.name) s += `${this.getName()}    ${getTalentTypeString(this.type)}\n`;
    if (this.maxTalentLevel > 0) s += `Thiên Phú có thể học cấp cao nhất:${this.maxTalentLevel}\n`;
    const items: [string, number | null][] = [];
    for (const [p, v] of [[this.power1, this.powerValue1], [this.power2, this.powerValue2], [this.power3, this.powerValue3]]) {
      if (p !== 0 && v !== 0) items.push([getPowerDesc(p, v) ?? '', 65280]);
    }
    return s + composeString(items, width);
  }

  /** Talent.sortTalentlist: by rank id (a stable bubble sort in Java). */
  static sortTalentlist(list: Talent[]): void {
    list.sort((a, b) => a.rankid - b.rankid);
  }
}
