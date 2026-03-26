import {
  quote, divider, spacer,
  row, col,
} from "../../../src/index.js";

export const metadata = { label: "Testimonials", icon: "\"" };

export default function Testimonials() {
  return [
    divider("What Clients Say"),
    spacer(),
    row([
      col([
        quote(
          "Kira didn't just design our brand — she understood our story and gave it a visual language. Every detail feels intentional. Two years later, we still get compliments on our identity daily.",
          "Elena Marchetti, Founder at Solstice Wellness",
        ),
      ], { span: 6, xs: 12 }),
      col([
        quote(
          "Working with Studio Kira transformed how our team thinks about design. The system she built isn't just beautiful — it's practical, scalable, and our engineers actually enjoy using it.",
          "James Chen, CTO at Luminary Finance",
        ),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    spacer(),
    row([
      col([
        quote(
          "The packaging Kira designed sells itself. We've watched customers pick up our bags purely because of the label design. She turned our beans into a shelf experience.",
          "Rosa Gutierrez, Co-founder at Terraform Coffee",
        ),
      ], { span: 6, xs: 12 }),
      col([
        quote(
          "Kira has a rare talent for making the complex feel simple. Our portfolio went from a cluttered mess to a calm, confident showcase. Inquiries doubled within three months.",
          "David Okafor, Principal at Verdant Architecture",
        ),
      ], { span: 6, xs: 12 }),
    ], { gap: 1 }),
    spacer(),
    row([
      col([
        quote(
          "She designed our entire component library in eight weeks and it's been running for two years without a major revision. That's how you know the architecture is solid.",
          "Mika Tanaka, Lead Engineer at Arcadia Games",
        ),
      ], { span: 12 }),
    ]),
  ];
}
