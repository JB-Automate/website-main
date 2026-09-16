export const siteContent = {
  name: "JB Automate",
  description:
    "Custom AI apps, automated workflows, and websites built around your business. Practical tools, thoughtful data handling, and support beyond launch.",
  navigation: [
    { label: "What we do", href: "#services" },
    { label: "Our approach", href: "#difference" },
    { label: "Security & support", href: "#security" },
  ],
  primaryAction: "Tell us what you need",
  hero: {
    heading: ["Put AI to work.", "On your terms."],
    description:
      "AI apps, connected workflows, and websites built for your business. Thoughtful about your data. Supported beyond launch.",
    secondaryAction: "See it in action",
  },
  proof: {
    heading: "Working directly with the Government of Alberta.",
    description:
      "Building internal, in-house AI applications that support branch operations.",
    // Add only an approved, attributable outcome; never fill this with an invented number.
    verifiedOutcome: null as { value: string; context: string } | null,
  },
  services: {
    heading: ["Less busywork.", "More room for business."],
    description:
      "Your team uses the tool. We handle the AI behind it.",
    items: [
      {
        id: "apps",
        label: "AI apps",
        title: ["Built for the task.", "Not for the prompt."],
        description:
          "Your context and instructions, built into a focused tool. No prompt engineering homework for your team.",
        action: "Build a tool for your team",
      },
      {
        id: "workflows",
        label: "Workflows",
        title: ["One clear handoff.", "Not a relay race."],
        description:
          "Connect the steps between an incoming request and a useful result. Less back-and-forth. Your people still make the decisions.",
        action: "Simplify your workflow",
      },
      {
        id: "websites",
        label: "Websites",
        title: ["A first impression", "that feels like you."],
        description:
          "A clear offer, a distinctive presence, and an easy next step. A website that does your business justice.",
        action: "Create your website",
      },
    ],
  },
  work: {
    label: "",
    task: {
      label: "Prepare a follow-up",
      heading: "A follow-up, ready.",
      lines: ["Confirm the project goal.", "Arrange the next conversation."],
    },
    note: "",
  },
  comparison: {
    heading: ["A starting point is not", "the whole solution."],
    description:
      "AI can write code. We turn it into something your business can depend on.",
    leftHeading: "What Claude gives out",
    leftSubtitle: "A one-off generated starting point",
    rightHeading: "What we provide",
    rightSubtitle: "Built, delivered, and supported",
    rows: [
      {
        criterion: "No prompt homework",
        startingPoint:
          "An initial app or interaction for your team to adapt.",
        delivered:
          "A ready-to-use workflow. The context and instructions are built in.",
      },
      {
        criterion: "Data security",
        startingPoint:
          "Generated controls still need review, deployment, and an owner.",
        delivered:
          "Data and access controls designed around your agreed requirements.",
      },
      {
        criterion: "Privacy",
        startingPoint:
          "Processing, access, and retention decisions remain yours to resolve.",
        delivered:
          "Data flows, providers, and retention agreed before sensitive information is used.",
      },
      {
        criterion: "Faster workflows",
        startingPoint:
          "Your team still connects the code to the real process.",
        delivered:
          "Connected steps, built around the job. Less manual back-and-forth.",
      },
      {
        criterion: "More consistent work",
        startingPoint:
          "Task behavior and acceptable outputs still need to be defined.",
        delivered:
          "Repeatable flows, validation, and appropriate human review.",
      },
      {
        criterion: "Expert-built architecture",
        startingPoint:
          "Implementation choices still need business-specific evaluation.",
        delivered:
          "Current, fit-for-purpose architecture. No chasing prompt tricks.",
      },
      {
        criterion: "Support after launch",
        startingPoint:
          "Generated code does not come with an operated support service.",
        delivered:
          "A responsible partner. Agreed maintenance, support, and escalation.",
      },
    ],
    note: "",
  },
  security: {
    heading: ["Your trust is part", "of the brief."],
    description:
      "Your information, your people, and life after launch. Considered together, not left for later.",
    items: [
      {
        id: "data",
        label: "Data",
        title: "Know where your information goes.",
        description:
          "Agree what is needed, where it is processed, and what is retained before sensitive data is used.",
      },
      {
        id: "access",
        label: "Access",
        title: "Make access intentional.",
        description:
          "Permissions and review steps designed around the people doing the work.",
      },
      {
        id: "support",
        label: "Support",
        title: "Keep a real partner in the picture.",
        description:
          "An agreed plan for maintenance, support, and what happens when something needs attention.",
      },
    ],
    note: "",
  },
  process: {
    heading: "You bring the business need.",
    steps: [
      {
        title: "A conversation.",
        description:
          "Tell us where the work gets difficult. No technical brief needed.",
      },
      {
        title: "A shared plan.",
        description:
          "Agree the goal, scope, data requirements, and what a good result looks like.",
      },
      {
        title: "A working solution.",
        description:
          "Build, launch, and establish the support your business needs.",
      },
    ],
  },
  faq: {
    heading: ["Good questions.", "Straight answers."],
    items: [
      {
        question: "Will our staff need to learn how to prompt AI?",
        answer:
          "No prompt-engineering expertise should be needed. We build the context and instructions into the tool. Staff may enter normal questions or business inputs and review the output, without constantly rewriting elaborate prompts.",
      },
      {
        question: "How will our business information be handled?",
        answer:
          "We agree processing, providers, retention, and access with you before building. Controls depend on the engagement. The public enquiry form is for a high-level introduction, not protected business data.",
      },
      {
        question: "Can you work with the tools we already use?",
        answer:
          "We assess your systems and available integrations before proposing an approach. You will know what can connect, what cannot, and what would need to change.",
      },
      {
        question: "What happens after launch?",
        answer:
          "We agree maintenance, support responsibilities, and escalation with you. Availability and response expectations depend on your engagement, rather than a blanket promise.",
      },
    ],
  },
  contact: {
    heading: ["Let's make work", "work better."],
    description:
      "Tell us what gets in the way. You don't need to have the solution figured out.",
    nextStep:
      "We'll get in touch to arrange a conversation.",
  },
  privacy: {
    retention:
      "Enquiry emails stay in our business mailbox while we are in contact and for up to 24 months after the last message, then we delete them. Where the enquiry endpoint is running, the copy it keeps for follow-up is deleted on the same schedule. Ask us at the address on this page to delete your enquiry sooner: we action deletion requests within 30 days and confirm when it is done. Mailbox and email providers may keep their own delivery or backup records under their own arrangements, and we cannot delete a message you sent from your own sent items.",
  },
} as const;
