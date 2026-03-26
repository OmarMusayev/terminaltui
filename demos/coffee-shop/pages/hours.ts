import {
  divider,
  link,
  markdown,
  spacer,
  table,
  row,
  col,
} from "../../../src/index.js";

export const metadata = { label: "Hours & Location", icon: "@" };

export default function Hours() {
  return [
    row([
      col([
        divider("Hours"),
        table(
          ["Day", "Hours"],
          [
            ["Mon - Fri", "6:30 AM - 5:00 PM"],
            ["Saturday", "7:00 AM - 5:00 PM"],
            ["Sunday", "7:30 AM - 4:00 PM"],
            ["Holidays", "8:00 AM - 2:00 PM"],
          ],
        ),
      ], { span: 6, xs: 12 }),
      col([
        divider("Find Us"),
        markdown(`**Ember & Brew**
1847 NE Alberta Street
Portland, OR 97211

Street parking available on Alberta and side streets. Bike rack out front. Dogs welcome on the patio — we keep treats behind the counter.`),
        spacer(),
        link("Get Directions", "https://maps.google.com/?q=1847+NE+Alberta+St+Portland+OR+97211", { icon: ">" }),
        link("Order Ahead for Pickup", "https://order.emberandbrew.com", { icon: ">" }),
        link("Call Us — (503) 555-0179", "tel:+15035550179", { icon: ">" }),
      ], { span: 6, xs: 12, padding: 1 }),
    ]),
  ];
}
