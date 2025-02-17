import { VitalReading, PPGData, SensitivitySettings, ProcessingSettings } from './types';
import { BeepPlayer } from './audioUtils';
import { SignalProcessor } from './signalProcessing';
import { SignalExtractor } from './signalExtraction';
import { PeakDetector } from './peakDetection';
import { SignalNormalizer } from './signalNormalization';
import { SignalFilter } from './signalFilter';
import { SignalFrequencyAnalyzer } from './signalFrequencyAnalyzer';
import { MLModel } from './mlModel';

export class PPGProcessor {
  private readings: VitalReading[] = [];
  private redBuffer: number[] = [];
  private irBuffer: number[] = [];
  private peakTimes: number[] = [];
  private readonly samplingRate = 30;
  private readonly windowSize = 300;
  private readonly signalProcessor: SignalProcessor;
  private readonly signalExtractor: SignalExtractor;
  private readonly peakDetector: PeakDetector;
  private readonly signalNormalizer: SignalNormalizer;
  private readonly signalFilter: SignalFilter;
  private readonly frequencyAnalyzer: SignalFrequencyAnalyzer;
  private beepPlayer: BeepPlayer;
  private readonly signalBuffer: number[] = [];
  private readonly bufferSize = 30;
  private readonly qualityThreshold = 0.2;
  private mlModel: MLModel;
  private trainingData: number[][] = [];
  private targetData: number[][] = [];
  private frameCount: number = 0;
  private lastValidBpm: number = 0;
  private lastValidSystolic: number = 120;
  private lastValidDiastolic: number = 80;
  
  private sensitivitySettings: SensitivitySettings = {
    signalAmplification: 1.5,
    noiseReduction: 1.2,
    peakDetection: 1.3
  };
  
  private processingSettings: ProcessingSettings = {
    MEASUREMENT_DURATION: 30,
    MIN_FRAMES_FOR_CALCULATION: 15,
    MIN_PEAKS_FOR_VALID_HR: 2,
    MIN_PEAK_DISTANCE: 400,
    MAX_PEAK_DISTANCE: 1200,
    PEAK_THRESHOLD_FACTOR: 0.4,
    MIN_RED_VALUE: 15,
    MIN_RED_DOMINANCE: 1.2,
    MIN_VALID_PIXELS_RATIO: 0.2,
    MIN_BRIGHTNESS: 80,
    MIN_VALID_READINGS: 30,
    FINGER_DETECTION_DELAY: 500,
    MIN_SPO2: 75
  };
  
  constructor() {
    this.beepPlayer = new BeepPlayer();
    this.signalProcessor = new SignalProcessor(this.windowSize);
    this.signalExtractor = new SignalExtractor();
    this.peakDetector = new PeakDetector();
    this.signalNormalizer = new SignalNormalizer();
    this.signalFilter = new SignalFilter(this.samplingRate);
    this.frequencyAnalyzer = new SignalFrequencyAnalyzer(this.samplingRate);
    this.mlModel = new MLModel();
  }

  private validateVitalSigns(bpm: number, systolic: number, diastolic: number): {
    bpm: number;
    systolic: number;
    diastolic: number;
  } {
    // Validar BPM (40-200 es un rango normal para humanos)
    const validBpm = bpm >= 40 && bpm <= 200 ? bpm : this.lastValidBpm || 0;
    
    // Validar presión sistólica (90-180 es un rango normal)
    const validSystolic = systolic >= 90 && systolic <= 180 ? 
      systolic : this.lastValidSystolic;
    
    // Validar presión diastólica (60-120 es un rango normal)
    const validDiastolic = diastolic >= 60 && diastolic <= 120 ? 
      diastolic : this.lastValidDiastolic;
    
    // Asegurar que sistólica > diastólica
    if (validSystolic <= validDiastolic) {
      return {
        bpm: validBpm,
        systolic: this.lastValidSystolic,
        diastolic: this.lastValidDiastolic
      };
    }

    // Actualizar últimos valores válidos
    this.lastValidBpm = validBpm;
    this.lastValidSystolic = validSystolic;
    this.lastValidDiastolic = validDiastolic;

    return {
      bpm: validBpm,
      systolic: validSystolic,
      diastolic: validDiastolic
    };
  }

