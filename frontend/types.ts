export interface GroundingSource {
  title?: string;
  uri?: string; // This holds the direct link to the source document (e.g., gs://caregivercorpus/...)
  bucketName?: string; // Extracted bucket name (e.g., caregivercorpus)
  fileName?: string; // Extracted file name from the Cloud Storage path
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
  sources?: GroundingSource[];
}

export interface AppSettings {
  projectId: string;
  location: string;
  datastoreId: string;
}
