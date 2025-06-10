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
    "original_image_url" TEXT,
    "cropped_image_url" TEXT,
    "processed_image_url" TEXT,
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

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_dea_record_id_fkey" FOREIGN KEY ("dea_record_id") REFERENCES "dea_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arrow_markers" ADD CONSTRAINT "arrow_markers_verification_session_id_fkey" FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_images" ADD CONSTRAINT "processed_images_verification_session_id_fkey" FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
