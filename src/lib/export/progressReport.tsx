import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Clinician progress report, PDF.
 *
 * Self-measured and clinic-measured values are labelled on every row. A printed report that
 * blurs the two would be worse than the screen it came from, because paper outlives the
 * context that explained it.
 */

export interface ReportMeasurement {
  recordedAt: Date;
  postOpDay: number;
  instrumentKey: string;
  value: number | null;
  method: "SELF" | "CLINIC";
}

export interface ReportInput {
  department: { name: string; hospital: string; contactPhone: string };
  patient: { name: string; mrn: string; age: number | null; operatedSide: string };
  operation: { procedure: string; dateOfSurgery: Date; operatingSurgeon: string } | null;
  phase: { name: string; weekStart: number; weekEnd: number } | null;
  measurements: ReportMeasurement[];
  adherence: { due: number; completed: number };
  alerts: { ruleKey: string; severity: string; raisedAt: Date; status: string }[];
  generatedBy: string;
  generatedAt: Date;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#22262e" },
  h1: { fontSize: 16, marginBottom: 2 },
  sub: { fontSize: 9, color: "#5c626e", marginBottom: 14 },
  section: { marginBottom: 14 },
  h2: { fontSize: 11, marginBottom: 6 },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #dfe2e8", paddingVertical: 3 },
  headerRow: { flexDirection: "row", borderBottom: "1pt solid #9aa0ac", paddingVertical: 3 },
  cell: { flex: 1 },
  cellNarrow: { width: 70 },
  label: { color: "#5c626e" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#5c626e",
    borderTop: "0.5pt solid #dfe2e8",
    paddingTop: 6,
  },
});

function fmt(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ProgressReport({ data }: { data: ReportInput }) {
  const adherencePct =
    data.adherence.due > 0
      ? Math.round((data.adherence.completed / data.adherence.due) * 100)
      : null;

  return (
    <Document title={`Progress report ${data.patient.mrn}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Rehabilitation progress report</Text>
        <Text style={styles.sub}>
          {data.department.name}, {data.department.hospital}
        </Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Patient</Text>
          <Text>
            <Text style={styles.label}>Name: </Text>
            {data.patient.name}
            <Text style={styles.label}>   MRN: </Text>
            {data.patient.mrn}
            <Text style={styles.label}>   Side: </Text>
            {data.patient.operatedSide}
          </Text>
          {data.operation ? (
            <Text>
              <Text style={styles.label}>Procedure: </Text>
              {data.operation.procedure}
              <Text style={styles.label}>   Date of surgery: </Text>
              {fmt(data.operation.dateOfSurgery)}
              <Text style={styles.label}>   Surgeon: </Text>
              {data.operation.operatingSurgeon}
            </Text>
          ) : null}
          {data.phase ? (
            <Text>
              <Text style={styles.label}>Current phase: </Text>
              {data.phase.name} (weeks {data.phase.weekStart} to {data.phase.weekEnd})
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Adherence</Text>
          <Text>
            {data.adherence.completed} of {data.adherence.due} prescribed sessions completed
            {adherencePct !== null ? ` (${adherencePct} percent)` : ""}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Measurements</Text>
          <View style={styles.headerRow}>
            <Text style={styles.cellNarrow}>Date</Text>
            <Text style={styles.cellNarrow}>Post-op day</Text>
            <Text style={styles.cell}>Instrument</Text>
            <Text style={styles.cellNarrow}>Value</Text>
            <Text style={styles.cellNarrow}>Measured by</Text>
          </View>
          {data.measurements.slice(0, 40).map((measurement, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.cellNarrow}>{fmt(measurement.recordedAt)}</Text>
              <Text style={styles.cellNarrow}>{measurement.postOpDay}</Text>
              <Text style={styles.cell}>{measurement.instrumentKey}</Text>
              <Text style={styles.cellNarrow}>
                {measurement.value === null ? "-" : measurement.value}
              </Text>
              <Text style={styles.cellNarrow}>
                {measurement.method === "SELF" ? "Patient" : "Clinic"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Alerts</Text>
          {data.alerts.length === 0 ? (
            <Text>No alerts raised.</Text>
          ) : (
            data.alerts.map((alert, index) => (
              <View key={index} style={styles.row}>
                <Text style={styles.cellNarrow}>{fmt(alert.raisedAt)}</Text>
                <Text style={styles.cellNarrow}>{alert.severity}</Text>
                <Text style={styles.cell}>{alert.ruleKey.replace(/-/g, " ")}</Text>
                <Text style={styles.cellNarrow}>{alert.status}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer} fixed>
          Values marked Patient are self-measured with a paper goniometer and are not
          equivalent to clinic measurement. Generated by {data.generatedBy} on{" "}
          {fmt(data.generatedAt)}. Department contact {data.department.contactPhone}.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderProgressReport(data: ReportInput): Promise<Buffer> {
  return renderToBuffer(<ProgressReport data={data} />);
}
