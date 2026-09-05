-- CreateTable
CREATE TABLE "Sop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceInterviewId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sop_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sop_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "trustLevel" TEXT NOT NULL DEFAULT 'EMPLOYEE_STATEMENT',
    "sourceInterviewId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeItem_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Sop_processId_key" ON "Sop"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItem_processId_category_text_key" ON "KnowledgeItem"("processId", "category", "text");
