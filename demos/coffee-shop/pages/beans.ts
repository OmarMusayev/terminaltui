import {
  card,
  markdown,
  spacer,
  row,
  col,
  container,
} from "../../../src/index.js";

export const metadata = { label: "Our Beans", icon: "~" };

export default function Beans() {
  return [
    container([
      markdown(`
# Currently Roasting

We source directly from smallholder farms and cooperatives across three continents. Every bag is roasted in small batches at our roastery in the back of the shop.
      `),
    ], { maxWidth: 90 }),
    spacer(),
    row([
      col([
        card({
          title: "Ethiopian Yirgacheffe — Kochere",
          subtitle: "$22 / 12oz",
          body: "Bright and complex with notes of jasmine, bergamot, and ripe blueberry. A natural process lot from the Kochere district at 2,100 meters. Our lightest roast — best as a pour over or AeroPress.",
          tags: ["Light Roast", "Natural Process", "Floral", "Fruity"],
        }),
        card({
          title: "Colombian Huila — La Esperanza",
          subtitle: "$19 / 12oz",
          body: "Sweet and balanced with brown sugar, red apple, and a hint of cinnamon. Grown by the Ortega family at Finca La Esperanza, 1,800 meters. Works beautifully in any brew method.",
          tags: ["Medium Roast", "Washed", "Sweet", "Versatile"],
        }),
      ], { span: 6, xs: 12 }),
      col([
        card({
          title: "Guatemalan Antigua — Finca El Cerezo",
          subtitle: "$20 / 12oz",
          body: "Rich and full-bodied with dark chocolate, toasted almond, and a clean caramel finish. Volcanic soil, shade-grown at 1,500 meters. Our go-to for espresso and cold brew.",
          tags: ["Medium-Dark Roast", "Washed", "Chocolatey"],
        }),
        card({
          title: "Kenyan AA — Nyeri",
          subtitle: "$24 / 12oz",
          body: "Intense and juicy with blackcurrant, grapefruit, and a sparkling phosphoric acidity. Double-washed and sun-dried at 1,900 meters. Not for the faint of heart.",
          tags: ["Light Roast", "Double-Washed", "Fruity", "Bright"],
        }),
      ], { span: 6, xs: 12 }),
    ]),
  ];
}
