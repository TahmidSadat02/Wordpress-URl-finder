-- CreateTable
CREATE TABLE "discovered_domains" (
    "id" BIGSERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceWarc" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "served" BOOLEAN NOT NULL DEFAULT false,
    "servedAt" TIMESTAMP(3),

    CONSTRAINT "discovered_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discovered_domains_domain_key" ON "discovered_domains"("domain");
