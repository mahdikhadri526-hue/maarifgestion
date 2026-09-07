// Chargement paresseux de la reconnaissance faciale (modèles servis depuis /face-models).
import type * as FaceApiType from "@vladmandic/face-api";

let faceapi: typeof FaceApiType | null = null;
let loading: Promise<typeof FaceApiType> | null = null;

const MODEL_URL = "/face-models";

export async function loadFaceApi(): Promise<typeof FaceApiType> {
  if (faceapi) return faceapi;
  if (loading) return loading;
  loading = (async () => {
    const mod = await import("@vladmandic/face-api");
    await Promise.all([
      mod.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      mod.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      mod.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    faceapi = mod;
    return mod;
  })();
  return loading;
}

/** Calcule l'empreinte du visage le plus visible dans l'image. `null` si aucun visage. */
export async function computeDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  const api = await loadFaceApi();
  const result = await api
    .detectSingleFace(input as any, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

export function euclidean(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Seuil de correspondance : en dessous, on considère que c'est la même personne. */
export const MATCH_THRESHOLD = 0.5;

export interface FaceCandidate {
  id: string;
  name: string;
  descriptors: number[][];
}

export interface FaceMatch {
  id: string;
  name: string;
  distance: number;
}

export function findBestMatch(descriptor: Float32Array, candidates: FaceCandidate[]): FaceMatch | null {
  let best: FaceMatch | null = null;
  for (const c of candidates) {
    for (const d of c.descriptors) {
      if (!d || d.length !== descriptor.length) continue;
      const dist = euclidean(descriptor, d);
      if (!best || dist < best.distance) best = { id: c.id, name: c.name, distance: dist };
    }
  }
  return best;
}
