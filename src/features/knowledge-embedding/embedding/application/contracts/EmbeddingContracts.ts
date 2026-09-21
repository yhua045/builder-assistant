export type EmbeddingWorkflowState =
	| 'chunk-received'
	| 'validation-failed'
	| 'embedding-succeeded'
	| 'embedding-failed';

export interface EmbedChunkCommand {
	documentId: string;
	documentVersion: number;
	chunkId: string;
	text: string;
}

export interface EmbedChunkResult {
	chunkId: string;
	status: 'embedded' | 'duplicate' | 'failed';
	vector?: number[];
	provider?: string;
	modelVersion?: string;
	error?: string;
}

export interface EmbedChunkUseCase {
	execute(input: EmbedChunkCommand): Promise<EmbedChunkResult>;
}

export interface EmbeddingSearchQuery {
	text: string;
	dimension: number;
	provider?: string;
	modelVersion?: string;
}

export interface QueryEmbeddingUseCase {
	execute(input: EmbeddingSearchQuery): Promise<Float32Array>;
}