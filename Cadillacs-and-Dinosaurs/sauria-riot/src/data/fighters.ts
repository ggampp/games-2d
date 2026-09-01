export type FighterId = "rook" | "vesper" | "toro" | "quinn";
export type BodyKind = "human" | "raptor" | "brute" | "rex";
export type Team = "player" | "enemy";

export interface Palette {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  accent: number;
  boot: number;
  outline: number;
}

export interface FighterDef {
  id: string;
  name: string;
  role: string;
  blurb: string;
  kind: BodyKind;
  hp: number;
  speed: number;
  depthSpeed: number;
  damage: number;
  range: number;
  jump: number;
  mass: number;
  specialName: string;
  portrait?: string;
  palette: Palette;
}

export const PLAYERS: Record<FighterId, FighterDef> = {
  rook: {
    id: "rook",
    name: "Rook Hale",
    role: "Esmagador",
    blurb: "Tanque pesado. Marreta no chão.",
    kind: "human",
    hp: 150,
    speed: 1.45,
    depthSpeed: 1.15,
    damage: 16,
    range: 36,
    jump: 6.6,
    mass: 1.35,
    specialName: "MARRETA",
    portrait: "rook",
    palette: {
      skin: 0xc48a62,
      hair: 0x2a2018,
      shirt: 0xc45c28,
      pants: 0x3a3f4a,
      accent: 0xd4a017,
      boot: 0x2b241c,
      outline: 0x140c08,
    },
  },
  vesper: {
    id: "vesper",
    name: "Vesper Kane",
    role: "Cortadora",
    blurb: "Rápida. Dash-corte invulnerável.",
    kind: "human",
    hp: 100,
    speed: 2.05,
    depthSpeed: 1.55,
    damage: 11,
    range: 40,
    jump: 7.4,
    mass: 0.85,
    specialName: "CORTE",
    portrait: "vesper",
    palette: {
      skin: 0xd4a07a,
      hair: 0x1a1a1a,
      shirt: 0x1f8a86,
      pants: 0x1c1c22,
      accent: 0x3ee0c8,
      boot: 0x111114,
      outline: 0x0a0c10,
    },
  },
  toro: {
    id: "toro",
    name: "Toro Mendez",
    role: "Agarrador",
    blurb: "Agarra, gira e arremessa.",
    kind: "human",
    hp: 135,
    speed: 1.55,
    depthSpeed: 1.2,
    damage: 13,
    range: 32,
    jump: 6.4,
    mass: 1.4,
    specialName: "ARREMESSO",
    portrait: "toro",
    palette: {
      skin: 0xb07848,
      hair: 0x1a120e,
      shirt: 0xd4a017,
      pants: 0x4a3020,
      accent: 0xc42828,
      boot: 0x2a1810,
      outline: 0x120804,
    },
  },
  quinn: {
    id: "quinn",
    name: "Quinn Ash",
    role: "Atiradora",
    blurb: "Chute perto, revólver longe.",
    kind: "human",
    hp: 110,
    speed: 1.7,
    depthSpeed: 1.35,
    damage: 12,
    range: 34,
    jump: 7.0,
    mass: 0.95,
    specialName: "TIRO",
    portrait: "quinn",
    palette: {
      skin: 0xd2b48c,
      hair: 0xc4a060,
      shirt: 0xc4b896,
      pants: 0x4a4030,
      accent: 0x6a5a3a,
      boot: 0x3a3020,
      outline: 0x18140c,
    },
  },
};

export const ENEMIES: Record<string, FighterDef> = {
  grunt: {
    id: "grunt",
    name: "Agente Helix",
    role: "Capanga",
    blurb: "",
    kind: "human",
    hp: 42,
    speed: 0.95,
    depthSpeed: 0.8,
    damage: 8,
    range: 30,
    jump: 5.5,
    mass: 1,
    specialName: "",
    palette: {
      skin: 0xb89070,
      hair: 0x2c2018,
      shirt: 0x5a2d6e,
      pants: 0x2e2e38,
      accent: 0x8a3a9a,
      boot: 0x1a1a20,
      outline: 0x100810,
    },
  },
  brute: {
    id: "brute",
    name: "Brutamontes",
    role: "Tanque",
    blurb: "",
    kind: "brute",
    hp: 90,
    speed: 0.7,
    depthSpeed: 0.55,
    damage: 14,
    range: 38,
    jump: 4.8,
    mass: 1.6,
    specialName: "",
    palette: {
      skin: 0xa07050,
      hair: 0x1a1010,
      shirt: 0x6a2020,
      pants: 0x2a2222,
      accent: 0xc04030,
      boot: 0x1a1210,
      outline: 0x100808,
    },
  },
  raptor: {
    id: "raptor",
    name: "Gadanho",
    role: "Raptor",
    blurb: "",
    kind: "raptor",
    hp: 38,
    speed: 2.15,
    depthSpeed: 1.4,
    damage: 10,
    range: 36,
    jump: 7.2,
    mass: 0.7,
    specialName: "",
    palette: {
      skin: 0x3d8a5a,
      hair: 0x1a4030,
      shirt: 0x2a6a48,
      pants: 0x245a3c,
      accent: 0xe8d080,
      boot: 0x1a3020,
      outline: 0x081810,
    },
  },
  ashjaw: {
    id: "ashjaw",
    name: "Ashjaw",
    role: "Alpha",
    blurb: "",
    kind: "rex",
    hp: 420,
    speed: 1.05,
    depthSpeed: 0.7,
    damage: 22,
    range: 70,
    jump: 5.0,
    mass: 3.2,
    specialName: "",
    palette: {
      skin: 0xb45a28,
      hair: 0x6a3018,
      shirt: 0x8a4a22,
      pants: 0x6a3a1a,
      accent: 0x8a9aaa,
      boot: 0x3a2010,
      outline: 0x180c08,
    },
  },
};

export const PLAYER_ORDER: FighterId[] = ["rook", "vesper", "toro", "quinn"];
