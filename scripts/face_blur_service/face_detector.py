"""
Detector de caras usando MTCNN con soporte GPU
"""
import cv2
import numpy as np
from mtcnn import MTCNN
import tensorflow as tf
from typing import List, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FaceDetector:
    """Detector de caras con MTCNN"""
    
    def __init__(self, use_gpu: bool = True):
        """
        Inicializa el detector de caras
        
        Args:
            use_gpu: Si True, intenta usar GPU. Si falla, usa CPU
        """
        self.use_gpu = use_gpu
        self.detector = None
        self._initialize_detector()
    
    def _initialize_detector(self):
        """Inicializa el modelo MTCNN"""
        try:
            # Configurar GPU
            if self.use_gpu:
                gpus = tf.config.list_physical_devices('GPU')
                if gpus:
                    try:
                        # Permitir crecimiento de memoria (importante para GTX 1060 3GB)
                        for gpu in gpus:
                            tf.config.experimental.set_memory_growth(gpu, True)
                        logger.info(f"✅ GPU detectada: {len(gpus)} dispositivo(s)")
                        logger.info(f"   Nombre: {gpus[0].name}")
                    except RuntimeError as e:
                        logger.warning(f"⚠️  Error configurando GPU: {e}")
                else:
                    logger.warning("⚠️  No se detectó GPU, usando CPU")
                    self.use_gpu = False
            
            # Crear detector MTCNN
            logger.info("🔄 Cargando modelo MTCNN...")
            self.detector = MTCNN()
            logger.info("✅ Modelo MTCNN cargado correctamente")
            
        except Exception as e:
            logger.error(f"❌ Error inicializando detector: {e}")
            raise
    
    def detect_faces(
        self, 
        image: np.ndarray, 
        min_confidence: float = 0.9,
        padding: float = 0.2
    ) -> List[Tuple[int, int, int, int]]:
        """
        Detecta caras en una imagen
        
        Args:
            image: Imagen en formato numpy array (BGR)
            min_confidence: Confianza mínima para considerar una detección
            padding: Margen adicional alrededor de la cara (0.2 = 20%)
        
        Returns:
            Lista de tuplas (x, y, width, height) con las regiones de caras
        """
        try:
            # Convertir BGR a RGB (MTCNN espera RGB)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detectar caras
            detections = self.detector.detect_faces(rgb_image)
            
            # Filtrar por confianza y calcular regiones con padding
            face_regions = []
            for detection in detections:
                confidence = detection['confidence']
                if confidence >= min_confidence:
                    box = detection['box']
                    x, y, w, h = box
                    
                    # Añadir padding
                    pad_w = int(w * padding)
                    pad_h = int(h * padding)
                    
                    x1 = max(0, x - pad_w // 2)
                    y1 = max(0, y - pad_h // 2)
                    x2 = min(image.shape[1], x + w + pad_w // 2)
                    y2 = min(image.shape[0], y + h + pad_h // 2)
                    
                    face_regions.append((x1, y1, x2 - x1, y2 - y1))
            
            logger.info(f"🔍 Detectadas {len(face_regions)} caras (confianza >= {min_confidence})")
            return face_regions
            
        except Exception as e:
            logger.error(f"❌ Error detectando caras: {e}")
            return []
    
    def pixelate_faces(
        self, 
        image: np.ndarray, 
        face_regions: List[Tuple[int, int, int, int]],
        pixel_size: int = 16
    ) -> np.ndarray:
        """
        Pixela las regiones de caras en una imagen
        
        Args:
            image: Imagen original
            face_regions: Lista de regiones (x, y, width, height)
            pixel_size: Tamaño del píxel para el efecto
        
        Returns:
            Imagen con caras pixeladas
        """
        result = image.copy()
        
        for (x, y, w, h) in face_regions:
            # Extraer región de la cara
            face = result[y:y+h, x:x+w]
            
            if face.size == 0:
                continue
            
            # Calcular tamaño reducido
            small_w = max(1, w // pixel_size)
            small_h = max(1, h // pixel_size)
            
            # Reducir y ampliar para crear efecto pixelado
            small_face = cv2.resize(face, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
            pixelated_face = cv2.resize(small_face, (w, h), interpolation=cv2.INTER_NEAREST)
            
            # Reemplazar en imagen original
            result[y:y+h, x:x+w] = pixelated_face
        
        return result
    
    def get_face_details(
        self,
        image: np.ndarray,
        min_confidence: float = 0.9,
        padding: float = 0.2
    ) -> List[dict]:
        """
        Obtiene detalles completos de las caras detectadas
        
        Args:
            image: Imagen en formato numpy array (BGR)
            min_confidence: Confianza mínima para considerar una detección
            padding: Margen adicional alrededor de la cara
        
        Returns:
            Lista de diccionarios con información de cada cara
        """
        try:
            # Convertir BGR a RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detectar caras
            detections = self.detector.detect_faces(rgb_image)
            
            # Procesar detalles
            face_details = []
            for detection in detections:
                confidence = detection['confidence']
                if confidence >= min_confidence:
                    box = detection['box']
                    x, y, w, h = box
                    
                    # Añadir padding
                    pad_w = int(w * padding)
                    pad_h = int(h * padding)
                    
                    x1 = max(0, x - pad_w // 2)
                    y1 = max(0, y - pad_h // 2)
                    x2 = min(image.shape[1], x + w + pad_w // 2)
                    y2 = min(image.shape[0], y + h + pad_h // 2)
                    
                    face_details.append({
                        'confidence': float(confidence),
                        'bbox': [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                        'original_bbox': [int(x), int(y), int(w), int(h)],
                        'area': int((x2 - x1) * (y2 - y1))
                    })
            
            return face_details
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo detalles de caras: {e}")
            return []
    
    def draw_face_rectangles(
        self,
        image: np.ndarray,
        face_regions: List[Tuple[int, int, int, int]],
        color: Tuple[int, int, int] = (0, 0, 255),
        thickness: int = 3
    ) -> np.ndarray:
        """
        Dibuja rectángulos alrededor de las caras detectadas
        
        Args:
            image: Imagen original
            face_regions: Lista de regiones (x, y, width, height)
            color: Color del rectángulo en BGR (por defecto rojo)
            thickness: Grosor de la línea
        
        Returns:
            Imagen con rectángulos dibujados
        """
        result = image.copy()
        
        for i, (x, y, w, h) in enumerate(face_regions):
            # Dibujar rectángulo
            cv2.rectangle(result, (x, y), (x + w, y + h), color, thickness)
            
            # Añadir etiqueta con número de cara
            label = f"Face {i+1}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.7
            font_thickness = 2
            
            # Calcular tamaño del texto
            (text_w, text_h), _ = cv2.getTextSize(label, font, font_scale, font_thickness)
            
            # Fondo para el texto
            cv2.rectangle(result, 
                         (x, y - text_h - 10), 
                         (x + text_w + 10, y), 
                         color, 
                         -1)
            
            # Texto
            cv2.putText(result, 
                       label, 
                       (x + 5, y - 5), 
                       font, 
                       font_scale, 
                       (255, 255, 255), 
                       font_thickness)
        
        return result

    def process_image(
        self,
        image: np.ndarray,
        min_confidence: float = 0.9,
        padding: float = 0.2,
        pixel_size: int = 16
    ) -> Tuple[np.ndarray, int]:
        """
        Procesa una imagen completa: detecta y pixela caras
        
        Args:
            image: Imagen en formato numpy array
            min_confidence: Confianza mínima para detección
            padding: Margen adicional alrededor de caras
            pixel_size: Tamaño del píxel para efecto
        
        Returns:
            Tupla (imagen_procesada, num_caras_detectadas)
        """
        # Detectar caras
        face_regions = self.detect_faces(image, min_confidence, padding)
        
        # Si no hay caras, retornar imagen original
        if not face_regions:
            return image, 0
        
        # Pixelar caras
        processed_image = self.pixelate_faces(image, face_regions, pixel_size)
        
        return processed_image, len(face_regions)
    
    def get_gpu_info(self) -> dict:
        """Obtiene información sobre el uso de GPU"""
        gpu_available = len(tf.config.list_physical_devices('GPU')) > 0
        
        info = {
            'gpu_available': gpu_available,
            'using_gpu': self.use_gpu and gpu_available,
            'tensorflow_version': tf.__version__
        }
        
        if gpu_available:
            gpus = tf.config.list_physical_devices('GPU')
            info['gpu_devices'] = [gpu.name for gpu in gpus]
        
        return info
