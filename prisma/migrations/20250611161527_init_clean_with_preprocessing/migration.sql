-- CreateTable
CREATE TABLE "dea_records" (
    "id" SERIAL NOT NULL,
    "horaInicio" TIMESTAMP(3) NOT NULL,
    "horaFinalizacion" TIMESTAMP(3) NOT NULL,
    "correoElectronico" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numeroProvisionalDea" INTEGER NOT NULL,
    "tipoEstablecimiento" TEXT NOT NULL,
    "titularidadLocal" TEXT NOT NULL,
    "usoLocal" TEXT NOT NULL,
    "titularidad" TEXT NOT NULL,
    "propuestaDenominacion" TEXT NOT NULL,
    "tipoVia" TEXT NOT NULL,
    "nombreVia" TEXT NOT NULL,
    "numeroVia" TEXT,
    "complementoDireccion" TEXT,
    "codigoPostal" INTEGER NOT NULL,
    "distrito" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "horarioApertura" TEXT NOT NULL,
    "aperturaLunesViernes" INTEGER NOT NULL,
    "cierreLunesViernes" INTEGER NOT NULL,
    "aperturaSabados" INTEGER NOT NULL,
    "cierreSabados" INTEGER NOT NULL,
    "aperturaDomingos" INTEGER NOT NULL,
    "cierreDomingos" INTEGER NOT NULL,
    "vigilante24h" TEXT NOT NULL,
    "foto1" TEXT,
    "foto2" TEXT,
    "descripcionAcceso" TEXT,
    "comentarioLibre" TEXT,
    "gmTipoVia" TEXT,
    "gmNombreVia" TEXT,
    "gmNumero" TEXT,
    "gmCp" TEXT,
    "gmDistrito" TEXT,
    "gmLat" DOUBLE PRECISION,
    "gmLon" DOUBLE PRECISION,
    "defTipoVia" TEXT,
    "defNombreVia" TEXT,
    "defNumero" TEXT,
    "defCp" TEXT,
    "defDistrito" TEXT,
    "defLat" DOUBLE PRECISION,
    "defLon" DOUBLE PRECISION,
    "defCodDea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dea_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_sessions" (
    "id" SERIAL NOT NULL,
    "dea_record_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "current_step" TEXT NOT NULL DEFAULT 'dea_info',
    "step_data" JSONB,
    "original_image_url" TEXT,
    "cropped_image_url" TEXT,
    "processed_image_url" TEXT,
    "second_image_url" TEXT,
    "second_cropped_image_url" TEXT,
    "second_processed_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "verification_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arrow_markers" (
    "id" SERIAL NOT NULL,
    "verification_session_id" INTEGER NOT NULL,
    "image_number" INTEGER NOT NULL,
    "start_x" DOUBLE PRECISION NOT NULL,
    "start_y" DOUBLE PRECISION NOT NULL,
    "end_x" DOUBLE PRECISION NOT NULL,
    "end_y" DOUBLE PRECISION NOT NULL,
    "arrow_color" TEXT NOT NULL DEFAULT '#dc2626',
    "arrow_width" INTEGER NOT NULL DEFAULT 40,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arrow_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_images" (
    "id" SERIAL NOT NULL,
    "verification_session_id" INTEGER NOT NULL,
    "original_filename" TEXT NOT NULL,
    "processed_filename" TEXT NOT NULL,
    "image_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "dimensions" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distritos" (
    "id" SERIAL NOT NULL,
    "codigo_distrito" INTEGER NOT NULL,
    "codigo_texto" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "shape_length" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "fecha_alta" TIMESTAMP(3),
    "fecha_baja" TIMESTAMP(3),
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barrios" (
    "id" SERIAL NOT NULL,
    "distrito_id" INTEGER NOT NULL,
    "codigo_barrio" INTEGER NOT NULL,
    "codigo_distrito_barrio" INTEGER NOT NULL,
    "numero_barrio" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "nombre_mayuscula" TEXT NOT NULL,
    "shape_length" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "fecha_alta" TIMESTAMP(3),
    "fecha_baja" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barrios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vias" (
    "id" SERIAL NOT NULL,
    "codigo_via" INTEGER NOT NULL,
    "clase_via" TEXT NOT NULL,
    "particula" TEXT,
    "nombre" TEXT NOT NULL,
    "nombre_con_acentos" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "codigo_via_inicio" INTEGER,
    "clase_inicio" TEXT,
    "particula_inicio" TEXT,
    "nombre_inicio" TEXT,
    "codigo_via_fin" INTEGER,
    "clase_fin" TEXT,
    "particula_fin" TEXT,
    "nombre_fin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "via_rangos_numeracion" (
    "id" SERIAL NOT NULL,
    "via_id" INTEGER NOT NULL,
    "distrito_id" INTEGER NOT NULL,
    "barrio_id" INTEGER,
    "numero_impar_min" INTEGER,
    "numero_impar_max" INTEGER,
    "numero_par_min" INTEGER,
    "numero_par_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "via_rangos_numeracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" SERIAL NOT NULL,
    "via_id" INTEGER NOT NULL,
    "distrito_id" INTEGER NOT NULL,
    "barrio_id" INTEGER,
    "clase_aplicacion" TEXT,
    "numero" INTEGER,
    "calificador" TEXT,
    "tipo_punto" TEXT,
    "codigo_punto" INTEGER,
    "codigo_postal" TEXT,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "utm_x_etrs" DOUBLE PRECISION,
    "utm_y_etrs" DOUBLE PRECISION,
    "utm_x_ed" DOUBLE PRECISION,
    "utm_y_ed" DOUBLE PRECISION,
    "angulo_rotulacion" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dea_codes" (
    "id" SERIAL NOT NULL,
    "distrito" INTEGER NOT NULL,
    "codigo_postal" TEXT NOT NULL,
    "secuencial" INTEGER NOT NULL,
    "codigo_completo" TEXT NOT NULL,
    "dea_record_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dea_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dea_address_validations" (
    "id" SERIAL NOT NULL,
    "dea_record_id" INTEGER NOT NULL,
    "search_results" JSONB NOT NULL DEFAULT '[]',
    "validation_details" JSONB,
    "overall_status" TEXT NOT NULL DEFAULT 'pending',
    "recommended_actions" JSONB NOT NULL DEFAULT '[]',
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processing_duration_ms" INTEGER,
    "search_strategies_used" JSONB NOT NULL DEFAULT '[]',
    "validation_version" TEXT NOT NULL DEFAULT '1.0',
    "needs_reprocessing" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dea_address_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distritos_codigo_distrito_key" ON "distritos"("codigo_distrito");

-- CreateIndex
CREATE INDEX "distritos_codigo_distrito_idx" ON "distritos"("codigo_distrito");

-- CreateIndex
CREATE INDEX "distritos_nombre_normalizado_idx" ON "distritos"("nombre_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "barrios_codigo_distrito_barrio_key" ON "barrios"("codigo_distrito_barrio");

-- CreateIndex
CREATE INDEX "barrios_distrito_id_codigo_barrio_idx" ON "barrios"("distrito_id", "codigo_barrio");

-- CreateIndex
CREATE INDEX "barrios_nombre_normalizado_idx" ON "barrios"("nombre_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "vias_codigo_via_key" ON "vias"("codigo_via");

-- CreateIndex
CREATE INDEX "vias_codigo_via_idx" ON "vias"("codigo_via");

-- CreateIndex
CREATE INDEX "vias_clase_via_idx" ON "vias"("clase_via");

-- CreateIndex
CREATE INDEX "vias_nombre_normalizado_idx" ON "vias"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "vias_codigo_via_inicio_idx" ON "vias"("codigo_via_inicio");

-- CreateIndex
CREATE INDEX "vias_codigo_via_fin_idx" ON "vias"("codigo_via_fin");

-- CreateIndex
CREATE INDEX "via_rangos_numeracion_via_id_distrito_id_idx" ON "via_rangos_numeracion"("via_id", "distrito_id");

-- CreateIndex
CREATE INDEX "via_rangos_numeracion_numero_impar_min_numero_impar_max_idx" ON "via_rangos_numeracion"("numero_impar_min", "numero_impar_max");

-- CreateIndex
CREATE INDEX "via_rangos_numeracion_numero_par_min_numero_par_max_idx" ON "via_rangos_numeracion"("numero_par_min", "numero_par_max");

-- CreateIndex
CREATE INDEX "via_rangos_numeracion_via_id_distrito_id_barrio_id_idx" ON "via_rangos_numeracion"("via_id", "distrito_id", "barrio_id");

-- CreateIndex
CREATE INDEX "direcciones_via_id_numero_idx" ON "direcciones"("via_id", "numero");

-- CreateIndex
CREATE INDEX "direcciones_distrito_id_barrio_id_idx" ON "direcciones"("distrito_id", "barrio_id");

-- CreateIndex
CREATE INDEX "direcciones_codigo_postal_idx" ON "direcciones"("codigo_postal");

-- CreateIndex
CREATE INDEX "direcciones_latitud_longitud_idx" ON "direcciones"("latitud", "longitud");

-- CreateIndex
CREATE INDEX "direcciones_via_id_distrito_id_numero_codigo_postal_idx" ON "direcciones"("via_id", "distrito_id", "numero", "codigo_postal");

-- CreateIndex
CREATE UNIQUE INDEX "dea_codes_codigo_completo_key" ON "dea_codes"("codigo_completo");

-- CreateIndex
CREATE INDEX "dea_codes_distrito_idx" ON "dea_codes"("distrito");

-- CreateIndex
CREATE INDEX "dea_codes_codigo_completo_idx" ON "dea_codes"("codigo_completo");

-- CreateIndex
CREATE UNIQUE INDEX "dea_codes_distrito_secuencial_key" ON "dea_codes"("distrito", "secuencial");

-- CreateIndex
CREATE UNIQUE INDEX "dea_address_validations_dea_record_id_key" ON "dea_address_validations"("dea_record_id");

-- CreateIndex
CREATE INDEX "dea_address_validations_overall_status_idx" ON "dea_address_validations"("overall_status");

-- CreateIndex
CREATE INDEX "dea_address_validations_needs_reprocessing_idx" ON "dea_address_validations"("needs_reprocessing");

-- CreateIndex
CREATE INDEX "dea_address_validations_processed_at_idx" ON "dea_address_validations"("processed_at");

-- CreateIndex
CREATE INDEX "dea_address_validations_validation_version_idx" ON "dea_address_validations"("validation_version");

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_dea_record_id_fkey" FOREIGN KEY ("dea_record_id") REFERENCES "dea_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrow_markers" ADD CONSTRAINT "arrow_markers_verification_session_id_fkey" FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_images" ADD CONSTRAINT "processed_images_verification_session_id_fkey" FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barrios" ADD CONSTRAINT "barrios_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "via_rangos_numeracion" ADD CONSTRAINT "via_rangos_numeracion_via_id_fkey" FOREIGN KEY ("via_id") REFERENCES "vias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "via_rangos_numeracion" ADD CONSTRAINT "via_rangos_numeracion_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "via_rangos_numeracion" ADD CONSTRAINT "via_rangos_numeracion_barrio_id_fkey" FOREIGN KEY ("barrio_id") REFERENCES "barrios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_via_id_fkey" FOREIGN KEY ("via_id") REFERENCES "vias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_barrio_id_fkey" FOREIGN KEY ("barrio_id") REFERENCES "barrios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dea_codes" ADD CONSTRAINT "dea_codes_dea_record_id_fkey" FOREIGN KEY ("dea_record_id") REFERENCES "dea_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dea_address_validations" ADD CONSTRAINT "dea_address_validations_dea_record_id_fkey" FOREIGN KEY ("dea_record_id") REFERENCES "dea_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
