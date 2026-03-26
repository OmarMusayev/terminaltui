import { card, tabs } from "../../../src/index.js";

export const metadata = { label: "Wine", icon: "~" };

export default function Wine() {
  return [
    tabs([
      {
        label: "Red",
        content: [
          card({
            title: "Ridge Monte Bello Cabernet Sauvignon",
            subtitle: "$32 / $128",
            body: "Santa Cruz Mountains, CA -- Structured and age-worthy. Dark cassis, graphite, dried herbs, and iron. Decanted tableside.",
          }),
          card({
            title: "Barolo Massolino Parussi",
            subtitle: "$28 / $112",
            body: "Piedmont, Italy -- Single vineyard Nebbiolo with rose petal, tar, and cherry. Earthy and elegant with silky tannins.",
          }),
          card({
            title: "Chateauneuf-du-Pape Clos des Papes",
            subtitle: "$26 / $104",
            body: "Rhone Valley, France -- Grenache-dominant blend with blackberry, lavender, garrigue, and warm spice. Exceptional with the ribeye.",
          }),
        ],
      },
      {
        label: "White",
        content: [
          card({
            title: "Cloudy Bay Sauvignon Blanc",
            subtitle: "$16 / $64",
            body: "Marlborough, New Zealand -- Vibrant and aromatic with passion fruit, citrus, and a crisp mineral finish. Perfect with our halibut.",
          }),
          card({
            title: "Domaine Weinbach Riesling Grand Cru",
            subtitle: "$22 / $88",
            body: "Alsace, France -- Off-dry with stunning acidity. Stone fruit, petrol, and white flowers. Pairs beautifully with the duck breast.",
          }),
          card({
            title: "Burgundy Meursault Roulot",
            subtitle: "$30 / $120",
            body: "Burgundy, France -- Rich Chardonnay with hazelnut, citrus peel, and a long mineral finish. No new oak, pure terroir expression.",
          }),
        ],
      },
      {
        label: "Sparkling",
        content: [
          card({
            title: "Champagne Billecart-Salmon Brut Rose",
            subtitle: "$24 / $96",
            body: "Champagne, France -- Delicate salmon pink with wild strawberry, brioche, and fine persistent bubbles. Our most popular aperitif.",
          }),
          card({
            title: "Franciacorta Ca' del Bosco Cuvee Prestige",
            subtitle: "$18 / $72",
            body: "Lombardy, Italy -- Italy's answer to Champagne. Crisp green apple, toasted almond, and elegant mousse. Outstanding value.",
          }),
        ],
      },
    ]),
  ];
}
