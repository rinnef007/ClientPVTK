// The paging part of com.hz.ui.UIObject (CFR decompile): a screen's list of objects shown
// pageDisplayNum at a time, with the "page/total" label (904 or 964) and the 902/903 buttons.
// Only client-side lists (status bit 2) are ported; server-paged lists need the server.
import { GLabel } from '../gui/GWidget';
import { UIHandler, alertMessage } from './UIHandler';

const STATUS_CLIENT_DATA = 2;
const STATUS_REQUEST_UPDATE = 4;

/** Per UI type: what to do with the current page (UIObject.updatePageDataToUI). */
const pageUpdaters = new Map<number, (ui: UIHandler, page: unknown[]) => void>();

export function registerPageUpdater(type: number, fn: (ui: UIHandler, page: unknown[]) => void): void {
  pageUpdaters.set(type, fn);
}

export class UIObject {
  intValue1 = 0;
  intValue2 = 0;
  object: unknown = null;
  private status = 0;
  private pageObjList: unknown[] = [];
  private curPageObjList: unknown[] = [];
  private curPage = 0;
  private maxPage = 1;
  private totalNum = 0;
  private pageDisplayNum = 0;

  constructor(readonly uiHandler: UIHandler) {
    uiHandler.obj = this;
  }

  /** UIObject.getUIObj: a new UIObject attached to the UI. */
  static getUIObj(ui: UIHandler): UIObject {
    return new UIObject(ui);
  }

  private setStatusBit(on: boolean, bit: number): void {
    this.status = on ? this.status | bit : this.status & ~bit;
  }

  setPageClientData(on: boolean): void {
    this.setStatusBit(on, STATUS_CLIENT_DATA);
  }

  setPageRequestUpdate(on: boolean): void {
    this.setStatusBit(on, STATUS_REQUEST_UPDATE);
  }

  setPageDisplayNum(n: number): void {
    this.pageDisplayNum = n;
  }

  getPageDisplayerNum(): number {
    return this.pageDisplayNum;
  }

  setPageObjList(list: unknown[] | null): void {
    this.pageObjList = list ?? [];
  }

  getCurPageObjList(): unknown[] {
    return this.curPageObjList;
  }

  isCurPageObjListEmpty(): boolean {
    return this.curPageObjList.length === 0;
  }

  private getPageText(): string {
    return `${this.curPage + 1}/${this.maxPage}`;
  }

  private setCurPageObjList(): boolean {
    this.totalNum = this.pageObjList.length;
    const start = this.curPage * this.pageDisplayNum;
    this.curPageObjList = this.pageObjList.slice(start, start + this.pageDisplayNum);
    if (this.curPageObjList.length === 0 && this.totalNum > 0 && this.curPage > 0) {
      this.curPage--;
      this.setCurPageObjList();
    }
    return true;
  }

  private initPageParam(): void {
    const n = this.pageDisplayNum;
    if (n <= 0) return;
    this.maxPage = Math.max(1, ((this.totalNum / n) | 0) + (this.totalNum % n > 0 ? 1 : 0));
    if (this.curPage > this.maxPage - 1) this.curPage = this.maxPage - 1;
  }

  /** Builds the current page and hands it to the screen; false when it is empty. */
  getPageData(): boolean {
    if ((this.status & STATUS_CLIENT_DATA) === 0) return false;
    const ok = this.setCurPageObjList();
    this.initPageParam();
    if (ok) this.updatePageDataToUI();
    return !this.isCurPageObjListEmpty();
  }

  private updatePageDataToUI(): void {
    pageUpdaters.get(this.uiHandler.getType())?.(this.uiHandler, this.curPageObjList);
    for (const ev of [904, 964]) {
      const l = this.uiHandler.getGWidgetByEventType(ev);
      if (l instanceof GLabel) {
        l.setText(this.getPageText());
        return;
      }
    }
  }

  nextPage(): boolean {
    if (this.curPage >= this.maxPage - 1) {
      alertMessage('Đã là trang cuối! ');
      return false;
    }
    this.curPage++;
    return this.getPageData();
  }

  prevPage(): boolean {
    if (this.curPage <= 0) {
      alertMessage('Đã là trang đầu!');
      return false;
    }
    this.curPage--;
    return this.getPageData();
  }

  /** 902 previous page, 903 next page. */
  doUpAndDownPageEvent(ev: number): boolean {
    if (ev === 902) this.prevPage();
    else if (ev === 903) this.nextPage();
    else return false;
    return true;
  }
}
