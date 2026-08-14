-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'THERAPIST', 'SURGEON', 'ADMIN');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('LEFT', 'RIGHT', 'BILATERAL');

-- CreateEnum
CREATE TYPE "Dominance" AS ENUM ('LEFT', 'RIGHT', 'AMBIDEXTROUS');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'UR');

-- CreateEnum
CREATE TYPE "MeasurementMethod" AS ENUM ('SELF', 'CLINIC');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'COMPLETE', 'PARTIAL', 'MISSED');

-- CreateEnum
CREATE TYPE "ExerciseLogStatus" AS ENUM ('DONE', 'PARTIAL', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "NotDoneReason" AS ENUM ('PAIN', 'SWELLING', 'TOO_DIFFICULT', 'FORGOT', 'NO_TIME', 'SPLINT_PROBLEM', 'UNWELL', 'OTHER');

-- CreateEnum
CREATE TYPE "OrthosisCompliance" AS ENUM ('WORN_AS_INSTRUCTED', 'WORN_PARTIALLY', 'NOT_WORN', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('URGENT', 'REVIEW', 'OUTREACH');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "PromInstrument" AS ENUM ('QUICKDASH', 'PRWHE');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hospital" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "travelNote" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "pinHash" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "mrn" TEXT NOT NULL,
    "userId" TEXT,
    "enrolledById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "age" INTEGER,
    "sex" "Sex" NOT NULL,
    "phone" TEXT NOT NULL,
    "operatedSide" "Side" NOT NULL,
    "dominance" "Dominance" NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'UR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "dateOfSurgery" TIMESTAMP(3) NOT NULL,
    "structures" JSONB NOT NULL,
    "fixation" TEXT,
    "precautions" TEXT,
    "operatingSurgeon" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolTemplate" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indication" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolPhase" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "goals" TEXT NOT NULL,
    "permittedMovements" TEXT[],
    "forbiddenMovements" TEXT[],
    "orthosis" TEXT,
    "orthosisSchedule" TEXT,
    "progressionCriteria" TEXT NOT NULL,
    "redFlags" TEXT[],

    CONSTRAINT "ProtocolPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolExercise" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "holdSeconds" INTEGER NOT NULL DEFAULT 0,
    "frequencyPerDay" INTEGER NOT NULL,
    "mediaKey" TEXT,

    CONSTRAINT "ProtocolExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProtocol" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sourceTemplateId" TEXT NOT NULL,
    "sourceTemplateVersion" INTEGER NOT NULL,
    "sourceTemplateReviewedById" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "surgeonNotes" TEXT,

    CONSTRAINT "PatientProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPhase" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "goals" TEXT NOT NULL,
    "permittedMovements" TEXT[],
    "forbiddenMovements" TEXT[],
    "orthosis" TEXT,
    "orthosisSchedule" TEXT,
    "progressionCriteria" TEXT NOT NULL,
    "redFlags" TEXT[],
    "activeFrom" TIMESTAMP(3),
    "activeTo" TIMESTAMP(3),

    CONSTRAINT "PatientPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientExercise" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "holdSeconds" INTEGER NOT NULL DEFAULT 0,
    "frequencyPerDay" INTEGER NOT NULL,
    "mediaKey" TEXT,

    CONSTRAINT "PatientExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseTransition" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "fromPhaseId" TEXT,
    "toPhaseId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "denied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhaseTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "postOpDay" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "orthosis" "OrthosisCompliance" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLog" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "status" "ExerciseLogStatus" NOT NULL,
    "reason" "NotDoneReason",
    "reasonText" TEXT,
    "setsDone" INTEGER,
    "repsDone" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "ExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomLog" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "postOpDay" INTEGER NOT NULL,
    "painAtRest" INTEGER NOT NULL,
    "painOnMovement" INTEGER NOT NULL,
    "swelling" INTEGER NOT NULL,
    "stiffness" INTEGER NOT NULL,
    "fever" BOOLEAN NOT NULL DEFAULT false,
    "spreadingRedness" BOOLEAN NOT NULL DEFAULT false,
    "discharge" BOOLEAN NOT NULL DEFAULT false,
    "numbness" BOOLEAN NOT NULL DEFAULT false,
    "colourChange" BOOLEAN NOT NULL DEFAULT false,
    "coldIntolerance" BOOLEAN NOT NULL DEFAULT false,
    "temperatureChange" BOOLEAN NOT NULL DEFAULT false,
    "patientConcern" BOOLEAN NOT NULL DEFAULT false,
    "concernText" TEXT,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SymptomLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "instrumentKey" TEXT NOT NULL,
    "instrumentVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "value" DOUBLE PRECISION,
    "derived" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "postOpDay" INTEGER NOT NULL,
    "enteredById" TEXT NOT NULL,
    "enteredByRole" "Role" NOT NULL,
    "method" "MeasurementMethod" NOT NULL,
    "side" "Side" NOT NULL,
    "supersedesId" TEXT,
    "warnings" TEXT[],
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromResponse" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "instrument" "PromInstrument" NOT NULL,
    "itemResponses" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "subscores" JSONB,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "postOpDay" INTEGER,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "PromResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" "MediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "patientNotified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertThreshold" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "protocolKey" TEXT,
    "params" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "templateKey" TEXT,
    "bodyEn" TEXT NOT NULL,
    "bodyUr" TEXT,
    "urMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderJob" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "ReminderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncReceipt" (
    "id" TEXT NOT NULL,
    "batchUuid" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "accepted" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "rejected" INTEGER NOT NULL,
    "detail" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_departmentId_role_idx" ON "User"("departmentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE INDEX "Patient_departmentId_idx" ON "Patient"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_departmentId_mrn_key" ON "Patient"("departmentId", "mrn");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_patientId_key" ON "Operation"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolTemplate_departmentId_key_version_key" ON "ProtocolTemplate"("departmentId", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolPhase_templateId_order_key" ON "ProtocolPhase"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolExercise_phaseId_order_key" ON "ProtocolExercise"("phaseId", "order");

-- CreateIndex
CREATE INDEX "PatientProtocol_patientId_active_idx" ON "PatientProtocol"("patientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPhase_protocolId_order_key" ON "PatientPhase"("protocolId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PatientExercise_phaseId_order_key" ON "PatientExercise"("phaseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Session_clientUuid_key" ON "Session"("clientUuid");

-- CreateIndex
CREATE INDEX "Session_patientId_scheduledFor_idx" ON "Session"("patientId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLog_clientUuid_key" ON "ExerciseLog"("clientUuid");

-- CreateIndex
CREATE INDEX "ExerciseLog_sessionId_idx" ON "ExerciseLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SymptomLog_clientUuid_key" ON "SymptomLog"("clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "SymptomLog_sessionId_key" ON "SymptomLog"("sessionId");

-- CreateIndex
CREATE INDEX "SymptomLog_patientId_recordedAt_idx" ON "SymptomLog"("patientId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_clientUuid_key" ON "Measurement"("clientUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_supersedesId_key" ON "Measurement"("supersedesId");

-- CreateIndex
CREATE INDEX "Measurement_patientId_instrumentKey_recordedAt_idx" ON "Measurement"("patientId", "instrumentKey", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromResponse_clientUuid_key" ON "PromResponse"("clientUuid");

-- CreateIndex
CREATE INDEX "PromResponse_patientId_instrument_scheduledFor_idx" ON "PromResponse"("patientId", "instrument", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_clientUuid_key" ON "MediaUpload"("clientUuid");

-- CreateIndex
CREATE INDEX "MediaUpload_patientId_recordedAt_idx" ON "MediaUpload"("patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "Alert_patientId_status_severity_idx" ON "Alert"("patientId", "status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_dedupeKey_key" ON "Alert"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "AlertThreshold_departmentId_ruleKey_protocolKey_key" ON "AlertThreshold"("departmentId", "ruleKey", "protocolKey");

-- CreateIndex
CREATE INDEX "Message_patientId_sentAt_idx" ON "Message"("patientId", "sentAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "OtpCode_phone_expiresAt_idx" ON "OtpCode"("phone", "expiresAt");

-- CreateIndex
CREATE INDEX "ReminderJob_dueAt_sentAt_idx" ON "ReminderJob"("dueAt", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncReceipt_batchUuid_key" ON "SyncReceipt"("batchUuid");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplate" ADD CONSTRAINT "ProtocolTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplate" ADD CONSTRAINT "ProtocolTemplate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolPhase" ADD CONSTRAINT "ProtocolPhase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolExercise" ADD CONSTRAINT "ProtocolExercise_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProtocolPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProtocol" ADD CONSTRAINT "PatientProtocol_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProtocol" ADD CONSTRAINT "PatientProtocol_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "ProtocolTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProtocol" ADD CONSTRAINT "PatientProtocol_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPhase" ADD CONSTRAINT "PatientPhase_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "PatientProtocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientExercise" ADD CONSTRAINT "PatientExercise_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "PatientPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTransition" ADD CONSTRAINT "PhaseTransition_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "PatientProtocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTransition" ADD CONSTRAINT "PhaseTransition_fromPhaseId_fkey" FOREIGN KEY ("fromPhaseId") REFERENCES "PatientPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTransition" ADD CONSTRAINT "PhaseTransition_toPhaseId_fkey" FOREIGN KEY ("toPhaseId") REFERENCES "PatientPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTransition" ADD CONSTRAINT "PhaseTransition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "PatientExercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomLog" ADD CONSTRAINT "SymptomLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomLog" ADD CONSTRAINT "SymptomLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Measurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromResponse" ADD CONSTRAINT "PromResponse_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertThreshold" ADD CONSTRAINT "AlertThreshold_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertThreshold" ADD CONSTRAINT "AlertThreshold_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderJob" ADD CONSTRAINT "ReminderJob_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
