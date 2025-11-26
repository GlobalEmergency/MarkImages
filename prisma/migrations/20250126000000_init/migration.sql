-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "AedStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceOrigin" AS ENUM ('WEB_FORM', 'ADMIN_FORM', 'EXCEL_IMPORT', 'CSV_IMPORT', 'EXTERNAL_API', 'HEALTH_API', 'FIRE_DEPARTMENT_API', 'CIVIL_PROTECTION_API', 'LEGACY_MIGRATION', 'HOSPITAL_INTEGRATION', 'MANUAL_UPDATE', 'CITIZEN_REPORT', 'FIELD_VERIFICATION');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportErrorType" AS ENUM ('VALIDATION', 'FORMAT', 'DUPLICATE_DATA', 'MISSING_DATA', 'INVALID_DATA', 'RELATION_NOT_FOUND', 'INVALID_COORDINATES', 'ADDRESS_NOT_FOUND', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AedImageType" AS ENUM ('FRONT', 'LOCATION', 'ACCESS', 'SIGNAGE', 'CONTEXT', 'PLATE');

-- CreateEnum
CREATE TYPE "ValidationType" AS ENUM ('IMAGES', 'ADDRESS', 'SCHEDULE', 'AVAILABILITY', 'DUPLICATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'REQUIRES_REVIEW', 'ERROR');

-- CreateTable
CREATE TABLE "districts" (
    "id" SERIAL NOT NULL,
    "district_code" INTEGER NOT NULL,
    "text_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "shape_length" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "effective_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" SERIAL NOT NULL,
    "district_id" INTEGER NOT NULL,
    "neighborhood_code" INTEGER NOT NULL,
    "district_neighborhood_code" INTEGER NOT NULL,
    "neighborhood_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "uppercase_name" TEXT NOT NULL,
    "shape_length" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "effective_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streets" (
    "id" SERIAL NOT NULL,
    "street_code" INTEGER NOT NULL,
    "street_class" TEXT NOT NULL,
    "particle" TEXT,
    "name" TEXT NOT NULL,
    "name_with_accents" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "start_street_code" INTEGER,
    "start_class" TEXT,
    "start_particle" TEXT,
    "start_name" TEXT,
    "end_street_code" INTEGER,
    "end_class" TEXT,
    "end_particle" TEXT,
    "end_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "street_number_ranges" (
    "id" SERIAL NOT NULL,
    "street_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "neighborhood_id" INTEGER,
    "odd_min" INTEGER,
    "odd_max" INTEGER,
    "even_min" INTEGER,
    "even_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "street_number_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" SERIAL NOT NULL,
    "street_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "neighborhood_id" INTEGER,
    "application_class" TEXT,
    "number" INTEGER,
    "qualifier" TEXT,
    "point_type" TEXT,
    "point_code" INTEGER,
    "postal_code" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "utm_x_etrs" DOUBLE PRECISION,
    "utm_y_etrs" DOUBLE PRECISION,
    "utm_x_ed" DOUBLE PRECISION,
    "utm_y_ed" DOUBLE PRECISION,
    "label_angle" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_origin" "SourceOrigin" NOT NULL,
    "file_name" TEXT,
    "file_url" TEXT,
    "file_hash" TEXT,
    "file_size" INTEGER,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "successful_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "warning_records" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "import_parameters" JSONB,
    "error_summary" JSONB,
    "detailed_log" TEXT,
    "imported_by" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "row_number" INTEGER,
    "record_reference" TEXT,
    "error_type" "ImportErrorType" NOT NULL,
    "affected_field" TEXT,
    "original_value" TEXT,
    "error_message" TEXT NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "row_data" JSONB,
    "correction_suggestion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_responsibles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "alternative_phone" TEXT,
    "ownership" TEXT NOT NULL,
    "local_ownership" TEXT NOT NULL,
    "local_use" TEXT NOT NULL,
    "organization" TEXT,
    "position" TEXT,
    "department" TEXT,
    "observations" TEXT,
    "contact_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aed_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_schedules" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "has_24h_surveillance" BOOLEAN NOT NULL DEFAULT false,
    "has_restricted_access" BOOLEAN NOT NULL DEFAULT false,
    "weekday_opening" TEXT,
    "weekday_closing" TEXT,
    "saturday_opening" TEXT,
    "saturday_closing" TEXT,
    "sunday_opening" TEXT,
    "sunday_closing" TEXT,
    "holidays_as_weekday" BOOLEAN NOT NULL DEFAULT false,
    "closed_on_holidays" BOOLEAN NOT NULL DEFAULT false,
    "closed_in_august" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "schedule_exceptions" TEXT,
    "access_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aed_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_locations" (
    "id" UUID NOT NULL,
    "street_type" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "street_number" TEXT,
    "additional_info" TEXT,
    "postal_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "coordinates_precision" TEXT,
    "street_id" INTEGER,
    "district_id" INTEGER NOT NULL,
    "neighborhood_id" INTEGER,
    "access_description" TEXT,
    "visible_references" TEXT,
    "floor" TEXT,
    "specific_location" TEXT,
    "location_observations" TEXT,
    "access_warnings" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aed_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aeds" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "provisional_number" INTEGER,
    "name" TEXT NOT NULL,
    "establishment_type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "coordinates_precision" TEXT,
    "geom" geometry(Point, 4326),
    "source_origin" "SourceOrigin" NOT NULL DEFAULT 'WEB_FORM',
    "source_details" TEXT,
    "import_batch_id" UUID,
    "external_reference" TEXT,
    "origin_observations" TEXT,
    "validation_observations" TEXT,
    "internal_notes" TEXT,
    "requires_attention" BOOLEAN NOT NULL DEFAULT false,
    "attention_reason" TEXT,
    "status" "AedStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "sequence" SERIAL NOT NULL,
    "location_id" UUID NOT NULL,
    "responsible_id" UUID NOT NULL,
    "schedule_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "aeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_status_changes" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "previous_status" "AedStatus",
    "new_status" "AedStatus" NOT NULL,
    "reason" TEXT,
    "modified_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_images" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "type" "AedImageType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "original_url" TEXT NOT NULL,
    "processed_url" TEXT,
    "thumbnail_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" INTEGER,
    "format" TEXT,
    "file_hash" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_markers" (
    "id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "start_x" DOUBLE PRECISION NOT NULL,
    "start_y" DOUBLE PRECISION NOT NULL,
    "end_x" DOUBLE PRECISION,
    "end_y" DOUBLE PRECISION,
    "color" TEXT NOT NULL DEFAULT '#dc2626',
    "thickness" INTEGER NOT NULL DEFAULT 40,
    "text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_validations" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "type" "ValidationType" NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "data" JSONB,
    "result" JSONB,
    "errors" JSONB,
    "duration_ms" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aed_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_sessions" (
    "id" UUID NOT NULL,
    "validation_id" UUID NOT NULL,
    "step" TEXT NOT NULL,
    "step_data" JSONB,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_address_validations" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "address_found" BOOLEAN NOT NULL DEFAULT false,
    "match_level" DOUBLE PRECISION,
    "distance_meters" DOUBLE PRECISION,
    "match_type" TEXT,
    "suggested_latitude" DOUBLE PRECISION,
    "suggested_longitude" DOUBLE PRECISION,
    "official_street_id" INTEGER,
    "official_number" TEXT,
    "official_postal_code" TEXT,
    "official_district_id" INTEGER,
    "official_neighborhood_id" INTEGER,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "detected_problems" JSONB NOT NULL DEFAULT '[]',
    "recommended_actions" JSONB NOT NULL DEFAULT '[]',
    "result_confidence" DOUBLE PRECISION,
    "strategies_used" JSONB NOT NULL DEFAULT '[]',
    "duration_ms" INTEGER,
    "api_calls_made" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aed_address_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aed_code_history" (
    "id" UUID NOT NULL,
    "aed_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "district" INTEGER NOT NULL,
    "sequential" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "change_reason" TEXT,
    "changed_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "aed_code_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "data_before" JSONB,
    "data_after" JSONB,
    "changed_fields" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" UUID NOT NULL,
    "metric_name" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "metric_context" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "districts_district_code_key" ON "districts"("district_code");

-- CreateIndex
CREATE INDEX "districts_district_code_idx" ON "districts"("district_code");

-- CreateIndex
CREATE INDEX "districts_normalized_name_idx" ON "districts"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_district_neighborhood_code_key" ON "neighborhoods"("district_neighborhood_code");

-- CreateIndex
CREATE INDEX "neighborhoods_district_id_neighborhood_code_idx" ON "neighborhoods"("district_id", "neighborhood_code");

-- CreateIndex
CREATE INDEX "neighborhoods_normalized_name_idx" ON "neighborhoods"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "streets_street_code_key" ON "streets"("street_code");

-- CreateIndex
CREATE INDEX "streets_street_code_idx" ON "streets"("street_code");

-- CreateIndex
CREATE INDEX "streets_street_class_idx" ON "streets"("street_class");

-- CreateIndex
CREATE INDEX "streets_normalized_name_idx" ON "streets"("normalized_name");

-- CreateIndex
CREATE INDEX "streets_start_street_code_idx" ON "streets"("start_street_code");

-- CreateIndex
CREATE INDEX "streets_end_street_code_idx" ON "streets"("end_street_code");

-- CreateIndex
CREATE INDEX "street_number_ranges_street_id_district_id_idx" ON "street_number_ranges"("street_id", "district_id");

-- CreateIndex
CREATE INDEX "street_number_ranges_odd_min_odd_max_idx" ON "street_number_ranges"("odd_min", "odd_max");

-- CreateIndex
CREATE INDEX "street_number_ranges_even_min_even_max_idx" ON "street_number_ranges"("even_min", "even_max");

-- CreateIndex
CREATE INDEX "street_number_ranges_street_id_district_id_neighborhood_id_idx" ON "street_number_ranges"("street_id", "district_id", "neighborhood_id");

-- CreateIndex
CREATE INDEX "addresses_street_id_number_idx" ON "addresses"("street_id", "number");

-- CreateIndex
CREATE INDEX "addresses_district_id_neighborhood_id_idx" ON "addresses"("district_id", "neighborhood_id");

-- CreateIndex
CREATE INDEX "addresses_postal_code_idx" ON "addresses"("postal_code");

-- CreateIndex
CREATE INDEX "addresses_latitude_longitude_idx" ON "addresses"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "addresses_street_id_district_id_number_postal_code_idx" ON "addresses"("street_id", "district_id", "number", "postal_code");

-- CreateIndex
CREATE INDEX "idx_addresses_spatial" ON "addresses"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "import_batches_source_origin_idx" ON "import_batches"("source_origin");

-- CreateIndex
CREATE INDEX "import_batches_created_at_idx" ON "import_batches"("created_at");

-- CreateIndex
CREATE INDEX "import_batches_imported_by_idx" ON "import_batches"("imported_by");

-- CreateIndex
CREATE INDEX "import_errors_import_batch_id_idx" ON "import_errors"("import_batch_id");

-- CreateIndex
CREATE INDEX "import_errors_error_type_idx" ON "import_errors"("error_type");

-- CreateIndex
CREATE INDEX "import_errors_severity_idx" ON "import_errors"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "aed_responsibles_email_key" ON "aed_responsibles"("email");

-- CreateIndex
CREATE INDEX "aed_responsibles_email_idx" ON "aed_responsibles"("email");

-- CreateIndex
CREATE INDEX "aed_responsibles_organization_idx" ON "aed_responsibles"("organization");

-- CreateIndex
CREATE INDEX "aed_schedules_has_24h_surveillance_idx" ON "aed_schedules"("has_24h_surveillance");

-- CreateIndex
CREATE INDEX "aed_locations_district_id_neighborhood_id_idx" ON "aed_locations"("district_id", "neighborhood_id");

-- CreateIndex
CREATE INDEX "aed_locations_postal_code_idx" ON "aed_locations"("postal_code");

-- CreateIndex
CREATE INDEX "idx_location_spatial" ON "aed_locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "aed_locations_street_id_idx" ON "aed_locations"("street_id");

-- CreateIndex
CREATE UNIQUE INDEX "aeds_code_key" ON "aeds"("code");

-- CreateIndex
CREATE UNIQUE INDEX "aeds_location_id_key" ON "aeds"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "aeds_schedule_id_key" ON "aeds"("schedule_id");

-- CreateIndex
CREATE INDEX "aeds_status_idx" ON "aeds"("status");

-- CreateIndex
CREATE INDEX "aeds_code_idx" ON "aeds"("code");

-- CreateIndex
CREATE INDEX "aeds_created_at_idx" ON "aeds"("created_at");

-- CreateIndex
CREATE INDEX "aeds_responsible_id_idx" ON "aeds"("responsible_id");

-- CreateIndex
CREATE INDEX "aeds_establishment_type_idx" ON "aeds"("establishment_type");

-- CreateIndex
CREATE INDEX "aeds_sequence_idx" ON "aeds"("sequence");

-- CreateIndex
CREATE INDEX "aeds_source_origin_idx" ON "aeds"("source_origin");

-- CreateIndex
CREATE INDEX "aeds_import_batch_id_idx" ON "aeds"("import_batch_id");

-- CreateIndex
CREATE INDEX "aeds_requires_attention_idx" ON "aeds"("requires_attention");

-- CreateIndex
CREATE INDEX "idx_aeds_coordinates" ON "aeds"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "idx_aeds_published_coordinates" ON "aeds"("status", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "aed_status_changes_aed_id_created_at_idx" ON "aed_status_changes"("aed_id", "created_at");

-- CreateIndex
CREATE INDEX "aed_status_changes_new_status_idx" ON "aed_status_changes"("new_status");

-- CreateIndex
CREATE INDEX "aed_images_aed_id_type_order_idx" ON "aed_images"("aed_id", "type", "order");

-- CreateIndex
CREATE INDEX "aed_images_is_verified_idx" ON "aed_images"("is_verified");

-- CreateIndex
CREATE INDEX "aed_images_file_hash_idx" ON "aed_images"("file_hash");

-- CreateIndex
CREATE INDEX "image_markers_image_id_idx" ON "image_markers"("image_id");

-- CreateIndex
CREATE INDEX "aed_validations_aed_id_type_idx" ON "aed_validations"("aed_id", "type");

-- CreateIndex
CREATE INDEX "aed_validations_status_started_at_idx" ON "aed_validations"("status", "started_at");

-- CreateIndex
CREATE INDEX "aed_validations_completed_at_idx" ON "aed_validations"("completed_at");

-- CreateIndex
CREATE INDEX "aed_validations_type_status_idx" ON "aed_validations"("type", "status");

-- CreateIndex
CREATE INDEX "validation_sessions_validation_id_step_idx" ON "validation_sessions"("validation_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "aed_address_validations_location_id_key" ON "aed_address_validations"("location_id");

-- CreateIndex
CREATE INDEX "aed_address_validations_address_found_idx" ON "aed_address_validations"("address_found");

-- CreateIndex
CREATE INDEX "aed_address_validations_match_level_idx" ON "aed_address_validations"("match_level");

-- CreateIndex
CREATE INDEX "aed_address_validations_match_type_idx" ON "aed_address_validations"("match_type");

-- CreateIndex
CREATE UNIQUE INDEX "aed_code_history_code_key" ON "aed_code_history"("code");

-- CreateIndex
CREATE INDEX "aed_code_history_aed_id_is_active_idx" ON "aed_code_history"("aed_id", "is_active");

-- CreateIndex
CREATE INDEX "aed_code_history_code_idx" ON "aed_code_history"("code");

-- CreateIndex
CREATE INDEX "aed_code_history_is_active_idx" ON "aed_code_history"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "aed_code_history_district_sequential_is_active_key" ON "aed_code_history"("district", "sequential", "is_active");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "system_metrics_metric_name_recorded_at_idx" ON "system_metrics"("metric_name", "recorded_at");

-- CreateIndex
CREATE INDEX "system_metrics_recorded_at_idx" ON "system_metrics"("recorded_at");

-- AddForeignKey
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "street_number_ranges" ADD CONSTRAINT "street_number_ranges_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "street_number_ranges" ADD CONSTRAINT "street_number_ranges_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "street_number_ranges" ADD CONSTRAINT "street_number_ranges_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_locations" ADD CONSTRAINT "aed_locations_street_id_fkey" FOREIGN KEY ("street_id") REFERENCES "streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_locations" ADD CONSTRAINT "aed_locations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_locations" ADD CONSTRAINT "aed_locations_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "aed_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "aed_responsibles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "aed_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aeds" ADD CONSTRAINT "aeds_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_status_changes" ADD CONSTRAINT "aed_status_changes_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_images" ADD CONSTRAINT "aed_images_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_markers" ADD CONSTRAINT "image_markers_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "aed_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_validations" ADD CONSTRAINT "aed_validations_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_sessions" ADD CONSTRAINT "validation_sessions_validation_id_fkey" FOREIGN KEY ("validation_id") REFERENCES "aed_validations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_address_validations" ADD CONSTRAINT "aed_address_validations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "aed_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aed_code_history" ADD CONSTRAINT "aed_code_history_aed_id_fkey" FOREIGN KEY ("aed_id") REFERENCES "aeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create PostGIS spatial index for aeds.geom
CREATE INDEX idx_aeds_geom ON aeds USING GIST (geom);
