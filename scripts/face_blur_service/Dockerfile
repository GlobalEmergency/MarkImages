# Imagen base de TensorFlow con GPU
FROM tensorflow/tensorflow:2.15.0-gpu

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Actualizar pip y desinstalar blinker problemático
RUN pip install --upgrade pip && \
    pip install --ignore-installed blinker

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

# Crear directorio para modelos
RUN mkdir -p /app/models

# Exponer puerto
EXPOSE 5000

# Variables de entorno
ENV FLASK_APP=server.py
ENV PYTHONUNBUFFERED=1
ENV TF_FORCE_GPU_ALLOW_GROWTH=true

# Comando de inicio
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120", "server:app"]
