import * as React from 'react';
import { useToast } from "@/hooks/use-toast";
import CameraView from './CameraView';
import VitalChart from './VitalChart';
import BPCalibrationForm from './BPCalibrationForm';
import VitalSignsDisplay from './vitals/VitalSignsDisplay';
import SignalQualityIndicator from './vitals/SignalQualityIndicator';
import MeasurementControls from './vitals/MeasurementControls';
import { PPGProcessor } from '../utils/ppgProcessor';
import { useVitals } from '@/contexts/VitalsContext';
import { useEffect, useCallback } from 'react';

const ppgProcessor = new PPGProcessor();

const HeartRateMonitor: React.FC = () => {
  const { 
    bpm, 
    spo2, 
    systolic, 
    diastolic, 
    hasArrhythmia, 
    arrhythmiaType,
    readings,
    isStarted,
    measurementProgress,
    measurementQuality,
    toggleMeasurement,
    processFrame
  } = useVitals();

  const { toast } = useToast();

  useEffect(() => {
    const handleOrientation = () => {
      if (window.screen.orientation) {
        if (window.screen.orientation.type.includes('portrait')) {
          toast({
            title: "Recomendación",
            description: "Para una mejor medición, use el dispositivo en modo vertical",
            variant: "default",
          });
        }
      }
    };

    window.addEventListener('orientationchange', handleOrientation);
    return () => window.removeEventListener('orientationchange', handleOrientation);
  }, [toast]);

  const handleFrameProcessing = useCallback(
    async (frame: ImageData) => {
      const brightness = calculateBrightness(frame);
      
      if (brightness < 50) {
        toast({
          title: "Iluminación insuficiente",
          description: "Asegúrese de que la linterna esté encendida y el dedo bien colocado",
          variant: "destructive",
        });
      }
      
      return processFrame(frame);
    },
    [processFrame, toast]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-7xl mx-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-100">Monitor de Signos Vitales</h2>
        </div>

        <VitalSignsDisplay
          bpm={bpm}
          spo2={spo2}
          systolic={systolic}
          diastolic={diastolic}
          hasArrhythmia={hasArrhythmia}
          arrhythmiaType={arrhythmiaType}
        />

        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
          <CameraView onFrame={handleFrameProcessing} isActive={isStarted} />
          {isStarted && bpm === 0 && (
            <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-300 text-sm">
                No se detecta el dedo en la cámara. Por favor, coloque su dedo sobre el lente y asegúrese de que la linterna esté encendida.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isStarted && (
          <SignalQualityIndicator
            isStarted={isStarted}
            measurementQuality={measurementQuality}
            measurementProgress={measurementProgress}
          />
        )}

        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
          <h3 className="text-lg font-medium mb-2 text-gray-100">Señal PPG en Tiempo Real</h3>
          <VitalChart data={readings} color="#ea384c" />
        </div>

        <MeasurementControls
          isStarted={isStarted}
          onToggleMeasurement={toggleMeasurement}
        />
      </div>
    </div>
  );
};

const calculateBrightness = (frame: ImageData): number => {
  let sum = 0;
  for (let i = 0; i < frame.data.length; i += 4) {
    const r = frame.data[i];
    const g = frame.data[i + 1];
    const b = frame.data[i + 2];
    sum += (r + g + b) / 3;
  }
  return sum / (frame.width * frame.height);
};

export default HeartRateMonitor;
