// The parts of com.hz.actor.MyPet the pet screens read (CFR decompile): a pet is a Player built
// from a pet item (type 32) — name, level (item.reqLv), appearance (item.icon), grade — plus the
// pet-only values the info screen shows. Real values come from the server (MyPet.fromBytesDetail).
import { GameSprite } from '../sprite/GameSprite';
import { createPetSpriteByIcon } from '../sprite/SpriteIcon';
import { ITEM_TYPE_PET, SLOT_PET, type Item } from './Item';
import { Player } from './Player';

/** Pet value ids for Model.get: growth level and grade. */
export const ATTR_PET_GROW_LEVEL = 83;
export const ATTR_PET_GRADE = 82;

export class MyPet extends Player {
  owner: Player | null;
  petItem: Item | null = null;
  grade = 0;
  /** Combat points (0..10 bar), growth and comprehension (0..100 bars). */
  cp = 0;
  grow = 0;
  compre = 0;
  growLevel = 0;
  petAge = 0;
  petmaxage = 0;
  /** Portrait id for common/PetIcon/tx_<n>.png (Model.getPetIcon). */
  petHeadIcon = 0;
  icon1 = 0n;

  constructor(owner: Player | null) {
    super();
    this.owner = owner;
  }

  createSprite(): GameSprite | null {
    return createPetSpriteByIcon(this.icon1, false);
  }

  /** MyPet.createItemPet: a pet with the item's name, level, look and grade. */
  static createItemPet(item: Item, owner: Player): MyPet {
    const pet = new MyPet(owner);
    pet.name = item.name;
    pet.level = item.reqLv;
    pet.set(106, item.reqLv);
    pet.icon1 = item.icon;
    pet.grade = item.grade;
    pet.setPlayerSprite(pet.createSprite());
    return pet;
  }

  /** MyPet.itemChangePet: the item in the pet slot is the player's own pet object. */
  static itemChangePet(item: Item, owner: Player, myPlayer: Player | null): MyPet {
    const pet = item.slotPos === SLOT_PET && owner === myPlayer && owner.getPet() instanceof MyPet
      ? (owner.getPet() as MyPet)
      : MyPet.createItemPet(item, owner);
    pet.petItem = item;
    return pet;
  }

  /** MyPet.doGetBagPetItem: every pet item (equipment and bag) as a pet. */
  static doGetBagPetItem(owner: Player | null, myPlayer: Player | null): MyPet[] | null {
    const bag = owner?.bag;
    if (owner == null || bag == null) return null;
    return bag.allItems().filter((it) => it.type === ITEM_TYPE_PET).map((it) => MyPet.itemChangePet(it, owner, myPlayer));
  }
}
