-- Tabla para sesiones de verificación
CREATE TABLE verification_sessions (
  id SERIAL PRIMARY KEY,
  dea_record_id INTEGER NOT NULL REFERENCES dea_records(id),
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  current_step VARCHAR(50) NOT NULL DEFAULT 'dea_info',
  original_image_url VARCHAR(500),
  cropped_image_url VARCHAR(500),
  processed_image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Tabla para coordenadas de flechas
CREATE TABLE arrow_markers (
  id SERIAL PRIMARY KEY,
  verification_session_id INTEGER NOT NULL REFERENCES verification_sessions(id),
  image_number INTEGER NOT NULL, -- 1 para foto1, 2 para foto2, etc.
  start_x FLOAT NOT NULL,
  start_y FLOAT NOT NULL,
  end_x FLOAT NOT NULL,
  end_y FLOAT NOT NULL,
  arrow_color VARCHAR(7) DEFAULT '#dc2626',
  arrow_width INTEGER DEFAULT 40,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para imágenes procesadas
CREATE TABLE processed_images (
  id SERIAL PRIMARY KEY,
  verification_session_id INTEGER NOT NULL REFERENCES verification_sessions(id),
  original_filename VARCHAR(255),
  processed_filename VARCHAR(255),
  image_type VARCHAR(50), -- 'cropped', 'with_arrow', 'thumbnail'
  file_size INTEGER,
  dimensions VARCHAR(20), -- '1000x1000'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_verification_sessions_dea_record_id ON verification_sessions(dea_record_id);
CREATE INDEX idx_verification_sessions_status ON verification_sessions(status);
CREATE INDEX idx_arrow_markers_verification_session_id ON arrow_markers(verification_session_id);
CREATE INDEX idx_processed_images_verification_session_id ON processed_images(verification_session_id);
