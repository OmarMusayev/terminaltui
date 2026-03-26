import {
  card,
  divider,
  link,
  spacer,
  table,
} from "../../../src/index.js";

export const metadata = { label: "Shows", icon: ">>" };

export default function Shows() {
  return [
    divider("Spring / Summer 2025 Tour"),
    spacer(),
    table(
      ["Date", "City", "Venue", "Status"],
      [
        ["Apr 12", "Portland, OR", "Revolution Hall", "Album Release"],
        ["Apr 18", "Seattle, WA", "Neumos", "Co-headline w/ Caspian"],
        ["Apr 25", "San Francisco, CA", "The Chapel", "SOLD OUT"],
        ["May 3", "Los Angeles, CA", "Lodge Room", "Support for Mogwai"],
        ["May 10", "Denver, CO", "Globe Hall", "Headline"],
        ["Jun 14", "Chicago, IL", "Thalia Hall", "Co-headline w/ Russian Circles"],
      ],
    ),
    spacer(),
    divider("Show Details"),
    card({
      title: "Apr 12 -- Portland, OR",
      subtitle: "Revolution Hall",
      body: "Album release show for The Weight of Light. Full album performed front to back with the Portland Cello Project. Support from Grails.",
      tags: ["hometown", "album release", "tickets available"],
    }),
    card({
      title: "Apr 18 -- Seattle, WA",
      subtitle: "Neumos",
      body: "Co-headlining with Caspian. Both bands performing full sets plus a collaborative encore. Doors at 7, music at 8.",
      tags: ["co-headline", "tickets available"],
    }),
    card({
      title: "Apr 25 -- San Francisco, CA",
      subtitle: "The Chapel",
      body: "Intimate show in one of the best rooms on the West Coast. Limited to 400 capacity. Support from Wander.",
      tags: ["sold out"],
    }),
    card({
      title: "May 3 -- Los Angeles, CA",
      subtitle: "Lodge Room",
      body: "Opening for Mogwai on the California leg of their tour. Our first time playing Lodge Room. 45-minute set drawing from all four albums.",
      tags: ["support slot", "tickets available"],
    }),
    card({
      title: "May 10 -- Denver, CO",
      subtitle: "Globe Hall",
      body: "Headline show with local support TBA. Denver has been one of our strongest markets since the first album. After-show hang at the bar next door.",
      tags: ["headline", "tickets available"],
    }),
    card({
      title: "Jun 14 -- Chicago, IL",
      subtitle: "Thalia Hall",
      body: "Co-headlining with Russian Circles. Two of the loudest quiet bands on one stage. Visual projections by Adam Keenan. This will be special.",
      tags: ["co-headline", "tickets available"],
    }),
    spacer(),
    link("Buy Tickets", "https://glasscathedral.com/tickets", { icon: ">" }),
  ];
}
