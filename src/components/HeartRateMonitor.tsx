
import React, { useState, useCallback, useEffect } from 'react';
import { Heart, Droplets, Activity, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import CameraView from './CameraView';
import VitalChart from './VitalChart';
import { PPGProcessor } from '../utils/ppgProcessor';
import type { VitalReading } from '../utils/types';
import { supabase } from '@/integrations/supabase/client';

const ppgProcessor = new PPGProcessor();

const HeartRateMonitor: React.FC = () => {
  const [bpm, setBpm] = useState<number>(0);
  const [spo2, setSpo2] = useState<number>(0);
  const [systolic, setSystolic] = useState<number>(0);
  const [diastolic, setDiastolic] = useState<number>(0);
  const [hasArrhythmia, setHasArrhythmia] = useState<boolean>(false);
  const [arrhythmiaType, setArrhythmiaType] = useState<string>('Normal');
  const [readings, setReadings] = useState<VitalReading[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { toast } = useToast();

  // Guardar las mediciones en Supabase
  useEffect(() => {
    const saveVitalSigns = async () => {
      if (bpm > 0 && spo2 > 0) {
        try {
          const vitalSignsData = {
            heart_rate: bpm,
            spo2: spo2,
            systolic: systolic,
            diastolic: diastolic,
            has_arrhythmia: hasArrhythmia,
            arrhythmia_details: { type: arrhythmiaType },
            ppg_data: JSON.stringify({ readings }),
            measurement_quality: 1.0,
          };

          const { error } = await supabase
            .from('vital_signs')
            .insert(vitalSignsData);

          if (error) {
            console.error('Error saving vital signs:', error);
            toast({
              variant: "destructive",
              title: "Error al guardar los signos vitales",
              description: "Por favor, intenta nuevamente."
            });
          } else {
            toast({
              title: "Medición guardada",
              description: "Los signos vitales se han registrado correctamente."
            });
          }
        } catch (error) {
          console.error('Error in saveVitalSigns:', error);
          toast({
            variant: "destructive",
            title: "Error inesperado",
            description: "Ocurrió un error al procesar la medición."
          });
        }
      }
    };

    if (isProcessing && bpm > 0) {
      saveVitalSigns();
    }
  }, [bpm, spo2, systolic, diastolic, hasArrhythmia, arrhythmiaType, readings, isProcessing, toast]);

  const handleFrame = useCallback((imageData: ImageData) => {
    setIsProcessing(true);
    try {
      const vitals = ppgProcessor.processFrame(imageData);
      setBpm(vitals.bpm);
      setSpo2(vitals.spo2);
      setSystolic(vitals.systolic);
      setDiastolic(vitals.diastolic);
      setHasArrhythmia(vitals.hasArrhythmia);
      setArrhythmiaType(vitals.arrhythmiaType);
      setReadings(ppgProcessor.getReadings());
    } catch (error) {
      console.error('Error processing frame:', error);
      toast({
        variant: "destructive",
        title: "Error en el procesamiento",
        description: "Error al procesar la imagen de la cámara."
      });
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Heart className="w-6 h-6 text-[#ea384c]" />
              <h2 className="text-xl font-semibold text-gray-100">Heart Rate</h2>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-100">{bpm}</span>
              <span className="text-sm text-gray-300">BPM</span>
            </div>
          </div>
        </div>

        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Droplets className="w-6 h-6 text-[#3b82f6]" />
              <h2 className="text-xl font-semibold text-gray-100">SpO2</h2>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-100">{spo2}</span>
              <span className="text-sm text-gray-300">%</span>
            </div>
          </div>
        </div>

        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-6 h-6 text-[#10b981]" />
              <h2 className="text-xl font-semibold text-gray-100">Blood Pressure</h2>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-100">{systolic}/{diastolic}</span>
              <span className="text-sm text-gray-300">mmHg</span>
            </div>
          </div>
        </div>

        <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className={`w-6 h-6 ${hasArrhythmia ? 'text-[#f59e0b]' : 'text-[#10b981]'}`} />
              <h2 className="text-xl font-semibold text-gray-100">Rhythm</h2>
            </div>
            <div className="flex items-baseline">
              <span className={`text-xl font-bold ${hasArrhythmia ? 'text-[#f59e0b]' : 'text-gray-100'}`}>
                {arrhythmiaType}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        <CameraView onFrame={handleFrame} />
      </div>
      
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        <h3 className="text-lg font-medium mb-4 text-gray-100">Señal PPG en Tiempo Real</h3>
        <VitalChart data={readings} color="#ea384c" />
      </div>
    </div>
  );
};

export default HeartRateMonitor;
