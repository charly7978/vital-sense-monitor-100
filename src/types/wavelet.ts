
import { Float64Type } from './common';

export interface WaveletCoefficients {
  approximation: Float64Type;
  details: Float64Type[];
  level: number;
}

export interface WaveletTransform {
  transform: (signal: Float64Type) => WaveletCoefficients;
  inverse: (coefficients: WaveletCoefficients) => Float64Type;
  coefficients?: WaveletCoefficients;  // Optional storage for coefficients
  forward?: (signal: Float64Type) => WaveletCoefficients; // Alias for transform
}

export interface WaveletBasis {
  name: string;
  filter: Float64Type;
  scaling: Float64Type;
  scale?: number; // Optional scale parameter
}

export interface WaveletPacket {
  nodes: WaveletCoefficients[];
  tree: number[][];
  depth: number;
}

export interface ScaleSpace {
  scales: Float64Type[];
  coefficients: Float64Type[][];
}

export interface SubbandFeatures {
  energy: Float64Type;
  entropy: Float64Type;
  variance: Float64Type;
}

export interface OptimizedDWT extends WaveletTransform {
  packed: boolean;
  vectorized: boolean;
  forward: (signal: Float64Type) => WaveletCoefficients;
}

export interface WaveletAnalysis {
  coefficients: WaveletCoefficients;
  features: SubbandFeatures;
  quality: number;
  levels?: number[];
}
