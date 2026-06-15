import { S3ClientConfig } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// ─── Configuración AWS ──────────────────────────────────────────────────────

export type AwsClientConfig = S3ClientConfig;

// ─── Datos Extraídos del Documento ──────────────────────────────────────────

export interface DriverDocumentExtractedData {
  scanMethod?: string;
  matchedNationalId?: boolean;
  matchedName?: boolean;
  extractedTextSnippet?: string;
  verificationFailureReason?: string;
  workerError?: string;
  diditSessionId?: string;
  diditUrl?: string;
  diditDecision?: DiditDecisionResponse;
  expirationDate?: string;
  isMock?: boolean;
}

// ─── Respuestas de la API Didit ─────────────────────────────────────────────

export interface DiditBarcode {
  type: string;
  was_decoded: boolean;
  raw_text: string | null;
  error?: string;
}

export interface DiditIdVerification {
  status: string;
  document_type?: string;
  expiration_date?: string;
  extra_fields?: {
    dl_categories?: string;
    [key: string]: string | undefined;
  };
  barcodes?: DiditBarcode[];
}

export interface DiditSessionResponse {
  session_id: string;
  url: string;
}

export interface DiditDecisionResponse {
  status: string;
  id_verifications?: DiditIdVerification[];
  simulated?: boolean;
}

// ─── Resultado de Verificación del Worker ───────────────────────────────────

export interface VerificationResult {
  extractedText: string;
  scanMethod: string;
}

// ─── Tipo utilitario para el stream de S3 ───────────────────────────────────

export type S3BodyStream = Readable;
