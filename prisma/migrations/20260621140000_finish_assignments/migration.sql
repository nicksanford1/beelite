ALTER TABLE "ProjectFinish"
ADD COLUMN "application" TEXT NOT NULL DEFAULT 'other';

CREATE TABLE "FinishAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "finishId" TEXT NOT NULL,
    "level" TEXT,
    "roomNumber" TEXT,
    "roomName" TEXT,
    "sourceSheet" TEXT,
    "sourceText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "FinishAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinishAssignment_projectId_idx" ON "FinishAssignment"("projectId");
CREATE INDEX "FinishAssignment_finishId_idx" ON "FinishAssignment"("finishId");

ALTER TABLE "FinishAssignment"
ADD CONSTRAINT "FinishAssignment_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinishAssignment"
ADD CONSTRAINT "FinishAssignment_finishId_fkey"
FOREIGN KEY ("finishId") REFERENCES "ProjectFinish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
