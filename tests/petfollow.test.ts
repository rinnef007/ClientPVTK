import { describe, expect, it } from 'vitest';
import { Player } from '../src/game/actor/Player';
import { TYPE_PET } from '../src/game/actor/Model';
import * as GameWorld from '../src/game/main/GameWorld';
import '../src/game/main/Control';

function setup(petPx: number, petPy: number): { me: Player; pet: Player } {
  const me = new Player();
  me.id = 1;
  const pet = new Player(TYPE_PET);
  me.setPet(pet);
  pet.px = petPx;
  pet.py = petPy;
  GameWorld.setMyPlayer(me);
  return { me, pet };
}

describe('pet following (Model.checkFollowMove)', () => {
  it('stays put within 48 px (x + y)', () => {
    const { pet } = setup(30, 18);
    pet.logic();
    expect([pet.px, pet.py]).toEqual([30, 18]);
  });

  it('steps 6 px towards the owner on each axis more than 24 px away', () => {
    const { pet } = setup(100, -40);
    pet.logic();
    expect([pet.px, pet.py]).toEqual([94, -34]);
  });

  it('moves only on the axis that is more than 24 px away', () => {
    const { pet } = setup(24, 25);
    // |dx| = 24 is not over 24, |dy| = 25 is: only y moves
    pet.logic();
    expect([pet.px, pet.py]).toEqual([24, 19]);
  });

  it('initFollowPos puts the pet on its owner', () => {
    const { me, pet } = setup(200, 200);
    me.px = 48;
    me.py = 72;
    me.initFollowPos();
    expect([pet.px, pet.py]).toEqual([48, 72]);
  });
});

