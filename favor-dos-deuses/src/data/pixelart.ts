/**
 * Sprites gerados por código (pixel art em texto).
 * Usados para inimigos sem arte no pack (javali, lobo, esqueleto, harpia)
 * e como fallback do herói/sombra quando os assets CraftPix não existem.
 */

export interface PixelSprite {
  palette: Record<string, string>;
  frames: string[][];
}

const boarPalette = {
  B: "#7a4a22",
  b: "#5e3617",
  T: "#5a3316",
  E: "#1a0a05",
  N: "#3a2010",
  W: "#f0e6d0",
  D: "#3a2010",
};

export const BOAR: PixelSprite = {
  palette: boarPalette,
  frames: [
    [
      "........................",
      ".........BBBBBB.........",
      ".......BBBBBBBBBB.......",
      "......BBBBBBBBBBBBBB....",
      "..T..BBBBBBBBBBBBBBBB...",
      "..T.BBBBBBBBBBBBBBBBBBB.",
      "...BBBBBBBBBBBBBBBBBEBBB",
      "...BBBBBBBBBBBBBBBBBBBBB",
      "...bBBBBBBBBBBBBBBBBBBNN",
      "....bBBBBBBBBBBBBBBWBBN.",
      "....bbBBBBBBBBBBBBB.W...",
      ".....DD...DD....DD..DD..",
      ".....DD...DD....DD..DD..",
    ],
    [
      "........................",
      ".........BBBBBB.........",
      ".......BBBBBBBBBB.......",
      "......BBBBBBBBBBBBBB....",
      "..T..BBBBBBBBBBBBBBBB...",
      "..T.BBBBBBBBBBBBBBBBBBB.",
      "...BBBBBBBBBBBBBBBBBEBBB",
      "...BBBBBBBBBBBBBBBBBBBBB",
      "...bBBBBBBBBBBBBBBBBBBNN",
      "....bBBBBBBBBBBBBBBWBBN.",
      "....bbBBBBBBBBBBBBB.W...",
      "......DD.DD......DD.DD..",
      ".....DD...DD....DD...DD.",
    ],
  ],
};

const wolfPalette = {
  G: "#8a8f94",
  g: "#6c7175",
  L: "#5d6366",
  E: "#e8d44d",
  W: "#f4f4f4",
};

export const WOLF: PixelSprite = {
  palette: wolfPalette,
  frames: [
    [
      "........................",
      "...................GG...",
      "..........GGGGGG..GGGG..",
      ".G.......GGGGGGGGGGGGG..",
      ".GG....GGGGGGGGGGGGGEGG.",
      "..GGG.GGGGGGGGGGGGGGGGGG",
      "...GGGGGGGGGGGGGGGGGGGGG",
      "....GGGGGGGGGGGGGGGGGWWW",
      "....gGGGGGGGGGGGGGGGGG..",
      ".....ggGGGGGGGGGGGGGG...",
      ".....LL...LL...LL..LL...",
      ".....LL...LL...LL..LL...",
    ],
    [
      "........................",
      "...................GG...",
      "..........GGGGGG..GGGG..",
      ".G.......GGGGGGGGGGGGG..",
      ".GG....GGGGGGGGGGGGGEGG.",
      "..GGG.GGGGGGGGGGGGGGGGGG",
      "...GGGGGGGGGGGGGGGGGGGGG",
      "....GGGGGGGGGGGGGGGGGWWW",
      "....gGGGGGGGGGGGGGGGGG..",
      ".....ggGGGGGGGGGGGGGG...",
      "......LL.LL.....LL.LL...",
      ".....LL...LL...LL...LL..",
    ],
  ],
};

const skeletonPalette = {
  W: "#e8dcc0",
  w: "#c9bda3",
  E: "#1a0a0a",
};

