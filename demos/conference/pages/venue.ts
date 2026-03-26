import {
  card,
  markdown,
  link,
  spacer,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Venue", icon: "#" };

export default function Venue() {
  return [
    row([
      col(
        [
          markdown(`
## Oregon Convention Center

TermConf 2026 takes place at the **Oregon Convention Center** in Portland's Central Eastside — the largest convention center in the Pacific Northwest. Sustainably powered, excellent transit access, and 5 minutes from some of the best coffee in the country.

The conference occupies **Hall D** with seating for 800 attendees, plus two breakout rooms for workshops and an open lounge with power outlets at every seat.
          `),
          spacer(),
          card({
            title: "Getting There",
            subtitle: "Transit & Parking",
            body: "MAX Green and Orange Line to Convention Center station — a 2-minute walk to the entrance. Garage parking on-site at $15/day with EV charging available.",
            tags: ["MAX Light Rail", "On-Site Parking", "EV Charging"],
          }),
          spacer(),
          link("Get Directions", "https://maps.google.com/?q=Oregon+Convention+Center", { icon: ">" }),
          link("MAX Light Rail Schedule", "https://trimet.org/max", { icon: ">" }),
        ],
        { span: 7, sm: 12, xs: 12 },
      ),
      col(
        [
          card({
            title: "Oregon Convention Center — Hall D",
            subtitle: "777 NE MLK Jr Blvd, Portland, OR 97232",
            body: "800-seat main hall, two breakout rooms for workshops, and an open lounge with power outlets at every seat. Full catering, high-speed Wi-Fi, and on-site A/V support.",
            tags: ["800 Seats", "Workshops", "Lounge"],
          }),
          card({
            title: "Hyatt Regency Portland",
            subtitle: "Partner Hotel — $189/night with code TERMCONF26",
            body: "Five-minute walk from the convention center. Book by May 15 to guarantee the block rate. Complimentary Wi-Fi and late checkout for conference attendees.",
            tags: ["Partner Hotel", "Block Rate"],
          }),
          card({
            title: "Nearby Dining",
            subtitle: "Portland's Central Eastside",
            body: "Some of the best coffee and food in the Pacific Northwest within walking distance. Stumptown Coffee (3 min), Pine State Biscuits (5 min), Pok Pok (10 min).",
            tags: ["Coffee", "Restaurants"],
          }),
          spacer(),
          link("Book Hotel (Hyatt Regency)", "https://hyatt.com/termconf26", { icon: ">" }),
        ],
        { span: 5, sm: 12, xs: 12 },
      ),
    ]),
  ];
}
