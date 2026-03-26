import {
  quote,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Press", icon: "//" };

export default function Press() {
  return [
    row([
      col([
        quote(
          "Glass Cathedral makes music that feels like watching weather systems collide in slow motion. The Weight of Light is their definitive statement -- enormous, patient, and devastatingly beautiful.",
          "Pitchfork (8.4)",
        ),
      ], { span: 6, xs: 12 }),
      col([
        quote(
          "There is a moment twenty minutes into Tidal Memory where the bass drops out and all you hear is waves and a single bowed guitar. I have listened to it a hundred times and it still stops me cold.",
          "The Quietus",
        ),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        quote(
          "When the Grid Goes Dark is what happens when a post-rock band decides to get angry. The heaviest record in their catalog, and one of the best guitar albums of 2021.",
          "Stereogum",
        ),
      ], { span: 6, xs: 12 }),
      col([
        quote(
          "In a genre that often mistakes length for depth, Glass Cathedral is the rare band that earns every minute. Their live show is transcendent -- bring earplugs and an open heart.",
          "NPR Music",
        ),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
