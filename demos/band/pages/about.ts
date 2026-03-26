import {
  card,
  divider,
  markdown,
  spacer,
  row,
  col,
  container,
} from "../../../src/index.js";

export const metadata = { label: "About", icon: "&" };

export default function About() {
  return [
    container([
      markdown(`
# Glass Cathedral

Glass Cathedral formed in Portland, Oregon in 2017 when four musicians from
different corners of the local scene started meeting weekly in a rented practice
space above a screen-printing shop on SE Hawthorne. The original idea was simple:
play long, slow, loud songs with no vocals and see what happens. Within a year
they had recorded their debut -- a single improvised session in an abandoned
church -- and the name stuck.

Over five years and four records, Glass Cathedral has become one of the most
respected bands in the post-rock world. Their sound draws from Godspeed You!
Black Emperor's orchestral scope, Mogwai's dynamic range, and the Pacific
Northwest's own tradition of atmospheric heaviness. They have toured North America
and Europe extensively, played festivals from Pitchfork to Roadburn, and built a
devoted following that fills 1,000-cap rooms on both coasts.
      `),
    ], { maxWidth: 85, padding: 1 }),
    spacer(),
    divider("Members"),
    row([
      col([
        card({
          title: "Maren Calloway",
          subtitle: "Guitar, Keys, Electronics",
          body: "Classically trained pianist who switched to guitar at 19. Builds the layered textures and looping architecture that define the band's sound. Also plays in the ambient duo Pale Lantern.",
        }),
      ], { span: 6, sm: 6, xs: 12 }),
      col([
        card({
          title: "Jesse Okafor",
          subtitle: "Guitar, Lap Steel",
          body: "Grew up playing in church bands in Lagos before moving to Portland for college. Brings a melodic sensibility and rhythmic complexity that grounds the more abstract compositions. Handles most of the live effects processing.",
        }),
      ], { span: 6, sm: 6, xs: 12 }),
    ], { gap: 1 }),
    row([
      col([
        card({
          title: "Danny Reeves",
          subtitle: "Bass, Synth",
          body: "Former jazz upright bassist who fell in love with distortion pedals. Runs a bass rig that rattles windows. Responsible for the sub-frequency drone textures on When the Grid Goes Dark.",
        }),
      ], { span: 6, sm: 6, xs: 12 }),
      col([
        card({
          title: "Sofia Trujillo",
          subtitle: "Drums, Percussion",
          body: "The engine of the band. Studied under Matt Cameron and cites both Bill Bruford and Janet Weiss as primary influences. Known for building tension across ten-minute arcs and explosive, cymbal-heavy crescendos.",
        }),
      ], { span: 6, sm: 6, xs: 12 }),
    ], { gap: 1 }),
  ];
}
