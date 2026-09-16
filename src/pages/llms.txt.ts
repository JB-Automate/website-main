import { siteContent } from "../content/site";
import { siteConfig } from "../lib/site-config";
import { knowsAbout, serviceArea, serviceNames } from "../lib/seo";

/**
 * /llms.txt is the emerging convention for telling AI answer engines what a site is
 * about in one clean, fetchable document. It is generated from the same content the
 * page renders, so it cannot describe something the site does not say.
 */
export function GET() {
  if (siteConfig.isPreview) {
    return new Response("Not available.\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const base = siteConfig.url.replace(/\/+$/, "");
  const { services, faq, process, security, contact } = siteContent;

  const body = [
    `# ${siteContent.name}`,
    "",
    `> ${siteContent.description}`,
    "",
    `${siteContent.name} builds custom AI applications, automated workflows, and websites for businesses in ` +
      `${serviceArea.city}, ${serviceArea.region}, ${serviceArea.country}, and supports them after launch. ` +
      `${siteContent.proof.heading} ${siteContent.proof.description}`,
    "",
    "## Services",
    "",
    ...services.items.map(
      (service) => `- [${serviceNames[service.id]?.name ?? service.label}](${base}/#services): ${service.description}`,
    ),
    "",
    "## How an engagement works",
    "",
    ...process.steps.map((step) => `- **${step.title}** ${step.description}`),
    "",
    "## Security and support",
    "",
    ...security.items.map((item) => `- **${item.title}** ${item.description}`),
    "",
    "## Frequently asked questions",
    "",
    ...faq.items.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
    "## Areas of expertise",
    "",
    ...knowsAbout.map((topic) => `- ${topic}`),
    "",
    "## Contact",
    "",
    `- [Enquiry form](${base}/#contact): ${contact.description} ${contact.nextStep}`,
    ...(siteConfig.hasPublicEmail ? [`- Email: ${siteConfig.email}`] : []),
    `- [Privacy notice](${base}/privacy/): How enquiry information is collected, used, retained, and deleted.`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
