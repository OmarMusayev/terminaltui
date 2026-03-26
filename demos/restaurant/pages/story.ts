import { markdown, spacer, quote, container } from "../../../src/index.js";

export const metadata = { label: "Our Story", icon: "&" };

export default function Story() {
  return [
    container([
      markdown(`
# Our Story

The Rusty Fork started as a Thursday-night supper club in a rented commercial kitchen
in Portland's Pearl District. Chef Elena Vasquez, after a decade cooking at restaurants
in San Sebastian, Mexico City, and New York, wanted to build something rooted in
community -- a place where the food was exceptional but the atmosphere felt like dinner
at a friend's house. The first menu was five dishes, one seating, thirty chairs.

Word spread fast. By 2019, we had outgrown the supper club and signed the lease on
our current space: a former ironworks foundry with 30-foot ceilings, original brick,
and a wood-fired hearth that anchors the open kitchen. We source from eleven farms
within 60 miles, butcher whole animals weekly, and bake every loaf of bread that
touches a table. The name came from a rusted fork Elena found embedded in the foundry
wall during demolition -- it hangs above the pass to this day.
      `),
      spacer(),
      quote(
        "The most exciting restaurant to open in Portland in years. Chef Vasquez cooks with the precision of fine dining and the soul of a home kitchen.",
        "The New York Times",
      ),
      quote(
        "This is food that makes you sit up straighter, then lean in closer. Every plate tells you exactly where it came from.",
        "Bon Appetit",
      ),
      quote(
        "A masterclass in restraint. Nothing on the plate that doesn't belong there. Two stars.",
        "Michelin Guide",
      ),
    ], { maxWidth: 80, padding: 1 }),
  ];
}
