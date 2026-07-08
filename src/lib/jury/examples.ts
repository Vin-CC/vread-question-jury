import type { JuryInput } from "./types";

export type DemoExample = JuryInput & {
  id: string;
  label: string;
  expectedOutcome: string;
};

export const demoExamples: DemoExample[] = [
  {
    id: "good",
    label: "Good question",
    expectedOutcome: "Should approve",
    excerpt:
      "Dorothy followed the yellow road until the trees opened into a field of blue flowers. The Scarecrow walked beside her, careful not to trip over the stones. When the Tin Woodman heard a faint crying, he raised his axe and pointed toward a small cottage. Inside, a woman named Nimmie Amee was polishing a silver whistle that had belonged to her father. She told them the whistle could summon the field mice, but only if it was blown three times at sunrise. Dorothy thanked her and tucked the whistle into the basket with Toto's bread.",
    question: "What object does Nimmie Amee polish inside the cottage?",
    answer: "silver whistle",
  },
  {
    id: "bad-evidence",
    label: "Bad evidence",
    expectedOutcome: "Should reject",
    excerpt:
      "At dusk, Karim reached the observatory and found the brass telescope covered with dust. His sister Lina had left a note beside the stairs, warning him not to open the west dome during the storm. He waited until the thunder moved beyond the hills, then climbed to the roof and adjusted the mirror by hand. When the clouds parted, he saw three bright stars arranged like a crooked crown.",
    question: "What constellation did Karim identify through the telescope?",
    answer: "Orion",
  },
  {
    id: "ambiguous-easy",
    label: "Ambiguous / too easy",
    expectedOutcome: "Should rewrite or reject",
    excerpt:
      "Mara entered the bakery before dawn. The oven was warm, the windows were fogged, and two trays rested on the counter. One tray held almond cakes for the mayor's breakfast. The other tray held round loaves for the fishermen waiting by the pier. Mara slipped a red ribbon around the mayor's tray so her apprentice would not confuse the orders.",
    question: "Where is Mara?",
    answer: "bakery",
  },
];

export const getDefaultExample = () => demoExamples[0];
