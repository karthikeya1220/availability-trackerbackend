-- CreateTable mentor_profiles
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "company_size" TEXT NOT NULL DEFAULT '',
    "communication_score" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "years_of_experience" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_profiles
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goal" TEXT NOT NULL DEFAULT '',
    "domain" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_mentor_id_key" ON "mentor_profiles"("mentor_id");

-- CreateIndex
CREATE INDEX "mentor_profile_mentor_id_idx" ON "mentor_profiles"("mentor_id");

-- CreateIndex
CREATE INDEX "mentor_profile_communication_score_idx" ON "mentor_profiles"("communication_score");

-- CreateIndex
CREATE INDEX "mentor_profile_rating_idx" ON "mentor_profiles"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profile_user_id_idx" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profile_domain_idx" ON "user_profiles"("domain");

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
