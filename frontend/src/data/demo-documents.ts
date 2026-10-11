export interface ConsentDocument {
  id: string;
  title: string;
  source: string;
  status: "Active" | "Draft" | "Archived";
  sections: { id: string; title: string; content: string }[];
}
export const demoDocuments: ConsentDocument[] = [
  {
    id: "1",
    title: "Total Knee Arthroplasty",
    source: "knee-replacement-v2.pdf",
    status: "Active",
    sections: [
      {
        id: "s1",
        title: "Introduction",
        content: "Sample consent form for total knee replacement surgery.",
      },
      {
        id: "s2",
        title: "Risks and Side Effects",
        content:
          "Sample section: discuss risks with your care team using the approved consent form.",
      },
      {
        id: "s3",
        title: "Alternatives",
        content:
          "Sample section: review alternatives and voluntary participation with your care team.",
      },
    ],
  },
  ...[
    "Cataract Surgery",
    "General Anesthesia Consent",
    "Dental Implant Procedure",
  ].map((title, i): ConsentDocument => ({
    id: String(i + 2),
    title,
    source: "sample-consent.pdf",
    status: i === 0 ? "Active" : i === 1 ? "Draft" : "Archived",
    sections: [
      "Procedure Overview",
      "Risks and Side Effects",
      "Alternatives",
      "Recovery and Aftercare",
    ].map((title, i) => ({
      id: `s${i + 1}`,
      title,
      content:
        "Sample section for frontend review. Replace with approved consent content before clinical use.",
    })),
  })),
];
