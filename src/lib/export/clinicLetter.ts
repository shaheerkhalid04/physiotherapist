import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ReportInput } from "./progressReport";

/**
 * Editable clinic letter, DOCX.
 *
 * Deliberately editable: the letter is a starting point a clinician finishes and signs,
 * not a document the system issues on its own. The signature block is left blank for that
 * reason.
 */
export async function renderClinicLetter(data: ReportInput): Promise<Buffer> {
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const adherencePct =
    data.adherence.due > 0
      ? Math.round((data.adherence.completed / data.adherence.due) * 100)
      : null;

  const latest = data.measurements[0];

  const document = new Document({
    creator: data.department.hospital,
    title: `Clinic letter ${data.patient.mrn}`,
    sections: [
      {
        children: [
          new Paragraph({
            text: data.department.hospital,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: `${data.department.name}. Telephone ${data.department.contactPhone}`,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: fmt(data.generatedAt), alignment: AlignmentType.RIGHT }),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({ text: "Re: ", bold: true }),
              new TextRun({ text: `${data.patient.name}, MRN ${data.patient.mrn}` }),
            ],
          }),
          new Paragraph({ text: "" }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              row("Procedure", data.operation?.procedure ?? "Not recorded"),
              row(
                "Date of surgery",
                data.operation ? fmt(data.operation.dateOfSurgery) : "Not recorded",
              ),
              row("Operating surgeon", data.operation?.operatingSurgeon ?? "Not recorded"),
              row("Operated side", data.patient.operatedSide),
              row(
                "Current phase",
                data.phase
                  ? `${data.phase.name}, weeks ${data.phase.weekStart} to ${data.phase.weekEnd}`
                  : "No active phase",
              ),
            ],
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "Progress", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            text:
              latest && latest.value !== null
                ? `The most recent recorded ${latest.instrumentKey.replace(/-/g, " ")} was ${latest.value} on post-operative day ${latest.postOpDay}, ${
                    latest.method === "SELF"
                      ? "self-measured by the patient at home with a paper goniometer"
                      : "measured in clinic"
                  }.`
                : "No measurements have been recorded yet.",
          }),
          new Paragraph({
            text:
              adherencePct !== null
                ? `The patient completed ${data.adherence.completed} of ${data.adherence.due} prescribed sessions in the review period, ${adherencePct} percent.`
                : "No sessions have fallen due in the review period.",
          }),
          new Paragraph({ text: "" }),

          new Paragraph({ text: "Alerts raised", heading: HeadingLevel.HEADING_2 }),
          ...(data.alerts.length === 0
            ? [new Paragraph({ text: "None." })]
            : data.alerts.map(
                (alert) =>
                  new Paragraph({
                    text: `${fmt(alert.raisedAt)}, ${alert.severity.toLowerCase()}: ${alert.ruleKey.replace(/-/g, " ")} (${alert.status.toLowerCase()}).`,
                    bullet: { level: 0 },
                  }),
              )),
          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text:
                  "Home measurements in this letter are self-reported and are not equivalent to measurement in clinic.",
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Yours sincerely," }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "_________________________" }),
          new Paragraph({ text: "Name and grade" }),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}

function row(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({ children: [new Paragraph({ text: value })] }),
    ],
  });
}