export const SKELETON: PixelSprite = {
  palette: skeletonPalette,
  frames: [
    [
      "................",
      ".....WWWWWW.....",
      "....WWWWWWWW....",
      "....WWWWWWWW....",
      "....WEEWWEEW....",
      "....WWWWWWWW....",
      ".....WwwwwW.....",
      ".....W.WW.W.....",
      "......wWWw......",
      "....WWWWWWWW....",
      "...W.WWWWWW.W...",
      "...W.W.WW.W.W...",
      "...W.WWWWWW.W...",
      "...W.W.WW.W.W...",
      "...W.WWWWWW.W...",
      "...W..WWWW..W...",
      ".......WW.......",
      "......WWWW......",
      "......W..W......",
      "......W..W......",
      "......W..W......",
      ".....WW..WW.....",
    ],
    [
      "................",
      ".....WWWWWW.....",
      "....WWWWWWWW....",
      "....WWWWWWWW....",
      "....WEEWWEEW....",
      "....WWWWWWWW....",
      ".....WwwwwW.....",
      ".....W.WW.W.....",
      "......wWWw......",
      "....WWWWWWWW....",
      "...W.WWWWWW.W...",
      "...W.W.WW.W.W...",
      "...W.WWWWWW.W...",
      "...W.W.WW.W.W...",
      "....W.WWWWWW....",
      "....W..WWWW.W...",
      ".......WW.......",
      "......WWWW......",
      ".....W....W.....",
      ".....W....W.....",
      "....W......W....",
      "....WW....WW....",
    ],
  ],
};

const harpyPalette = {
  H: "#f0c8a0",
  E: "#1a0a0a",
  P: "#8e44ad",
  p: "#6c3483",
  S: "#5b2c6f",
  Y: "#e6b800",
  R: "#c0392b",
};

export const HARPY: PixelSprite = {
  palette: harpyPalette,
  frames: [
    [
      "..........RHHR............",
      ".........RHHHHR...........",
      "PP.......HEHHEH.......PP..",
      "PPP......HHHHHH......PPP..",
      "PPPP.....SHHHHS.....PPPP..",
      ".PPPPP..SSSSSSSS..PPPPP...",
      "..PPPPPPSSSSSSSSPPPPPP....",
      "...pPPPPSSSSSSSSPPPPp.....",
      "....ppPPSSSSSSSSPPpp......",
      "........SSSSSSSS..........",
      ".........SSSSSS...........",
      "..........SSSS............",
      "..........Y..Y............",
      ".........YY..YY...........",
    ],
    [
      "..........RHHR............",
      ".........RHHHHR...........",
      ".........HEHHEH...........",
      ".........HHHHHH...........",
      "....P....SHHHHS....P......",
      "...PPP..SSSSSSSS..PPP.....",
      "..PPPPPPSSSSSSSSPPPPPP....",
      ".PPPPPPPSSSSSSSSPPPPPPP...",
      "PPpppPPPSSSSSSSSPPPpppPP..",
      "........SSSSSSSS..........",
      ".........SSSSSS...........",
      "..........SSSS............",
      "..........Y..Y............",
      ".........YY..YY...........",
    ],
  ],
};

const shadePalette = {
  S: "#8e7cc3",
  s: "#5e4b8b",
  E: "#ffffff",
};

export const SHADE: PixelSprite = {
  palette: shadePalette,
  frames: [
    [
      ".....SSSSSS.....",
      "....SSSSSSSS....",
      "...SSSSSSSSSS...",
      "...SSESSSSESS...",
      "...SSSSSSSSSS...",
      "...SSSSSSSSSS...",
      "...SSSSSSSSSS...",
      "...sSSSSSSSSs...",
      "...sSSSSSSSSs...",
      "....sSSSSSSs....",
      "....sS.SS.Ss....",
      ".....s.ss.s.....",
    ],
    [
      ".....SSSSSS.....",
      "....SSSSSSSS....",
      "...SSSSSSSSSS...",
      "...SSESSSSESS...",
      "...SSSSSSSSSS...",
      "...SSSSSSSSSS...",
      "...SSSSSSSSSS...",
      "...sSSSSSSSSs...",
      "....sSSSSSSs....",
      "....sSSSSSSs....",
      ".....sS.SSs.....",
      "......s..s......",
    ],
  ],
};

const heroPalette = {
  A: "#5d8fc9",
  a: "#3b6ba3",
  H: "#f0c8a0",
  E: "#1a0a0a",
  W: "#e8e8f0",
  D: "#2c3e50",
  G: "#f1c40f",
};

export const HERO_FALLBACK: PixelSprite = {
  palette: heroPalette,
  frames: [
    [
      ".....WWWWWW.....",
      "....WWWWWWWW....",
      "....WWHHHHWW....",
      "....WHEHHEHW....",
      "....WHHHHHHW....",
      ".....HHHHHH.....",
      "...AAAAAAAAAA...",
      "..AAAAGAAGAAAA..",
      "..AAAAAAAAAAAA..",
      "..AHAAAAAAAAHA..",
      "..AHAaaaaaaAHA..",
      ".....aaaaaa.....",
      ".....DD..DD.....",
      ".....DD..DD.....",
      ".....DD..DD.....",
      "....DDD..DDD....",
    ],
  ],
};
