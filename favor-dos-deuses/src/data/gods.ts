export interface God {
  id: string;
  name: string;
  domain: string;
  color: number;
  colorHex: string;
  rival: string;
  greeting: string;
  jealousyWarning: string;
  jealousyEvent: string;
}

export const GODS: Record<string, God> = {
  nylea: {
    id: "nylea",
    name: "Nylea",
    domain: "Deusa da Caça e das Florestas",
    color: 0x2ecc71,
    colorHex: "#2ecc71",
    rival: "heliod",
    greeting: "A floresta te observa, mortal. Prove seu valor na caça.",
    jealousyWarning: "Sinto a luz de Heliod em você... Cuidado para não esquecer quem te abençoou.",
    jealousyEvent: "Nylea lança uma maldição de espinhos sobre você por sua devoção a Heliod!",
  },
  heliod: {
    id: "heliod",
    name: "Heliod",
    domain: "Deus do Sol e da Justiça",
    color: 0xf1c40f,
    colorHex: "#f1c40f",
    rival: "nylea",
    greeting: "O sol ilumina seu caminho, herói. Aja com honra.",
    jealousyWarning: "A sombra das florestas de Nylea mancha sua alma. Purifica-te.",
    jealousyEvent: "Heliod cega você temporariamente por adorar a selvageria de Nylea!",
  },
};

export const DEVOTION_MILESTONES = [25, 50, 75, 100];
export const JEALOUSY_THRESHOLD = 40;
export const JEALOUSY_DIFF_TRIGGER = 30;
