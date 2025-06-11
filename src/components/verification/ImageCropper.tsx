'use client';

import { useState, useRef, useEffect } from 'react';
import type { CropData } from '@/types/shared';

interface ImageCropperProps {
  imageUrl: string;
  onCropChange: (cropData: CropData) => void;
  onCropComplete: (cropData: CropData) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageCropper({
  imageUrl,
  onCropChange,
  onCropComplete,
  onCancel
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [canvasScale, setCanvasScale] = useState(1);

  // Calcular el área de recorte inicial
  const calculateInitialCrop = (imgWidth: number, imgHeight: number) => {
    const isHorizontal = imgWidth > imgHeight;
    const squareSize = isHorizontal ? imgHeight : imgWidth;
    
    return {
      x: (imgWidth - squareSize) / 2,
      y: (imgHeight - squareSize) / 2,
      width: squareSize,
      height: squareSize
    };
  };

  // Dibujar en el canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    
    if (!canvas || !img || !imageLoaded || imageDimensions.width === 0 || imageDimensions.height === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calcular escala para ajustar la imagen al canvas (responsive)
    const maxWidth = Math.min(window.innerWidth - 64, 800); // 64px para padding lateral
    const maxHeight = Math.min(window.innerHeight * 0.6, 600);
    const scale = Math.min(maxWidth / imageDimensions.width, maxHeight / imageDimensions.height, 1);

    const displayWidth = imageDimensions.width * scale;
    const displayHeight = imageDimensions.height * scale;

    // Establecer dimensiones del canvas
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar imagen
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    // Dibujar overlay oscuro
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Limpiar área de recorte (mostrar imagen original)
    const scaledCrop = {
      x: cropArea.x * scale,
      y: cropArea.y * scale,
      width: cropArea.width * scale,
      height: cropArea.height * scale
    };

    ctx.clearRect(scaledCrop.x, scaledCrop.y, scaledCrop.width, scaledCrop.height);
    ctx.drawImage(
      img,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      scaledCrop.x, scaledCrop.y, scaledCrop.width, scaledCrop.height
    );

    // Dibujar borde de selección
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(scaledCrop.x, scaledCrop.y, scaledCrop.width, scaledCrop.height);

    // Dibujar esquinas para redimensionar
    const cornerSize = 8;
    ctx.fillStyle = '#3b82f6';
    
    // Esquinas
    ctx.fillRect(scaledCrop.x - cornerSize/2, scaledCrop.y - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(scaledCrop.x + scaledCrop.width - cornerSize/2, scaledCrop.y - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(scaledCrop.x - cornerSize/2, scaledCrop.y + scaledCrop.height - cornerSize/2, cornerSize, cornerSize);
    ctx.fillRect(scaledCrop.x + scaledCrop.width - cornerSize/2, scaledCrop.y + scaledCrop.height - cornerSize/2, cornerSize, cornerSize);
  };

  // Cargar imagen
  useEffect(() => {
    setImageLoaded(false);
    
    const loadImageAsync = async () => {
      try {
        // Usar loadImageWithProxy que maneja automáticamente SharePoint
        const { loadImageWithProxy } = await import('@/utils/sharePointProxy');
        const img = await loadImageWithProxy(imageUrl);
        
        setImageDimensions({ width: img.width, height: img.height });
        const initialCrop = calculateInitialCrop(img.width, img.height);
        setCropArea(initialCrop);
        setImageLoaded(true);
        
        // Calcular escala (responsive)
        const maxWidth = Math.min(window.innerWidth - 64, 800);
        const maxHeight = Math.min(window.innerHeight * 0.6, 600);
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        setCanvasScale(scale);
        
        // Notificar crop inicial
        onCropChange(initialCrop);
        
        // Guardar referencia de la imagen
        imageRef.current = img;
      } catch (error) {
        console.error('Error loading image:', error);
      }
    };
    
    loadImageAsync();
  }, [imageUrl]);

  // Redibujar cuando cambie el crop area
  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [cropArea, imageLoaded]);

  // Obtener coordenadas del mouse o touch
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Detectar si es touch o mouse event
    let clientX, clientY;
    if ('touches' in e) {
      // Touch event
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        return { x: 0, y: 0 };
      }
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / canvasScale,
      y: (clientY - rect.top) / canvasScale
    };
  };

  // Verificar esquina
  const getCornerAtPosition = (x: number, y: number) => {
    const tolerance = 15;

    if (Math.abs(x - cropArea.x) < tolerance && Math.abs(y - cropArea.y) < tolerance) {
      return 'top-left';
    }
    if (Math.abs(x - (cropArea.x + cropArea.width)) < tolerance && Math.abs(y - cropArea.y) < tolerance) {
      return 'top-right';
    }
    if (Math.abs(x - cropArea.x) < tolerance && Math.abs(y - (cropArea.y + cropArea.height)) < tolerance) {
      return 'bottom-left';
    }
    if (Math.abs(x - (cropArea.x + cropArea.width)) < tolerance && Math.abs(y - (cropArea.y + cropArea.height)) < tolerance) {
      return 'bottom-right';
    }

    return null;
  };

  // Verificar si está dentro del área
  const isInsideCropArea = (x: number, y: number) => {
    return x >= cropArea.x && x <= cropArea.x + cropArea.width &&
           y >= cropArea.y && y <= cropArea.y + cropArea.height;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const corner = getCornerAtPosition(pos.x, pos.y);

    if (corner) {
      setIsResizing(true);
      setDragStart({ x: pos.x, y: pos.y });
    } else if (isInsideCropArea(pos.x, pos.y)) {
      setIsDragging(true);
      setDragStart({ x: pos.x - cropArea.x, y: pos.y - cropArea.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);

    if (isDragging) {
      const newX = Math.max(0, Math.min(pos.x - dragStart.x, imageDimensions.width - cropArea.width));
      const newY = Math.max(0, Math.min(pos.y - dragStart.y, imageDimensions.height - cropArea.height));
      
      const newCropArea = { ...cropArea, x: newX, y: newY };
      setCropArea(newCropArea);
      onCropChange(newCropArea);
    } else if (isResizing) {
      const corner = getCornerAtPosition(dragStart.x, dragStart.y);
      if (!corner) return;

      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));

      let newCrop = { ...cropArea };

      switch (corner) {
        case 'bottom-right':
          const newSize = Math.max(50, Math.min(cropArea.width + delta,
            Math.min(imageDimensions.width - cropArea.x, imageDimensions.height - cropArea.y)));
          newCrop = {
            ...cropArea,
            width: newSize,
            height: newSize
          };
          break;
      }

      if (newCrop.x >= 0 && newCrop.y >= 0 && 
          newCrop.x + newCrop.width <= imageDimensions.width &&
          newCrop.y + newCrop.height <= imageDimensions.height) {
        setCropArea(newCrop);
        onCropChange(newCrop);
      }
    } else {
      // Cambiar cursor
      const canvas = canvasRef.current;
      if (!canvas) return;

      const corner = getCornerAtPosition(pos.x, pos.y);
      if (corner) {
        canvas.style.cursor = 'nw-resize';
      } else if (isInsideCropArea(pos.x, pos.y)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevenir scroll en móvil
    const pos = getMousePos(e);
    const corner = getCornerAtPosition(pos.x, pos.y);

    if (corner) {
      setIsResizing(true);
      setDragStart({ x: pos.x, y: pos.y });
    } else if (isInsideCropArea(pos.x, pos.y)) {
      setIsDragging(true);
      setDragStart({ x: pos.x - cropArea.x, y: pos.y - cropArea.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevenir scroll en móvil
    const pos = getMousePos(e);

    if (isDragging) {
      const newX = Math.max(0, Math.min(pos.x - dragStart.x, imageDimensions.width - cropArea.width));
      const newY = Math.max(0, Math.min(pos.y - dragStart.y, imageDimensions.height - cropArea.height));
      
      const newCropArea = { ...cropArea, x: newX, y: newY };
      setCropArea(newCropArea);
      onCropChange(newCropArea);
    } else if (isResizing) {
      const corner = getCornerAtPosition(dragStart.x, dragStart.y);
      if (!corner) return;

      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));

      let newCrop = { ...cropArea };

      switch (corner) {
        case 'bottom-right':
          const newSize = Math.max(50, Math.min(cropArea.width + delta,
            Math.min(imageDimensions.width - cropArea.x, imageDimensions.height - cropArea.y)));
          newCrop = {
            ...cropArea,
            width: newSize,
            height: newSize
          };
          break;
      }

      if (newCrop.x >= 0 && newCrop.y >= 0 && 
          newCrop.x + newCrop.width <= imageDimensions.width &&
          newCrop.y + newCrop.height <= imageDimensions.height) {
        setCropArea(newCrop);
        onCropChange(newCrop);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleAccept = () => {
    onCropComplete(cropArea);
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div className="bg-white rounded-lg shadow-md p-2 md:p-4 w-full max-w-4xl">
        {!imageLoaded ? (
          <div className="flex items-center justify-center w-full h-64 md:h-96 border border-gray-300 rounded bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Cargando imagen...</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center w-full overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="border border-gray-300 rounded cursor-crosshair touch-none max-w-full h-auto"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md">
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleAccept}
          disabled={!imageLoaded}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Aceptar Recorte
        </button>
      </div>

      {imageLoaded && (
        <div className="text-sm text-gray-600 text-center max-w-md px-4">
          <p className="mb-1">Arrastra para mover • Usa la esquina inferior derecha para redimensionar</p>
          <p>Tamaño: {Math.round(cropArea.width)} × {Math.round(cropArea.height)} px</p>
        </div>
      )}
    </div>
  );
}