  private async updateSettingsWithML(calculatedBpm: number, spo2: number, signalQuality: number) {
    try {
      const inputFeatures = [calculatedBpm, spo2, signalQuality];
      const optimizedSettings = await this.mlModel.predictOptimizedSettings(inputFeatures);
      
      if (!isNaN(optimizedSettings[0]) && !isNaN(optimizedSettings[1]) && !isNaN(optimizedSettings[2])) {
        console.log("Valores ML recibidos:", optimizedSettings);
        
        if (optimizedSettings[0] >= 10 && optimizedSettings[0] <= 30) {
          this.processingSettings.MIN_RED_VALUE = optimizedSettings[0];
        }
        if (optimizedSettings[1] >= 0.3 && optimizedSettings[1] <= 0.7) {
          this.processingSettings.PEAK_THRESHOLD_FACTOR = optimizedSettings[1];
        }
        if (optimizedSettings[2] >= 0.1 && optimizedSettings[2] <= 0.5) {
          this.processingSettings.MIN_VALID_PIXELS_RATIO = optimizedSettings[2];
        }

        console.log("✔ Parámetros ML actualizados:", {
          MIN_RED_VALUE: this.processingSettings.MIN_RED_VALUE,
          PEAK_THRESHOLD_FACTOR: this.processingSettings.PEAK_THRESHOLD_FACTOR,
          MIN_VALID_PIXELS_RATIO: this.processingSettings.MIN_VALID_PIXELS_RATIO,
          inputFeatures
        });
      } else {
        console.warn("⚠ Valores ML inválidos recibidos:", optimizedSettings);
      }
    } catch (error) {
      console.error("Error actualizando settings con ML:", error);
    }
  }

  private async trainMLModel() {
    if (this.trainingData.length > 10) {
      console.log("Entrenando modelo ML con", this.trainingData.length, "muestras");
      await this.mlModel.trainModel(this.trainingData, this.targetData);
    } else {
      console.log("Datos insuficientes para entrenar:", this.trainingData.length, "muestras");
    }
  }

  private saveTrainingData(calculatedBpm: number, spo2: number, signalQuality: number) {
    if (calculatedBpm > 40 && calculatedBpm < 200 && 
        spo2 >= 75 && spo2 <= 100 && 
        signalQuality > 0.2) {
      
      this.trainingData.push([calculatedBpm, spo2, signalQuality]);
      this.targetData.push([
        this.processingSettings.MIN_RED_VALUE,
        this.processingSettings.PEAK_THRESHOLD_FACTOR,
        this.processingSettings.MIN_VALID_PIXELS_RATIO
      ]);

      console.log("Datos de entrenamiento guardados:", {
        entrada: [calculatedBpm, spo2, signalQuality],
        objetivo: [
          this.processingSettings.MIN_RED_VALUE,
          this.processingSettings.PEAK_THRESHOLD_FACTOR,
          this.processingSettings.MIN_VALID_PIXELS_RATIO
        ]
      });

      if (this.trainingData.length > 100) {
        this.trainingData.shift();
        this.targetData.shift();
      }
    } else {
      console.log("Datos ignorados por valores fuera de rango:", {
        bpm: calculatedBpm,
        spo2,
        signalQuality
      });
    }
  }

