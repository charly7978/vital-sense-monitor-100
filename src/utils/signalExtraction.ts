
export class SignalExtractor {
  private readonly minIntensity = 45;
  private readonly maxIntensity = 250;
  private readonly smoothingWindow = 5;
  private lastRedValues: number[] = [];
  private lastIrValues: number[] = [];
  private frameCount = 0;
  private readonly minValidPixels = 100; // Mínimo de píxeles válidos para considerar dedo presente
  private readonly redDominanceThreshold = 1.2; // El canal rojo debe ser dominante
  private readonly stabilityThreshold = 0.15; // Umbral para considerar señal estable
  private lastStabilityValues: number[] = [];

  private kalman = {
    q: 0.1,
    r: 0.8,
    p: 1,
    x: 0,
    k: 0
  };

  private applyKalmanFilter(measurement: number) {
    this.kalman.p = this.kalman.p + this.kalman.q;
    this.kalman.k = this.kalman.p / (this.kalman.p + this.kalman.r);
    this.kalman.x = this.kalman.x + this.kalman.k * (measurement - this.kalman.x);
    this.kalman.p = (1 - this.kalman.k) * this.kalman.p;
    return this.kalman.x;
  }

  private calculateStability(value: number): number {
    this.lastStabilityValues.push(value);
    if (this.lastStabilityValues.length > 10) {
      this.lastStabilityValues.shift();
    }

    if (this.lastStabilityValues.length < 5) return 0;

    const mean = this.lastStabilityValues.reduce((a, b) => a + b, 0) / this.lastStabilityValues.length;
    const variance = this.lastStabilityValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.lastStabilityValues.length;
    const stability = 1 - Math.min(1, Math.sqrt(variance) / mean);
    
    return stability;
  }

  extractChannels(imageData: ImageData): { red: number; ir: number; quality: number; perfusionIndex: number } {
    this.frameCount++;
    let redSum = 0, irSum = 0, pixelCount = 0;
    let maxRed = 0, maxIr = 0;

    const { width, height } = imageData;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = 50;

    // Arrays para almacenar valores de píxeles válidos
    const validRedValues: number[] = [];
    const validIrValues: number[] = [];

    for (let y = centerY - regionSize; y < centerY + regionSize; y++) {
      for (let x = centerX - regionSize; x < centerX + regionSize; x++) {
        const i = (y * width + x) * 4;
        const red = imageData.data[i];
        const green = imageData.data[i + 1];
        const blue = imageData.data[i + 2];
        const ir = (green + blue) / 2;

        // Validación mejorada de píxeles
        if (red > this.minIntensity && red < this.maxIntensity) {
          validRedValues.push(red);
          validIrValues.push(ir);
          redSum += red;
          irSum += ir;
          pixelCount++;
          maxRed = Math.max(maxRed, red);
          maxIr = Math.max(maxIr, ir);
        }
      }
    }

    // Verificaciones mejoradas para detección del dedo
    if (pixelCount < this.minValidPixels) {
      console.log('Pocos píxeles válidos:', pixelCount);
      return { red: 0, ir: 0, quality: 0, perfusionIndex: 0 };
    }

    let avgRed = redSum / pixelCount;
    let avgIr = irSum / pixelCount;

    // Verificar dominancia del canal rojo (característica del dedo)
    if (avgRed / avgIr < this.redDominanceThreshold) {
      console.log('Canal rojo no dominante:', avgRed / avgIr);
      return { red: 0, ir: 0, quality: 0, perfusionIndex: 0 };
    }

    this.lastRedValues.push(avgRed);
    this.lastIrValues.push(avgIr);
    if (this.lastRedValues.length > this.smoothingWindow) this.lastRedValues.shift();
    if (this.lastIrValues.length > this.smoothingWindow) this.lastIrValues.shift();

    // Aplicar Kalman y suavizado
    avgRed = this.applyKalmanFilter(
      this.lastRedValues.reduce((a, b) => a + b, 0) / this.lastRedValues.length
    );

    avgIr = this.applyKalmanFilter(
      this.lastIrValues.reduce((a, b) => a + b, 0) / this.lastIrValues.length
    );

    // Calcular estabilidad de la señal
    const stability = this.calculateStability(avgRed);
    
    // Calcular índice de perfusión
    const perfusionIndex = (maxRed - Math.min(...validRedValues)) / maxRed * 100;

    // Calidad basada en múltiples factores
    const pixelQuality = Math.min(1, pixelCount / (this.minValidPixels * 2));
    const stabilityQuality = stability > this.stabilityThreshold ? 1 : stability / this.stabilityThreshold;
    const quality = Math.min(pixelQuality, stabilityQuality);

    if (this.frameCount % 30 === 0) {
      console.log('Métricas de calidad:', {
        pixelCount,
        stability,
        quality,
        perfusionIndex,
        redDominance: avgRed / avgIr
      });
    }

    return { 
      red: avgRed, 
      ir: avgIr, 
      quality: quality,
      perfusionIndex 
    };
  }
}
