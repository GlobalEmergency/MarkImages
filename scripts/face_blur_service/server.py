"""
API Flask para detección y pixelado de caras
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from face_detector import FaceDetector
import logging
import time

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Crear aplicación Flask
app = Flask(__name__)
CORS(app)

# Inicializar detector (se carga una sola vez al iniciar)
logger.info("🚀 Inicializando servicio de detección de caras...")
detector = FaceDetector(use_gpu=True)
logger.info("✅ Servicio listo para procesar imágenes")


@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud del servicio"""
    gpu_info = detector.get_gpu_info()
    return jsonify({
        'status': 'ready',
        'model': 'MTCNN',
        'gpu_available': gpu_info['gpu_available'],
        'using_gpu': gpu_info['using_gpu'],
        'tensorflow_version': gpu_info['tensorflow_version']
    })


@app.route('/blur-faces', methods=['POST'])
def blur_faces():
    """
    Detecta y pixela caras en una imagen
    
    Request JSON:
    {
        "image": "data:image/jpeg;base64,...",  # Imagen en base64
        "min_confidence": 0.9,                   # Opcional
        "padding": 0.2,                          # Opcional
        "pixel_size": 16                         # Opcional
    }
    
    Response JSON:
    {
        "image": "base64_encoded_image",
        "faces_detected": 2,
        "processing_time_ms": 123.45
    }
    """
    start_time = time.time()
    
    try:
        # Obtener datos del request
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No se proporcionó imagen'}), 400
        
        # Parámetros opcionales
        min_confidence = data.get('min_confidence', 0.9)
        padding = data.get('padding', 0.2)
        pixel_size = data.get('pixel_size', 16)
        
        # Decodificar imagen base64
        img_b64 = data['image']
        
        # Remover prefijo data:image si existe
        if ',' in img_b64:
            img_b64 = img_b64.split(',')[1]
        
        # Convertir base64 a numpy array
        img_bytes = base64.b64decode(img_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'No se pudo decodificar la imagen'}), 400
        
        # Procesar imagen
        processed_img, num_faces = detector.process_image(
            img,
            min_confidence=min_confidence,
            padding=padding,
            pixel_size=pixel_size
        )
        
        # Codificar resultado a base64
        _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        img_b64_result = base64.b64encode(buffer).decode('utf-8')
        
        # Calcular tiempo de procesamiento
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"✅ Procesada imagen: {num_faces} caras detectadas en {processing_time:.2f}ms")
        
        return jsonify({
            'image': img_b64_result,
            'faces_detected': num_faces,
            'processing_time_ms': round(processing_time, 2)
        })
        
    except Exception as e:
        logger.error(f"❌ Error procesando imagen: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/detect-and-mark', methods=['POST'])
def detect_and_mark():
    """
    Detecta caras y retorna metadata detallada + imagen marcada
    
    Request JSON:
    {
        "image": "data:image/jpeg;base64,...",
        "min_confidence": 0.9,
        "padding": 0.2,
        "pixel_size": 16,
        "return_marked_image": true
    }
    
    Response JSON:
    {
        "pixelated_image": "base64...",
        "marked_image": "base64...",        # Imagen con rectángulos rojos
        "faces_detected": 2,
        "face_details": [
            {
                "confidence": 0.95,
                "bbox": [120, 80, 200, 160],
                "original_bbox": [110, 70, 180, 140],
                "area": 32000
            }
        ],
        "image_dimensions": [800, 600],
        "processing_time_ms": 27.34,
        "detection_success": true
    }
    """
    start_time = time.time()
    
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No se proporcionó imagen'}), 400
        
        # Parámetros
        min_confidence = data.get('min_confidence', 0.9)
        padding = data.get('padding', 0.2)
        pixel_size = data.get('pixel_size', 16)
        return_marked = data.get('return_marked_image', True)
        
        # Decodificar imagen
        img_b64 = data['image']
        if ',' in img_b64:
            img_b64 = img_b64.split(',')[1]
        
        img_bytes = base64.b64decode(img_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'No se pudo decodificar la imagen'}), 400
        
        # Obtener detalles de las caras
        face_details = detector.get_face_details(img, min_confidence, padding)
        
        # Dimensiones de la imagen
        img_height, img_width = img.shape[:2]
        
        # Procesar imagen (pixelado)
        processed_img, num_faces = detector.process_image(
            img, min_confidence, padding, pixel_size
        )
        
        # Codificar imagen pixelada
        _, buffer_pixelated = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        pixelated_b64 = base64.b64encode(buffer_pixelated).decode('utf-8')
        
        # Generar imagen marcada si se solicita
        marked_b64 = None
        if return_marked and num_faces > 0:
            face_regions = [(d['bbox'][0], d['bbox'][1], d['bbox'][2], d['bbox'][3]) 
                           for d in face_details]
            marked_img = detector.draw_face_rectangles(img, face_regions)
            _, buffer_marked = cv2.imencode('.jpg', marked_img, [cv2.IMWRITE_JPEG_QUALITY, 90])
            marked_b64 = base64.b64encode(buffer_marked).decode('utf-8')
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"✅ Detectadas {num_faces} caras con detalles en {processing_time:.2f}ms")
        
        response = {
            'pixelated_image': pixelated_b64,
            'marked_image': marked_b64,
            'faces_detected': num_faces,
            'face_details': face_details,
            'image_dimensions': [img_width, img_height],
            'processing_time_ms': round(processing_time, 2),
            'detection_success': True
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"❌ Error en detect-and-mark: {e}", exc_info=True)
        return jsonify({'error': str(e), 'detection_success': False}), 500


@app.route('/gpu-info', methods=['GET'])
def gpu_info():
    """Información sobre GPU y configuración"""
    info = detector.get_gpu_info()
    return jsonify(info)


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint no encontrado'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Error interno del servidor'}), 500


if __name__ == '__main__':
    # Modo desarrollo (no usar en producción)
    app.run(host='0.0.0.0', port=5000, debug=False)