  async processFrame(imageData: ImageData): Promise<PPGData | null> {
    this.frameCount++;
    const now = Date.now();
    
    const { red, ir, quality } = this.signalExtractor.extractChannels(imageData);
    
    if (quality < this.qualityThreshold || red < this.processingSettings.MIN_RED_VALUE) {
      this.redBuffer = [];
      this.irBuffer = [];
      this.readings = [];
      this.peakTimes = [];
      return {
        bpm: 0,
        spo2: 0,
        systolic: 0,
        diastolic: 0,
        hasArrhythmia: false,
        arrhythmiaType: 'Normal',
        signalQuality: 0,
        confidence: 0,
        readings: [],
        isPeak: false,
        hrvMetrics: {
          sdnn: 0,
          rmssd: 0,
          pnn50: 0,
          lfhf: 0
        }
      };
    }
    
    const amplifiedRed = red * this.sensitivitySettings.signalAmplification;
    const amplifiedIr = ir * this.sensitivitySettings.signalAmplification;
    
    this.redBuffer.push(amplifiedRed);
    this.irBuffer.push(amplifiedIr);
    
    if (this.redBuffer.length > this.windowSize) {
      this.redBuffer.shift();
      this.irBuffer.shift();
    }
    
    const filteredRed = this.signalFilter.lowPassFilter(this.redBuffer, 
      5 * this.sensitivitySettings.noiseReduction);
    const normalizedValue = this.signalNormalizer.normalizeSignal(
      filteredRed[filteredRed.length - 1]
    );

    this.signalBuffer.push(normalizedValue);
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer.shift();
    }

    const isPeak = this.peakDetector.isRealPeak(normalizedValue, now, this.signalBuffer);

    if (isPeak) {
      this.readings.unshift({ timestamp: now, value: normalizedValue });
      if (this.readings.length > this.windowSize) {
        this.readings.pop();
      }
      
      this.peakTimes.push(now);
      if (this.peakTimes.length > 10) {
        this.peakTimes.shift();
      }
      
      try {
        await this.beepPlayer.playBeep('heartbeat', quality);
        console.log('🫀 Pico detectado + Beep reproducido + Gráfico actualizado:', {
          tiempo: now,
          valorPico: normalizedValue,
          calidadSenal: quality,
          lecturasTotales: this.readings.length
        });
      } catch (err) {
        console.error('Error al reproducir beep:', err);
      }
    } else {
      this.readings.push({ timestamp: now, value: normalizedValue });
      if (this.readings.length > this.windowSize) {
        this.readings.shift();
      }
    }

    const { frequencies, magnitudes } = this.frequencyAnalyzer.performFFT(filteredRed);
    const dominantFreqIndex = magnitudes.indexOf(Math.max(...magnitudes));
    const dominantFreq = frequencies[dominantFreqIndex];
    const calculatedBpm = dominantFreq * 60;
    
    const intervals = this.peakTimes.slice(1).map((time, i) => time - this.peakTimes[i]);
    const hrvAnalysis = this.signalProcessor.analyzeHRV(intervals);
    const spo2Result = this.signalProcessor.calculateSpO2(this.redBuffer, this.irBuffer);
    const bp = this.signalProcessor.estimateBloodPressure(filteredRed, this.peakTimes);
    const signalQuality = this.signalProcessor.analyzeSignalQuality(filteredRed);
    const validatedVitals = this.validateVitalSigns(calculatedBpm, bp.systolic, bp.diastolic);

    if (this.frameCount % 30 === 0 && validatedVitals.bpm > 0) {
      this.saveTrainingData(validatedVitals.bpm, spo2Result.spo2, signalQuality);
      await this.trainMLModel();
      await this.updateSettingsWithML(validatedVitals.bpm, spo2Result.spo2, signalQuality);
    }

    return {
      bpm: validatedVitals.bpm,
      spo2: Math.min(100, Math.max(75, spo2Result.spo2)),
      systolic: validatedVitals.systolic,
      diastolic: validatedVitals.diastolic,
      hasArrhythmia: hrvAnalysis.hasArrhythmia,
      arrhythmiaType: hrvAnalysis.type,
      signalQuality,
      confidence: spo2Result.confidence,
      readings: this.readings,
      isPeak,
      hrvMetrics: {
        sdnn: hrvAnalysis.sdnn,
        rmssd: hrvAnalysis.rmssd,
        pnn50: hrvAnalysis.pnn50,
        lfhf: hrvAnalysis.lfhf
      }
    };
  }

  getReadings(): VitalReading[] {
    return this.readings;
  }

  updateSensitivitySettings(settings: SensitivitySettings) {
    this.sensitivitySettings = settings;
    console.log('Sensitivity settings updated:', settings);
  }
}
