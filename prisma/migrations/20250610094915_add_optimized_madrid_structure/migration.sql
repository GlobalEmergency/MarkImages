-- AlterTable
ALTER TABLE "verification_sessions" ADD COLUMN     "second_cropped_image_url" TEXT,
ADD COLUMN     "second_image_url" TEXT,
ADD COLUMN     "second_processed_image_url" TEXT,
ADD COLUMN     "step_data" JSONB;

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
