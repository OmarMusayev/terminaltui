import { accordion, markdown, container } from "../../../src/index.js";

export const metadata = { label: "Quick Start", icon: ">_" };

export default function QuickStart() {
  return [
    container(
      [
        accordion([
          {
            label: "1. Install the CLI",
            content: [
              markdown(`
Install Warpspeed globally using your preferred package manager:

\`\`\`
npm install -g warpspeed
\`\`\`

Verify the installation:

\`\`\`
warpspeed --version
\`\`\`

Authenticate with your account:

\`\`\`
warpspeed login
\`\`\`
              `),
            ],
          },
          {
            label: "2. Configure your project",
            content: [
              markdown(`
Navigate to your project directory and initialize Warpspeed:

\`\`\`
cd my-app
warpspeed init
\`\`\`

Warpspeed auto-detects your framework (Next.js, Remix, Astro, SvelteKit, and 40+ more).
Review the generated \`warpspeed.toml\` and adjust settings if needed. Most projects
need zero configuration changes.
              `),
            ],
          },
          {
            label: "3. Deploy to production",
            content: [
              markdown(`
Deploy with a single command:

\`\`\`
warpspeed deploy --prod
\`\`\`

Your application is live on a globally distributed edge network in under 90 seconds.
Warpspeed assigns a \`.warpspeed.app\` URL immediately, or add a custom domain:

\`\`\`
warpspeed domains add myapp.com
\`\`\`
              `),
            ],
          },
          {
            label: "4. Monitor and iterate",
            content: [
              markdown(`
View real-time logs and metrics:

\`\`\`
warpspeed logs --follow
warpspeed metrics
\`\`\`

Set up alerts for error rate or latency thresholds:

\`\`\`
warpspeed alerts create --metric error_rate --threshold 1% --channel slack
\`\`\`

Every push to your main branch triggers an automatic deployment. Preview deployments
are created for every pull request. Roll back instantly if anything goes wrong:

\`\`\`
warpspeed rollback
\`\`\`
              `),
            ],
          },
        ]),
      ],
      { maxWidth: 80 },
    ),
  ];
}
