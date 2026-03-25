declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    version?: string;
  };

  export default function pdf(dataBuffer: Buffer | Uint8Array): Promise<PdfParseResult>;
}
