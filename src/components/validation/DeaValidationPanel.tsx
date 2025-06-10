'use client';

import StepByStepValidation from './StepByStepValidation';

interface DeaValidationPanelProps {
  deaRecordId: number;
  onValidationComplete?: () => void;
}

export default function DeaValidationPanel({ 
  deaRecordId, 
  onValidationComplete 
}: DeaValidationPanelProps) {
  return (
    <div className="space-y-6">
      <StepByStepValidation 
        deaRecordId={deaRecordId}
        onComplete={() => {
          // Llamar al callback cuando se complete la validación
          onValidationComplete?.();
        }}
      />
    </div>
  );
}
