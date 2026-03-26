import {
  table,
  divider,
  link,
  markdown,
  spacer,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Hours & Location", icon: "@" };

export default function Hours() {
  return [
    row([
      col([
        table(
          ["Day", "Lunch", "Dinner"],
          [
            ["Monday", "Closed", "Closed"],
            ["Tuesday", "11:30 - 2:30", "5:30 - 10:00"],
            ["Wednesday", "11:30 - 2:30", "5:30 - 10:00"],
            ["Thursday", "11:30 - 2:30", "5:30 - 10:30"],
            ["Friday", "11:30 - 2:30", "5:30 - 11:00"],
            ["Saturday", "10:00 - 3:00", "5:00 - 11:00"],
            ["Sunday", "10:00 - 3:00", "5:00 - 9:30"],
          ],
        ),
      ], { span: 7, xs: 12 }),
      col([
        markdown(`**The Rusty Fork**
827 NW Ironworks Lane
Portland, OR 97209

Reservations strongly recommended for dinner.
Walk-ins welcome at the bar and patio.
Valet parking available Friday and Saturday evenings.`),
        spacer(),
        markdown(`**Phone:** (503) 555-0187
**Email:** hello@therustyfork.com`),
      ], { span: 5, xs: 12, padding: 1 }),
    ]),
    spacer(),
    divider("Contact Us"),
    link("Make a Reservation", "https://resy.com/the-rusty-fork", { icon: ">" }),
    link("Google Maps", "https://maps.google.com/?q=827+NW+Ironworks+Lane+Portland+OR", { icon: ">" }),
  ];
}
