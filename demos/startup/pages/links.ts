import { link, row, col, section } from "../../../src/index.js";

export const metadata = { label: "Links", icon: "->" };

export default function Links() {
  return [
    row(
      [
        col(
          [
            section("Resources", [
              link("Documentation", "https://docs.warpspeed.dev", { icon: ">" }),
              link("GitHub", "https://github.com/warpspeed-dev", { icon: ">" }),
              link("Blog", "https://warpspeed.dev/blog", { icon: ">" }),
            ]),
          ],
          { span: 6, xs: 12 },
        ),
        col(
          [
            section("Community", [
              link("Discord Community", "https://discord.gg/warpspeed", { icon: ">" }),
              link("Status Page", "https://status.warpspeed.dev", { icon: ">" }),
              link("Twitter", "https://twitter.com/warpspeed_dev", { icon: ">" }),
            ]),
          ],
          { span: 6, xs: 12 },
        ),
      ],
      { gap: 1 },
    ),
  ];
}
