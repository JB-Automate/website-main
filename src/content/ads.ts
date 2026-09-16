export interface ServiceLandingContent {
  slug: string;
  label: string;
  title: string;
  description: string;
  heading: [string, string];
  introduction: string;
  primaryAction: string;
  secondaryAction: string;
  outcomes: Array<{ title: string; description: string }>;
  examples: Array<{ title: string; description: string }>;
  fit: string[];
  process: Array<{ title: string; description: string }>;
  faqs: Array<{ question: string; answer: string }>;
}

export const serviceLandings: Record<"workflow" | "aiApps", ServiceLandingContent> = {
  workflow: {
    slug: "workflow-automation",
    label: "Workflow automation",
    title: "Workflow automation for Alberta businesses | JB Automate",
    description:
      "Custom workflow automation for Alberta businesses. Connect routine steps, reduce manual handoffs, and keep people in control of important decisions.",
    heading: ["Make the handoffs", "between your tools work."],
    introduction:
      "We build practical automations around the way your team already works—so requests move, information gets prepared, and the right person knows what to do next.",
    primaryAction: "Discuss your workflow",
    secondaryAction: "See what we can connect",
    outcomes: [
      {
        title: "Less re-entering.",
        description: "Move approved information between the systems your team already relies on.",
      },
      {
        title: "Clearer handoffs.",
        description: "Route work, reminders, and review steps without another manual relay.",
      },
      {
        title: "People stay in control.",
        description: "Keep judgment, approvals, and exceptions with the people responsible for them.",
      },
    ],
    examples: [
      {
        title: "Incoming requests",
        description: "Collect the right details, prepare the next step, and route the request to the right owner.",
      },
      {
        title: "Documents and follow-ups",
        description: "Prepare consistent drafts and reminders from approved business information for a person to review.",
      },
      {
        title: "Status and reporting",
        description: "Bring routine updates together without asking staff to rebuild the same report each time.",
      },
      {
        title: "Approvals and exceptions",
        description: "Move standard work forward while surfacing unusual cases for human attention.",
      },
    ],
    fit: [
      "A repeated process is consuming staff time.",
      "Information is copied between emails, forms, documents, or business systems.",
      "The workflow has a clear owner and people who can explain how it works today.",
      "You want an operated solution, not a folder of generated code.",
    ],
    process: [
      {
        title: "Map the work.",
        description: "Identify the trigger, decisions, systems, data, exceptions, and desired outcome.",
      },
      {
        title: "Prove the path.",
        description: "Build the smallest useful flow, test it with real scenarios, and agree where review belongs.",
      },
      {
        title: "Launch responsibly.",
        description: "Deploy with clear ownership, monitoring, support, and a plan for changes after launch.",
      },
    ],
    faqs: [
      {
        question: "Can you work with the systems we already use?",
        answer:
          "We assess the tools, available integrations, access requirements, and process constraints before proposing an approach. You will know what can connect and where a manual or review step should remain.",
      },
      {
        question: "Does automation remove staff decisions?",
        answer:
          "Not by default. We separate repeatable handling from judgment and design explicit review or approval steps where people should remain responsible.",
      },
      {
        question: "Do we need a technical specification?",
        answer:
          "No. Start with the work that is slow, repetitive, or easy to lose track of. We turn that into a shared process and technical plan.",
      },
      {
        question: "What happens after launch?",
        answer:
          "Maintenance, monitoring, support responsibilities, and escalation are agreed for the engagement. We do not leave the workflow without an owner.",
      },
    ],
  },
  aiApps: {
    slug: "custom-ai-apps",
    label: "Custom AI applications",
    title: "Custom AI applications for Alberta businesses | JB Automate",
    description:
      "Focused internal AI tools built around your business context, review requirements, and data boundaries—with support beyond launch.",
    heading: ["Turn repeatable expertise", "into a focused AI tool."],
    introduction:
      "We turn a well-defined business task into an application your team can use without prompt-engineering homework. Context, instructions, safeguards, and review are designed into the experience.",
    primaryAction: "Plan an AI tool",
    secondaryAction: "See where AI fits",
    outcomes: [
      {
        title: "A tool with a job.",
        description: "Build for a specific task and user instead of adding a general chatbot to everything.",
      },
      {
        title: "Your context built in.",
        description: "Use approved instructions, reference material, and output structure consistently.",
      },
      {
        title: "Review by design.",
        description: "Make uncertainty, sources, validation, and human sign-off part of the workflow.",
      },
    ],
    examples: [
      {
        title: "Draft preparation",
        description: "Prepare a consistent first draft from approved inputs, ready for a knowledgeable person to review.",
      },
      {
        title: "Knowledge assistance",
        description: "Help staff find and use approved internal guidance without replacing source material or policy owners.",
      },
      {
        title: "Structured review",
        description: "Check work against an agreed rubric and surface gaps, questions, or exceptions for attention.",
      },
      {
        title: "Case or project summaries",
        description: "Turn permitted source material into a repeatable format while preserving a clear review step.",
      },
    ],
    fit: [
      "The task has a repeatable goal and recognizable good output.",
      "Subject-matter experts can explain the context, risks, and exceptions.",
      "The information and providers can be reviewed before sensitive data is used.",
      "You want a maintained business application rather than a one-off prototype.",
    ],
    process: [
      {
        title: "Define the job.",
        description: "Agree who uses the tool, what it may use, what it produces, and how success will be judged.",
      },
      {
        title: "Test the behaviour.",
        description: "Build against representative examples, failure cases, data boundaries, and review requirements.",
      },
      {
        title: "Put it into practice.",
        description: "Deploy with access controls, ownership, monitoring, support, and a plan for ongoing evaluation.",
      },
    ],
    faqs: [
      {
        question: "Will staff need to learn prompt engineering?",
        answer:
          "They should not need elaborate prompts. The application is designed around normal business inputs, with the core context and instructions built into the tool.",
      },
      {
        question: "Can the tool use internal business information?",
        answer:
          "Only after the data, providers, access, retention, and risks are agreed. The right approach depends on the sensitivity and purpose of the information.",
      },
      {
        question: "How do you handle unreliable AI output?",
        answer:
          "We define acceptable output, test realistic failure cases, add validation where practical, and keep human review where an error would matter.",
      },
      {
        question: "Is this a prototype or a supported application?",
        answer:
          "The goal is a working business tool with agreed deployment and support. Scope, maintenance, monitoring, and response expectations are defined for each engagement.",
      },
    ],
  },
};
