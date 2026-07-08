import type { WorkflowData } from "./types";

export type SampleDocument = {
  id: string;
  title: string;
  description: string;
  text: string;
};

const paragraph = `Mara entered the bakery before dawn. The oven was warm, the windows were fogged, and two trays rested on the counter. One tray held almond cakes for the mayor's breakfast. The other tray held round loaves for the fishermen waiting by the pier. Mara slipped a red ribbon around the mayor's tray so her apprentice would not confuse the orders. When the bell over the door rang, she hid the ribbon under a folded receipt and asked the apprentice to watch which tray the mayor's courier chose.`;

export const sampleDocuments: SampleDocument[] = [
  {
    id: "bakery-orders",
    title: "Sample: Bakery Orders",
    description: "A short scene designed to produce a rewrite-worthy first question and a strong improved one.",
    text: Array.from({ length: 10 }, (_, index) =>
      index === 4
        ? paragraph
        : `Chapter note ${index + 1}. Mara reviewed the delivery list, checked the flour sacks, and listened for footsteps outside the quiet shop. The morning was busy, but every order depended on careful attention to small labels and gestures.`
    ).join("\n\n"),
  },
  {
    id: "observatory",
    title: "Sample: Observatory Storm",
    description: "A scene with concrete details for evidence-grounded question generation.",
    text: `At dusk, Karim reached the observatory and found the brass telescope covered with dust. His sister Lina had left a note beside the stairs, warning him not to open the west dome during the storm. He waited until the thunder moved beyond the hills, then climbed to the roof and adjusted the mirror by hand. When the clouds parted, he saw three bright stars arranged like a crooked crown. Karim copied the shape into Lina's notebook before the rain returned.`,
  },
];

export function sampleToWorkflowData(sample: SampleDocument): WorkflowData {
  return {
    document: {
      metadata: {
        name: sample.title,
        kind: "sample",
        source: "sample",
        wordCount: sample.text.split(/\s+/).filter(Boolean).length,
      },
      rawText: sample.text,
    },
    extractedText: sample.text,
  };
}
